const {
  progressBar,
  severityBadge,
  formatCost,
  formatDuration,
  formatDate,
  truncate,
  bold,
  italic,
  code,
  escapeMarkdown
} = require('./formatters');

/**
 * One line for a phase in the agency pipeline
 */
const agencyPhaseLine = (name, phase) => {
  const icons = {
    architect: '📐',
    hammer: '🔨',
    checker: '🧐',
    medic: '🩹',
    skeptic: '⚖️'
  };
  const icon = icons[name] || '▫️';
  const status = phase.status || '⏳ Queued';
  return `${icon} *${name.charAt(0).toUpperCase() + name.slice(1)}*: ${escapeMarkdown(status)}`;
};

/**
 * Agency pipeline dashboard
 */
exports.agencyDashboard = (state) => {
  const phases = Object.entries(state.phases || {})
    .map(([k, v]) => agencyPhaseLine(k, v))
    .join('\n');
  
  const cost = formatCost(state.metrics?.cost || 0);
  const runtime = formatDuration((Date.now() - (state.startTime || Date.now())) / 1000);
  const taskId = truncate(state.taskId?.split('\n')[0] || 'Unknown', 35);

  let hammerProgress = '';
  if (state.phases?.hammer?.percent !== undefined) {
    hammerProgress = `\n🔨 *Progress*: ${progressBar(state.phases.hammer.percent)}\n`;
  }

  let verificationLine = '';
  if (state.verification) {
    const statusIcon = state.verification.status === 'verified' ? '✅' :
                       state.verification.status === 'failed' ? '❌' : '⏳';
    const statusText = state.verification.status === 'verified' ? 'VERIFIED' :
                       state.verification.status === 'failed' ? 'FAILED CHECK' : state.verification.status.toUpperCase();
    verificationLine = `\n🔍 *Verification*: ${statusIcon} ${statusText}`;
    if (state.verification.notes) {
      verificationLine += `\n${italic(truncate(state.verification.notes, 80))}`;
    }
  }

  return `
🏛️ *AGENCY PIPE* \\- ${code(taskId)}

${phases || 'No phases data'}${hammerProgress}${verificationLine}

💰 *Cost*: ${code(cost)}
⏱️ *Runtime*: ${code(runtime)}
💭 *Thought*: ${escapeMarkdown(truncate(state.latestThought || '...', 120))}
`.trim();
};

/**
 * Player session dashboard
 */
exports.playerDashboard = (state) => {
  const cost = formatCost(state.metrics?.cost || 0);
  const runtime = formatDuration((Date.now() - (state.startTime || Date.now())) / 1000);
  const taskId = truncate(state.taskId || 'Unknown', 35);

  return `
🕹️ *PLAYER SESSION* \\- ${code(taskId)}

👤 *Experience Audit*
• Status: ${escapeMarkdown(state.phases?.hammer?.status || 'Analyzing…')}
• Findings: \`${state.metrics?.loops || 0}\` gaps
• Quality: ${escapeMarkdown(state.metrics?.quality || 'Checking UI')}

💰 *Session Cost*: ${code(cost)}
⏱️ *Runtime*: ${code(runtime)}

📝 *Hero's Journal \\(Latest\\):*
${italic(truncate(state.latestThought || 'Waking up…', 150))}
  `.trim();
};

/**
 * Single UX finding card
 */
exports.findingCard = (finding, status = 'NEW') => {
  const badge = severityBadge(finding.severity);
  const icon = status === 'RESOLVED' ? '✅' : '🚨';
  const ts = formatDate(finding.timestamp || new Date());

  return `
${icon} *${badge} ${finding.severity}* \\- ${bold(finding.title)}

📍 *Page*: ${code(finding.page)}
🎯 *Element*: ${code(finding.element || 'N/A')}

📋 *Recommendation*:
${escapeMarkdown(finding.recommendation || 'None provided')}

🗓️ *Detected*: ${italic(ts)}
${status === 'RESOLVED' ? '\n✅ *Status*: RESOLVED' : ''}
  `.trim();
};

/**
 * Daily/weekly KPI summary
 */
exports.kpiSummary = (stats) => {
  const { date, playerRuns, newFindings, fixed, pending, totalSpend, budget, hotFinding } = stats;
  const spendPct = Math.round((totalSpend / budget) * 100);
  const budgetBar = progressBar(spendPct, 10);

  return `
📊 *DAILY REPORT* \\- ${bold(date)}

👤 *Player Runs*: \`${playerRuns}\` \\| 🆕 *Findings*: \`${newFindings}\`
✅ *Fixed*: \`${fixed}\` \\| ⏳ *Pending*: \`${pending}\`

💰 *Spend*: ${code(`$${totalSpend.toFixed(4)}`)} / ${code(`$${budget.toFixed(2)}`)}
   ${budgetBar}

${hotFinding ? `🔥 *Hot*: ${escapeMarkdown(hotFinding.title)} \\( ${escapeMarkdown(hotFinding.phase)} \\)\n` : ''}
🔄 *Next*: Re\\-run Explorer at 20:00 CET
  `.trim();
};
