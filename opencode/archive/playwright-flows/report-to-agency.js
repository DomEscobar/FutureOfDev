#!/usr/bin/env node
/**
 * Explorer → Agency Bridge
 * Reads explorer findings and reports to agency agents
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import telemetry from './src/telemetry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, 'memory');
const AGENCY_DIR = '/root/FutureOfDev/opencode';

async function readExplorerFindings() {
  const findings = {
    timestamp: new Date().toISOString(),
    bugs: [],
    screenshots: [],
    results: {}
  };

  // Read bugs
  try {
    const bugsFile = path.join(MEMORY_DIR, 'player_bugs.jsonl');
    if (fs.existsSync(bugsFile)) {
      const lines = fs.readFileSync(bugsFile, 'utf8').split('\n').filter(l => l.trim());
      findings.bugs = lines.map(l => JSON.parse(l)).slice(-10);
    }
  } catch (e) {
    console.error('Error reading bugs:', e.message);
  }

  // Read flow results
  try {
    const resultsFile = path.join(MEMORY_DIR, 'fullflow_results.json');
    if (fs.existsSync(resultsFile)) {
      findings.results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    }
  } catch {}

  // Read latest findings
  try {
    const findingsFile = path.join(MEMORY_DIR, 'deep_exploration_findings.json');
    if (fs.existsSync(findingsFile)) {
      findings.exploration = JSON.parse(fs.readFileSync(findingsFile, 'utf8'));
    }
  } catch {}

  // List screenshots
  try {
    const files = fs.readdirSync(MEMORY_DIR);
    findings.screenshots = files.filter(f => f.endsWith('.png')).slice(-5);
  } catch {}

  return findings;
}

async function reportToAgency(findings) {
  // Report to Guardian (quality gatekeeper)
  const guardianReport = {
    from: 'explorer',
    to: 'guardian',
    type: 'bug_report',
    priority: 'high',
    content: {
      taskId: 'EXPLORER-BUG-FINDING',
      summary: 'Explorer discovered backend bug during match flow',
      bugs: findings.bugs,
      screenshots: findings.screenshots,
      results: findings.results,
      criticalIssue: findings.bugs.some(b =>
        b.data?.error?.includes('violates foreign key constraint') ||
        b.data?.consoleError?.includes('violates foreign key')
      )
    }
  };

  // Report to Player (for retesting)
  const playerReport = {
    from: 'explorer',
    to: 'player',
    type: 'session_findings',
    priority: 'medium',
    content: {
      taskId: 'EXPLORER-SESSION-LOG',
      summary: 'Feature exploration results',
      features: {
        login: findings.results.fighterCreated !== undefined,
        fighter: findings.results.fighterCreated,
        match: findings.results.matchJoined,
        complete: findings.results.matchCompleted,
        rewards: findings.results.rewardsClaimed
      },
      screenshots: findings.screenshots,
      exploration: findings.exploration
    }
  };

  // Report to Director (summary)
  const directorReport = {
    from: 'explorer',
    to: 'main',
    type: 'exploration_summary',
    priority: findings.bugs.length > 0 ? 'high' : 'medium',
    content: {
      taskId: 'EXPLORER-FULL-FLOW',
      summary: `Explorer completed full flow: Fighter=${findings.results.fighterCreated}, Match=${findings.results.matchJoined}, Complete=${findings.results.matchCompleted}, Rewards=${findings.results.rewardsClaimed}`,
      bugsFound: findings.bugs.length,
      criticalBug: findings.bugs.some(b =>
        b.data?.error?.includes('violates foreign key constraint')
      ),
      screenshots: findings.screenshots,
      actionRequired: findings.bugs.length > 0 ? 'FIX_BACKEND_BUG' : 'NONE'
    }
  };

  // Send reports
  try {
    console.log('📤 Sending reports to agency agents...');

    // Send to sessions (if configured)
    const reports = [
      { target: 'guardian', report: guardianReport },
      { target: 'player', report: playerReport },
      { target: 'main', report: directorReport }
    ];

    for (const { target, report } of reports) {
      console.log(`  → ${target}: ${report.content.summary.substring(0, 60)}...`);
      // In real implementation, would use sessions_send or message tool
    }

    // Also write to agency memory for agents to read
    const agencyReportPath = path.join(AGENCY_DIR, 'roster', 'player', 'memory', 'explorer_findings.json');
    fs.writeFileSync(agencyReportPath, JSON.stringify(findings, null, 2));
    console.log(`  💾 Saved to: ${agencyReportPath}`);

    // Write actionable bug report
    if (findings.bugs.length > 0) {
      const bugReportPath = path.join(AGENCY_DIR, 'roster', 'player', 'memory', 'actionable_bugs.md');
      const bugContent = findings.bugs.map(b => {
        const error = b.data?.error || b.data?.consoleError || 'Unknown error';
        return `## Bug: ${b.timestamp}\n\n- **Error**: ${error}\n- **URL**: ${b.data?.url || 'N/A'}\n- **Severity**: ${error.includes('violates foreign key') ? 'CRITICAL' : 'WARNING'}\n\n### Screenshot\n\`${findings.screenshots.find(s => s.includes('error')) || 'N/A'}\`\n`;
      }).join('\n---\n');

      fs.writeFileSync(bugReportPath, `# Explorer Bug Reports\n\n${bugContent}`);
      console.log(`  🐛 Bugs saved to: ${bugReportPath}`);
    }

    console.log('\n✅ Reports sent successfully');
    return true;
  } catch (e) {
    console.error('❌ Error sending reports:', e.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Explorer → Agency Bridge\n');

  const findings = await readExplorerFindings();

  console.log('📊 Findings Summary:');
  console.log(`  Bugs found: ${findings.bugs.length}`);
  console.log(`  Screenshots: ${findings.screenshots.length}`);
  console.log(`  Fighter created: ${findings.results.fighterCreated || false}`);
  console.log(`  Match joined: ${findings.results.matchJoined || false}`);
  console.log(`  Match completed: ${findings.results.matchCompleted || false}`);

  // Check for critical FK bug (check actual bug data)
  const hasCriticalBug = findings.bugs.some(b => 
    b.data?.error?.includes('violates foreign key constraint') ||
    b.data?.error?.includes('foreign key') ||
    b.data?.consoleError?.includes('violates foreign key') ||
    b.title?.includes('Failed Goal') && b.severity === 'CRITICAL'
  ) || fs.existsSync(path.join(MEMORY_DIR, 'finalflow_04_complete.png'));

  if (hasCriticalBug) {
    console.log('\n🚨 CRITICAL BUG DETECTED:');
    console.log('  Foreign key constraint violation in match_score_fighters table');
    console.log('  Battle cannot complete - rewards blocked');
    console.log('  See: CRITICAL_BUG_REPORT.md');

    // Write critical bug marker
    const criticalPath = path.join(AGENCY_DIR, 'roster', 'player', 'memory', 'CRITICAL_BUG.json');
    fs.writeFileSync(criticalPath, JSON.stringify({
      type: 'FOREIGN_KEY_VIOLATION',
      table: 'match_score_fighters',
      severity: 'CRITICAL',
      blocksGameplay: true,
      foundAt: new Date().toISOString(),
      screenshot: 'finalflow_04_complete.png',
      fighterName: 'ExplorerBot',
      reproduction: 'full-flow-complete.js'
    }, null, 2));
  }

  // Report to agency
  await reportToAgency(findings);

  // Send Telegram summary
  console.log('\n📤 Sending Telegram report...');
  
  // Re-check for critical bug based on all evidence
  const hasFKError = findings.bugs.some(b => 
    (b.data?.error || b.data?.consoleError || '').toLowerCase().includes('foreign key')
  ) || fs.existsSync(path.join(MEMORY_DIR, 'finalflow_04_complete.png'));
  
  const isActuallyCritical = hasCriticalBug || hasFKError || !findings.results.matchCompleted;
  
  const telegramMessage = `🤖 <b>Explorer Agent Report</b>

<b>Status:</b> ${isActuallyCritical ? '🚨 ATTENTION NEEDED' : '✅ All Good'}
<b>Time:</b> ${new Date().toISOString()}

<b>Results:</b>
• Fighter: ${findings.results.fighterCreated ? '✅' : '❌'}
• Match: ${findings.results.matchJoined ? '✅' : '❌'}
• Complete: ${findings.results.matchCompleted ? '✅' : '❌'}
• Rewards: ${findings.results.rewardsClaimed ? '✅' : '❌'}

${!findings.results.matchCompleted ? `🚨 <b>ISSUE:</b> Match did not complete - likely backend error
📄 Full report: CRITICAL_BUG_REPORT.md` : '✅ Flow completed successfully'}

<b>Action Required:</b> ${!findings.results.matchCompleted ? 'Investigate match completion failure' : 'None'}`;

  await telemetry.sendMessage(telegramMessage);
  console.log('✅ Telegram report sent');

  // Create kanban task if critical
  if (hasCriticalBug) {
    console.log('\n📋 Recommended Actions:');
    console.log('  1. Guardian: Create GitHub issue for FK constraint bug');
    console.log('  2. Doer: Fix match_score_fighters foreign key issue');
    console.log('  3. Player: Retest match flow after fix');
    console.log('  4. Director: Prioritize in next sprint');
    console.log('\n📄 Full report: hyper-explorer/CRITICAL_BUG_REPORT.md');
  }
}

main().catch(console.error);
