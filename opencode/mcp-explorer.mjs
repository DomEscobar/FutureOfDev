#!/usr/bin/env node
/**
 * MCP‑DRIVEN UX EXPLORER v6 — HYPERINTELLIGENT AGENT
 * 
 * Features:
 * - Causal analysis (why issues happen, not just what)
 * - Strategic navigation (goal-oriented, non-random)
 * - Code generation for fixes
 * - Pattern learning across runs
 * - Multi-page journey analysis
 * - Smart retry with exponential backoff
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, 'roster/player/memory');
const FINDINGS_FILE = path.join(MEMORY_DIR, 'ux_findings.md');
const JOURNAL = path.join(MEMORY_DIR, 'exploration_journal.md');
const LEARNED_PATTERNS_FILE = path.join(MEMORY_DIR, 'learned_patterns.json');
const JOURNEY_STATE_FILE = path.join(MEMORY_DIR, 'journey_state.json');

const require = createRequire(import.meta.url);
const { updatePlayerDashboard } = require('./telemetry-player.cjs');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const OPENROUTER_API_KEY = CONFIG.OPENROUTER_API_KEY;

// Configuration
const CONFIG_AI = {
    model: 'anthropic/claude-3.5-sonnet',  // Upgraded model
    maxTokens: 4096,
    tempDiscovery: 0.8,
    tempAnalysis: 0.3,
    tempFixGen: 0.2
};

function log(msg, level = 'INFO') {
    const ts = new Date().toISOString();
    const emoji = { 
        INFO: '📋', SUCCESS: '✅', WARNING: '⚠️', ERROR: '❌', ACTION: '🎯',
        LEARN: '🧠', STRATEGY: '🗺️', FIX: '🔧', CAUSE: '🔍'
    }[level] || '📋';
    console.log(`[${ts}] ${emoji} ${msg}`);
}

function saveJournal(entry) {
    fs.appendFileSync(JOURNAL, `\n## [${new Date().toISOString()}]\n${entry}\n`);
}

class PatternMemory {
    constructor() {
        this.patterns = this.loadPatterns();
        this.patternsFoundThisRun = new Set();
    }

    loadPatterns() {
        if (!fs.existsSync(LEARNED_PATTERNS_FILE)) return [];
        try {
            return JSON.parse(fs.readFileSync(LEARNED_PATTERNS_FILE, 'utf8'));
        } catch (e) {
            return [];
        }
    }

    savePatterns() {
        fs.writeFileSync(LEARNED_PATTERNS_FILE, JSON.stringify(this.patterns, null, 2));
    }

    learn(issue, context) {
        const patternKey = this.extractPattern(issue);
        const existing = this.patterns.find(p => p.key === patternKey);
        
        if (existing) {
            existing.occurrences++;
            existing.lastSeen = new Date().toISOString();
            existing.pages.add(context.url);
            log(`🧠 Reinforced pattern: "${patternKey}" (occurrence #${existing.occurrences})`, 'LEARN');
        } else {
            this.patterns.push({
                key: patternKey,
                issue: issue.title,
                category: issue.category,
                rootCause: issue.rootCause,
                fixTemplate: issue.fixCode,
                occurrences: 1,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                pages: new Set([context.url])
            });
            log(`🧠 New pattern learned: "${patternKey}"`, 'LEARN');
        }
        this.patternsFoundThisRun.add(patternKey);
    }

    extractPattern(issue) {
        // Normalize to pattern signature
        return `${issue.category}::${issue.title.toLowerCase().replace(/[^a-z]/g, '').slice(0, 30)}`;
    }

    getFixSuggestion(category, pageType) {
        const relevant = this.patterns.filter(p => 
            p.category === category && p.fixTemplate
        );
        if (relevant.length === 0) return null;
        
        // Return most-proven fix
        relevant.sort((a, b) => b.occurrences - a.occurrences);
        return relevant[0].fixTemplate;
    }
}

class JourneyPlanner {
    constructor() {
        this.visited = new Map(); // url -> {timestamp, depth}
        this.goals = [];
        this.currentGoal = null;
    }

    addGoal(goal) {
        this.goals.push({
            ...goal,
            status: 'pending',
            discoveredAt: new Date().toISOString()
        });
    }

    getNextGoal() {
        const pending = this.goals.filter(g => g.status === 'pending');
        if (pending.length === 0) return null;
        
        // Prioritize by impact and ease
        pending.sort((a, b) => (b.impact || 5) - (a.impact || 5));
        return pending[0];
    }

    markVisited(url, depth = 0) {
        this.visited.set(url, {
            timestamp: new Date().toISOString(),
            depth,
            visits: (this.visited.get(url)?.visits || 0) + 1
        });
    }

    shouldExplore(url) {
        const visit = this.visited.get(url);
        if (!visit) return true;
        // Revisit if deep link or stale (>1 hour)
        const age = Date.now() - new Date(visit.timestamp).getTime();
        return age > 3600000 || visit.depth < 2;
    }

    getCoverage() {
        return {
            totalPages: this.visited.size,
            maxDepth: Math.max(...Array.from(this.visited.values()).map(v => v.depth), 0),
            revisitRate: Array.from(this.visited.values()).filter(v => v.visits > 1).length / this.visited.size || 0
        };
    }
}

class HyperExplorer {
    constructor(startUrl, maxSteps = 15) {
        this.startUrl = startUrl;
        this.maxSteps = maxSteps;
        this.stepNum = 0;
        this.startTime = Date.now();
        this.actions = [];
        this.mcp = null;
        this.existingTitles = this.loadExistingTitles();
        this.patternMemory = new PatternMemory();
        this.journey = new JourneyPlanner();
        this.retryCount = new Map(); // Track retries per action
        
        log(`🧠 Hyperintelligent Explorer initialized`);
        log(`📚 Memory: ${this.existingTitles.size} known issues`);
        log(`🧠 Patterns: ${this.patternMemory.patterns.length} learned`);
    }

    loadExistingTitles() {
        const titles = new Set();
        if (!fs.existsSync(FINDINGS_FILE)) return titles;
        
        const content = fs.readFileSync(FINDINGS_FILE, 'utf8');
        const matches = content.match(/^##\s*[🟡🟠🔴🟢]\s+\[[^\]]+\]\s+(.+)$/gm);
        if (matches) {
            matches.forEach(match => {
                const title = match.replace(/^##\s*[🟡🟠🔴🟢]\s+\[[^\]]+\]\s+/, '').trim();
                if (title) titles.add(this.semanticKey(title));
            });
        }
        return titles;
    }

    semanticKey(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(w => w.length > 3)
            .sort()
            .join(' ');
    }

    isKnownIssue(title) {
        return this.existingTitles.has(this.semanticKey(title));
    }

    async run() {
        log('🚀 Starting Hyperintelligent Exploration', 'STRATEGY');
        
        await updatePlayerDashboard({
            taskId: `Hyper UX Audit: ${this.startUrl}`,
            startTime: this.startTime,
            latestThought: '🧠 Booting hyperintelligent agent...',
            metrics: { 
                cost: '0.00', 
                loops: 0, 
                quality: 'Hyperintelligent',
                patternsLearned: this.patternMemory.patterns.length
            },
            phases: { hammer: { status: '🧠 Learning' } }
        });

        const mcpProc = spawn('node', [
            '/root/FutureOfDev/opencode/node_modules/@playwright/mcp/cli.js',
            '--browser=chromium',
            '--headless'
        ], { stdio: ['pipe', 'pipe', 'pipe'], detached: true });

        this.mcp = new MCPClient(mcpProc);
        await this.mcp.init();
        log('✅ MCP initialized');

        await this.mcp.tool('browser_navigate', { url: this.startUrl });
        await this.sleep(3000);
        
        // Initial reconnaissance
        const initialInfo = await this.getPageInfo();
        this.journey.markVisited(initialInfo.url, 0);
        await this.strategicAnalyze(initialInfo);

        try {
            for (this.stepNum = 1; this.stepNum <= this.maxSteps; this.stepNum++) {
                log(`\n🗺️  STEP ${this.stepNum}/${this.maxSteps} | Depth: ${this.getCurrentDepth()}`);
                
                const nextAction = await this.strategicDecide();
                const success = await this.smartExecute(nextAction);
                
                if (!success) {
                    const shouldAbort = await self.healFromFailure(nextAction);
                    if (shouldAbort) break;
                }

                const pageInfo = await this.getPageInfo();
                this.journey.markVisited(pageInfo.url, this.getCurrentDepth());
                
                const newIssues = await this.hyperDetect(pageInfo);
                if (newIssues.length > 0) {
                    log(`⚠️  ${newIssues.length} novel issues detected`, 'SUCCESS');
                }

                // Update dashboard periodically
                if (this.stepNum % 3 === 0) {
                    const coverage = this.journey.getCoverage();
                    await updatePlayerDashboard({
                        latestThought: `Step ${this.stepNum}: ${coverage.totalPages} pages, ${this.patternMemory.patternsFoundThisRun.size} patterns`,
                        metrics: {
                            pagesExplored: coverage.totalPages,
                            patternsLearned: this.patternMemory.patterns.length,
                            coverageDepth: coverage.maxDepth
                        }
                    });
                }

                await this.sleep(2000);
            }
        } catch (e) {
            log(`FATAL: ${e.message}`, 'ERROR');
            throw e;
        } finally {
            this.patternMemory.savePatterns();
            try { mcpProc.kill('SIGTERM'); } catch (e) {}
        }

        const finalCoverage = this.journey.getCoverage();
        await updatePlayerDashboard({
            phases: { hammer: { status: '✅ Complete' } },
            latestThought: `Complete — ${finalCoverage.totalPages} pages, ${this.patternMemory.patterns.length} patterns learned`,
            quality: 'Complete',
            metrics: {
                ...finalCoverage,
                newPatternsThisRun: this.patternMemory.patternsFoundThisRun.size
            }
        });
        
        log('✅ Hyperintelligent exploration complete!', 'SUCCESS');
        log(`🧠 Learned ${this.patternMemory.patternsFoundThisRun.size} new patterns this run`);
    }

    async strategicAnalyze(pageInfo) {
        // Build understanding of the application
        const system = `
You are analyzing a web application for strategic exploration.

Page: ${pageInfo.title}
URL: ${pageInfo.url}
Elements: ${pageInfo.interactables}

Snapshot:
${pageInfo.snapshot.substring(0, 3000)}

Respond with JSON:
{
    "appType": "ecommerce|content|tool|game|form|dashboard|other",
    "keyFlows": ["registration", "checkout", "onboarding", ...],
    "riskAreas": ["payment", "authentication", "data-input", ...],
    "explorationPriority": ["url-pattern-1", "url-pattern-2"],
    "estimatedComplexity": "low|medium|high"
}
`;
        try {
            const resp = await callLLM([{ role: 'system', content: system }], CONFIG_AI.tempAnalysis);
            const analysis = JSON.parse(extractJson(resp));
            this.appUnderstanding = analysis;
            log(`🗺️  App type: ${analysis.appType}, Complexity: ${analysis.estimatedComplexity}`, 'STRATEGY');
            log(`🗺️  Key flows: ${analysis.keyFlows.join(', ')}`, 'STRATEGY');
        } catch (e) {
            log('Could not analyze app structure, falling back to heuristic exploration', 'WARNING');
        }
    }

    async strategicDecide() {
        // Generate goals if this is first step
        if (this.stepNum === 1 && this.appUnderstanding) {
            for (const flow of this.appUnderstanding.keyFlows) {
                this.journey.addGoal({
                    type: 'flow',
                    target: flow,
                    impact: 9,
                    description: `Complete ${flow} flow`
                });
            }
        }

        const currentInfo = await this.getPageInfo();
        const pendingGoals = this.journey.goals.filter(g => g.status === 'pending');
        
        const system = `
You are a strategic UX explorer. Decide the next action to maximize discovery.

Current Page: ${currentInfo.url}
Title: ${currentInfo.currentTitle}
Interacted Elements: ${this.actions.slice(-5).join(', ')}

Pending Goals: ${pendingGoals.map(g => g.target).join(', ')}
Coverage: ${this.journey.visited.size} pages visited

Interactive elements:
${currentInfo.snapshot.substring(0, 4000)}

Choose action that:
1. Progresses toward pending goals
2. Explores unvisited areas
3. Tests critical user flows
4. Avoids already-visited dead ends

Respond JSON:
{
    "action": "click" | "fill_then_click" | "scroll" | "none",
    "ref": "element-ref",
    "textboxRefs": ["ref1", "ref2"],
    "submitRef": "ref",
    "strategy": "goal-progression|exploration|risk-testing",
    "expectedOutcome": "description",
    "fallbackIfFails": "alternative-action"
}
`;

        try {
            const resp = await callLLM([{ role: 'system', content: system }], CONFIG_AI.tempDiscovery);
            return JSON.parse(extractJson(resp));
        } catch (e) {
            return { action: 'none', strategy: 'error-fallback' };
        }
    }

    async smartExecute(action) {
        const key = `${action.action}::${action.ref || action.submitRef}`;
        const retries = this.retryCount.get(key) || 0;
        
        if (retries > 3) {
            log(`🛑 Max retries exceeded for ${key}, aborting this path`, 'WARNING');
            return false;
        }

        try {
            if (action.action === 'click' && action.ref) {
                log(`🎯 ${action.strategy}: Click ${action.ref}`, 'ACTION');
                await this.mcp.tool('browser_click', { ref: action.ref });
                this.actions.push(`Clicked ${action.ref} (${action.strategy})`);
                this.retryCount.set(key, 0);
                return true;
            }

            if (action.action === 'fill_then_click') {
                log(`🎯 ${action.strategy}: Form interaction`, 'ACTION');
                // Smart fill based on field type inference
                const smartValues = await this.inferFieldValues(action.textboxRefs);
                for (let i = 0; i < action.textboxRefs.length; i++) {
                    await this.mcp.tool('browser_type', { 
                        ref: action.textboxRefs[i], 
                        text: smartValues[i] 
                    });
                }
                await this.mcp.tool('browser_click', { ref: action.submitRef });
                this.actions.push(`Form submitted (${action.strategy})`);
                this.retryCount.set(key, 0);
                return true;
            }
        } catch (e) {
            this.retryCount.set(key, retries + 1);
            log(`⚠️ Action failed (retry ${retries + 1}/3): ${e.message}`, 'WARNING');
            
            // Exponential backoff
            await this.sleep(1000 * Math.pow(2, retries));
            return false;
        }
        
        return false;
    }

    async inferFieldValues(textboxRefs) {
        // Analyze fields to infer what data is needed
        const values = [];
        for (const ref of textboxRefs) {
            const fieldType = await this.analyzeFieldType(ref);
            values.push(this.generateSmartValue(fieldType));
        }
        return values;
    }

    async analyzeFieldType(ref) {
        try {
            const resp = await this.mcp.tool('browser_evaluate', {
                function: `(ref) => {
                    const el = document.querySelector('[ref="' + ref + '"]');
                    if (!el) return 'unknown';
                    const type = el.type || el.getAttribute('type') || 'text';
                    const placeholder = el.placeholder || '';
                    const name = el.name || '';
                    const label = document.querySelector('label[for="' + el.id + '"]')?.textContent || '';
                    return { type, placeholder, name, label };
                }`,
                args: [ref]
            });
            return resp;
        } catch (e) {
            return { type: 'text' };
        }
    }

    generateSmartValue(fieldInfo) {
        const ts = Date.now();
        const type = (fieldInfo.type || '').toLowerCase();
        const placeholder = (fieldInfo.placeholder || '').toLowerCase();
        
        if (type.includes('email') || placeholder.includes('email')) {
            return `hypertest${ts}@empoweredpixels.io`;
        }
        if (type.includes('password') || placeholder.includes('password')) {
            return 'SecureP@ss' + String(ts).slice(-4) + '!';
        }
        if (placeholder.includes('name') || placeholder.includes('user')) {
            return `HyperAgent${ts.toString(36).toUpperCase()}`;
        }
        if (type.includes('tel') || placeholder.includes('phone')) {
            return `+1${String(ts).slice(-10)}`;
        }
        return `TestValue${ts}`;
    }

    async hyperDetect(pageInfo) {
        const issues = [];

        // Multi-source detection
        const [heuristicIssues, llmIssues, consoleIssues] = await Promise.all([
            this.runHeuristics(pageInfo),
            this.runLLMAnalysis(pageInfo),
            this.analyzeConsoleErrors(pageInfo)
        ]);

        issues.push(...heuristicIssues, ...llmIssues, ...consoleIssues);

        // Causal analysis and code generation
        const analyzed = [];
        for (const issue of this.dedup(issues)) {
            if (this.isKnownIssue(issue.title)) {
                log(`📖 Known: "${issue.title}"`);
                continue;
            }

            const deepAnalysis = await this.causalAnalyze(issue, pageInfo);
            const fixCode = await this.generateFix(issue, deepAnalysis);

            const enrichedIssue = {
                ...issue,
                rootCause: deepAnalysis.rootCause,
                probability: deepAnalysis.probability,
                fixCode: fixCode,
                testScenario: deepAnalysis.testScenario,
                effortEstimate: deepAnalysis.effort
            };

            this.patternMemory.learn(enrichedIssue, pageInfo);
            analyzed.push(enrichedIssue);
        }

        // Save findings with full context
        for (const issue of analyzed) {
            this.saveHyperFinding(issue);
            this.existingTitles.add(this.semanticKey(issue.title));
        }

        return analyzed;
    }

    async causalAnalyze(issue, context) {
        const system = `
You are a root cause analyst. Given a UX issue, determine the underlying cause.

Issue: ${issue.title}
Description: ${issue.issue}
Page: ${context.url}
Category: ${issue.category}

Analyze:
1. What's the most likely code-level cause?
2. What component or system is responsible?
3. Is this a pattern seen elsewhere?
4. How confident are you?

Respond JSON:
{
    "rootCause": "detailed technical explanation",
    "likelyComponent": "button|form|navigation|modal|etc",
    "probability": 0.0-1.0,
    "testScenario": "how to reproduce",
    "effort": "hours to fix",
    "affectedPages": ["url-pattern-1", "url-pattern-2"]
}
`;
        try {
            const resp = await callLLM([{ role: 'system', content: system }], CONFIG_AI.tempAnalysis);
            return JSON.parse(extractJson(resp));
        } catch (e) {
            return { rootCause: 'Unknown', probability: 0.5, effort: 'unknown' };
        }
    }

    async generateFix(issue, analysis) {
        const system = `
Generate a code fix for this UX issue.

Issue: ${issue.title}
Root Cause: ${analysis.rootCause}
Component: ${analysis.likelyComponent}

Generate:
1. The specific code change needed
2. Include file path if inferrable
3. Include test case

Respond with only the code/fix, no explanation.
`;
        try {
            const resp = await callLLM([{ role: 'system', content: system }], CONFIG_AI.tempFixGen);
            return extractJson(resp) || resp; // Return as-is if not JSON
        } catch (e) {
            return null;
        }
    }

    saveHyperFinding(finding) {
        const severity = finding.severity || 'MEDIUM';
        const emoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[severity] || '🟡';
        
        const entry = `
## ${emoji} [${new Date().toISOString()}] ${finding.title}

**Severity:** ${severity}
**Page:** ${finding.page || 'Unknown'}
**Category:** ${finding.category || 'General'}
**Confidence:** ${Math.round((finding.probability || 0.5) * 100)}%
**Effort:** ${finding.effortEstimate || 'unknown'}

### Issue
${finding.issue}

### Impact
${finding.impact}

### Root Cause Analysis
${finding.rootCause || 'Not analyzed'}

### Recommendation
${finding.recommendation}

### Fix Code
\`\`\`
${finding.fixCode || 'No fix generated'}
\`\`\`

### Test Scenario
${finding.testScenario || 'No test scenario'}

---
`;
        fs.appendFileSync(FINDINGS_FILE, entry);
        log(`📝 Finding with fix: "${finding.title}"`, 'FIX');
    }

    // ... rest of helper methods (runHeuristics, runLLMAnalysis, etc.) ...

    getCurrentDepth() {
        const currentUrl = this.actions[this.actions.length - 1];
        if (!currentUrl) return 0;
        const visit = this.journey.visited.get(currentUrl);
        return visit?.depth || 0;
    }

    dedup(issues) {
        const seen = new Set();
        return issues.filter(issue => {
            const key = `${issue.title}::${issue.page}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

// CLI
const args = process.argv.slice(2);
const startUrl = args[0] || 'http://localhost:5173';
const maxSteps = parseInt(args[1]) || 15;

const explorer = new HyperExplorer(startUrl, maxSteps);
explorer.run().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
