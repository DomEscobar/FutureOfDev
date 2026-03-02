#!/usr/bin/env node
/**
 * Player Finding Watcher v2 — robust, with health server and error recovery
 *
 * Watches ux_findings.md for new entries → triggers Agency → correlates via ledger.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const http = require('http');

// Import ledger for correlation
const ledger = require('./ledger');
const { sendFinding } = require('./telemetry-finding.cjs');
const { updatePlayerDashboard } = require('./telemetry-player.cjs');

const AGENCY_HOME = process.env.AGENCY_HOME || path.resolve(__dirname);
const MEMORY_DIR = path.join(AGENCY_HOME, 'roster', 'player', 'memory');
const FINDINGS_FILE = path.join(MEMORY_DIR, 'ux_findings.md');
const STATE_FILE = path.join(MEMORY_DIR, 'watcher_state.json');
const FEEDBACK_FILE = path.join(MEMORY_DIR, 'agency_feedback.md');
const AGENCY_BIN = path.join(AGENCY_HOME, 'agency.js');

const POLL_MS = Number(process.env.WATCHER_POLL_MS) || 60000; // Throttled to 60s
const MAX_PROCESSED_FINGERPRINTS = 500;
const MIN_RUN_INTERVAL_MS = 60000; // Minimum 60s between Agency runs

// Stats for health/metrics
let totalFindings = 0;
let totalRuns = 0;
let lastRunAt = null;
let startTime = Date.now();

function loadConfig() {
    const configPath = path.join(MEMORY_DIR, 'watcher_config.json');
    if (!fs.existsSync(configPath)) {
        return { workspace: process.env.WORKSPACE || process.cwd() };
    }
    try {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return {
            workspace: data.workspace || process.env.WORKSPACE || process.cwd(),
            pollMs: data.pollMs || POLL_MS
        };
    } catch (e) {
        return { workspace: process.env.WORKSPACE || process.cwd() };
    }
}

function loadState() {
    if (!fs.existsSync(STATE_FILE)) {
        return { 
            lastProcessedByte: 0, 
            processedFingerprints: [],
            processedTitles: [], // Semantic dedup by title
            findingStates: {} // Track: pending | fixed | wontfix
        };
    }
    try {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        return {
            lastProcessedByte: data.lastProcessedByte || 0,
            processedFingerprints: Array.isArray(data.processedFingerprints)
                ? data.processedFingerprints
                : [],
            processedTitles: Array.isArray(data.processedTitles)
                ? data.processedTitles
                : [],
            findingStates: data.findingStates || {}
        };
    } catch (e) {
        return { 
            lastProcessedByte: 0, 
            processedFingerprints: [],
            processedTitles: [],
            findingStates: {}
        };
    }
}

function saveState(state) {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    if (state.processedFingerprints.length > MAX_PROCESSED_FINGERPRINTS) {
        state.processedFingerprints = state.processedFingerprints.slice(-MAX_PROCESSED_FINGERPRINTS);
    }
    if (state.processedTitles.length > MAX_PROCESSED_FINGERPRINTS) {
        state.processedTitles = state.processedTitles.slice(-MAX_PROCESSED_FINGERPRINTS);
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function semanticFingerprint(title) {
    // Normalize title for semantic dedup: lowercase, remove common suffixes/prefixes
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(w => w.length > 3) // Only significant words
        .sort() // Order-independent
        .join(' ');
}

function fingerprint(block) {
    return crypto.createHash('sha256').update(block).digest('hex').slice(0, 16);
}

function parseNewFindings(content) {
    const parts = content.split(/\n---\s*\n/).map(s => s.trim()).filter(Boolean);
    const findings = [];
    for (const block of parts) {
        if (!/^##\s/m.test(block)) continue;
        const titleMatch = block.match(/^##\s*[^\[]*\[\d{4}[^\]]+\]\s+(.+?)(?:\n|$)/m);
        const title = titleMatch ? titleMatch[1].trim() : block.slice(0, 80);
        findings.push({ block, title });
    }
    return findings;
}

function runAgency(taskDescription, workspace) {
    return new Promise((resolve) => {
        const env = { ...process.env, AGENCY_HOME, WORKSPACE: workspace };
        // Use agency.js (correct path) with --no-retry to stop MEDIC loops
        const child = spawn('node', [
            path.join(AGENCY_HOME, 'agency.js'), 
            'run', 
            taskDescription,
            '--no-retry'
        ], {
            cwd: workspace,
            stdio: 'inherit',
            env
        });
        child.on('close', (code) => resolve(code));
        child.on('error', (err) => {
            console.error('[watcher] Agency spawn error:', err.message);
            resolve(1);
        });
    });
}

function appendFeedback(title, exitCode, timestamp) {
    const header = `## Agency run for finding: ${title}`;
    const body = `Completed at ${timestamp}. Exit code: ${exitCode}. Re-run explorer to verify.`;
    const entry = `\n${header}\n${body}\n\n`;
    if (!fs.existsSync(FEEDBACK_FILE)) {
        fs.mkdirSync(path.dirname(FEEDBACK_FILE), { recursive: true });
        fs.writeFileSync(FEEDBACK_FILE, `# Agency feedback for Player\n\nBelow: results of agency runs triggered by your findings.\n\n${entry}`);
    } else {
        fs.appendFileSync(FEEDBACK_FILE, entry);
    }
}

function log(msg) {
    console.log(`[${new Date().toISOString()}] [watcher] ${msg}`);
}

// Health HTTP server
let healthServer = null;
function startHealthServer(port) {
    healthServer = http.createServer((req, res) => {
        if (req.url === '/health') {
            // Read current state for finding stats
            let findingStats = { pending: 0, fixed: 0, failed: 0 };
            try {
                const stateData = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
                if (stateData.findingStates) {
                    findingStats.pending = Object.values(stateData.findingStates).filter(s => s.status === 'pending').length;
                    findingStats.fixed = Object.values(stateData.findingStates).filter(s => s.status === 'fixed').length;
                    findingStats.processed = Object.values(stateData.findingStates).filter(s => s.status === 'processed').length;
                    findingStats.failed = Object.values(stateData.findingStates).filter(s => s.status === 'failed').length;
                }
            } catch(e) {}
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                uptime: process.uptime(),
                totalFindings,
                totalRuns,
                // V17.0: Include processed count in health endpoint
                findingStates: findingStats,
                lastRunAt,
                startTime: new Date(startTime).toISOString()
            }));
        } else if (req.url === '/metrics') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`# HELP watcher_findings_total Total findings triggered\n# TYPE watcher_findings_total counter\nwatcher_findings_total ${totalFindings}\n# HELP watcher_runs_total Total agency runs\n# TYPE watcher_runs_total counter\nwatcher_runs_total ${totalRuns}\n`);
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    healthServer.listen(port, () => {
        log(`Health server listening on :${port}`);
    });
    healthServer.on('error', (err) => {
        console.error('[watcher] Health server error:', err.message);
    });
}

async function poll(config, state) {
    if (!fs.existsSync(FINDINGS_FILE)) return state;

    // Enforce minimum time between Agency runs
    if (lastRunAt && (Date.now() - new Date(lastRunAt).getTime()) < MIN_RUN_INTERVAL_MS) {
        return state; // Skip this poll cycle, too soon
    }

    const content = fs.readFileSync(FINDINGS_FILE, 'utf8');
    const contentLength = content.length;
    if (contentLength <= state.lastProcessedByte) return state;

    // Only process up to the last separator to avoid partial reads
    const lastSeparatorIndex = content.lastIndexOf('\n---\n');
    if (lastSeparatorIndex === -1 || lastSeparatorIndex < state.lastProcessedByte) {
        return state;
    }

    const processTo = lastSeparatorIndex + 5;
    const newContent = content.slice(state.lastProcessedByte, processTo);
    const findings = parseNewFindings(newContent);
    let processedCount = 0;
    
    for (const { block, title } of findings) {
        const fp = fingerprint(block);
        const semanticFp = semanticFingerprint(title);
        
        // Skip if already processed by exact content
        if (state.processedFingerprints.includes(fp)) continue;
        
        // Skip if semantically similar title already processed (dedup)
        if (state.processedTitles.includes(semanticFp)) {
            log(`Skipping duplicate (semantic): "${title}"`);
            state.processedFingerprints.push(fp); // Mark as handled
            processedCount++;
            continue;
        }

        // EMERGENCY STOP: Kill process if we hit a 429
        try {
            const errorLog = fs.readFileSync('/root/FutureOfDev/opencode/.run/telemetry_error.log', 'utf8');
            if (errorLog.includes('error_code:429')) {
                const logs = errorLog.split('\n').filter(l => l.trim());
                const lastError = logs[logs.length - 1];
                if (lastError.includes('429')) {
                    log("CRITICAL: Telegram 429 detected. EMERGENCY STOP triggered.");
                    process.exit(1);
                }
            }
        } catch(e) {}

        totalFindings++;
        const findingId = ledger.addFinding({
            title,
            severity: 'MEDIUM',
            description: block,
            url: 'http://localhost:5173',
            screenshot: null
        }, 'universal-explorer');
        
        // Mark as pending
        state.findingStates[findingId] = { status: 'pending', title, startedAt: new Date().toISOString() };
        
        log(`New finding [${findingId}]: "${title}". Triggering Agency...`);
        
        // Update player dashboard
        try {
            updatePlayerDashboard({
                latestThought: `Detected friction: "${title}"`,
                metrics: { loops: totalFindings }
            });
        } catch(e) {}

        // Notify Telegram
        await new Promise(r => setTimeout(r, 1500));
        try {
            sendFinding(findingId, 'NEW');
        } catch(e) {
            log(`Telegram notify error: ${e.message}`);
        }
        
        const taskDescription = `[FINDING_ID: ${findingId}]\n\nAddress the following UX finding from the Player explorer.\n\n${block}`;
        const beforeRun = Date.now();
        
        const exitCode = await runAgency(taskDescription, config.workspace);
        totalRuns++;
        lastRunAt = new Date().toISOString();
        
        // V17.0 FIX: Honest status reporting - don't claim FIXED unless verified
        if (exitCode === 0) {
            // Agency completed AND made verified changes
            state.findingStates[findingId].status = 'fixed';
            state.findingStates[findingId].fixedAt = new Date().toISOString();
            state.findingStates[findingId].exitCode = exitCode;
            state.findingStates[findingId].hasChanges = true;
            log(`Finding [${findingId}] marked as FIXED with verified changes`);
        } else if (exitCode === 2) {
            // Agency completed but NO changes were made (V17.0 honest reporting)
            state.findingStates[findingId].status = 'processed_no_changes';
            state.findingStates[findingId].processedAt = new Date().toISOString();
            state.findingStates[findingId].exitCode = exitCode;
            state.findingStates[findingId].hasChanges = false;
            log(`Finding [${findingId}] marked as PROCESSED_NO_CHANGES (exit=2, agents ran but made no edits)`);
        } else {
            state.findingStates[findingId].status = 'failed';
            state.findingStates[findingId].failedAt = new Date().toISOString();
            state.findingStates[findingId].exitCode = exitCode;
            log(`Finding [${findingId}] marked as FAILED (exit ${exitCode})`);
        }
        
        appendFeedback(title, exitCode, lastRunAt);
        
        // Track both fingerprints to prevent re-processing
        state.processedFingerprints.push(fp);
        state.processedTitles.push(semanticFp);
        processedCount++;
        
        // BREAK: Only process ONE finding per cycle (respects MIN_RUN_INTERVAL_MS)
        break;
    }

    state.lastProcessedByte = processTo;
    saveState(state);
    
    if (processedCount > 0) {
        log(`Processed ${processedCount} findings this cycle. Total pending: ${Object.values(state.findingStates).filter(s => s.status === 'pending').length}`);
    }
    
    return state;
}

async function main() {
    const config = loadConfig();
    const pollMs = config.pollMs || POLL_MS;
    const once = process.argv.includes('--once');
    const healthPort = process.argv.includes('--health-port') 
        ? parseInt(process.argv[process.argv.indexOf('--health-port') + 1]) 
        : null;

    if (healthPort) startHealthServer(healthPort);

    log(`Watching ${FINDINGS_FILE} (poll ${pollMs}ms). Workspace: ${config.workspace}`);
    log(`Agency: ${AGENCY_BIN}. Feedback for Player: ${FEEDBACK_FILE}`);
    if (once) log('Single run (--once): process new findings, trigger Agency, then exit.');

    let state = loadState();
    if (state.lastProcessedByte === 0 && fs.existsSync(FINDINGS_FILE)) {
        state.lastProcessedByte = fs.statSync(FINDINGS_FILE).size;
        saveState(state);
        log('Initialized: only new findings (after this point) will trigger Agency.');
    }

    // Graceful shutdown handling
    const shutdown = () => {
        log('Shutting down...');
        if (healthServer) healthServer.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('unhandledRejection', (err) => {
        console.error('[watcher] Unhandled rejection:', err);
    });

    if (once) {
        state = await poll(config, state);
        log('Done.');
        shutdown();
    }

    for (;;) {
        try {
            state = await poll(config, state);
        } catch (e) {
            log(`Poll error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, pollMs));
    }
}

main().catch(err => {
    console.error('[watcher] Fatal:', err);
    process.exit(1);
});
