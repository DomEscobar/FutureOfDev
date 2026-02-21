const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * CHRONOS V1.5 (The Resource Guardian)
 * Features: Stall Detection, Auto-Healing, AND Log Rotation (30 line cap).
 */

const AGENCY_ROOT = '/root/FutureOfDev/opencode';
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const HEAL_LOG = path.join(AGENCY_ROOT, '.run', 'chronos_healing.log');
const STOP_FLAG = path.join(AGENCY_ROOT, '.run', 'CHRONOS_DISABLED');

const MAX_LOG_LINES = 30;
const STALL_THRESHOLD_MS = 300000; // 5 minutes

function log(msg) {
    const line = `[CHRONOS][${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(HEAL_LOG, line + '\n');
    rotateLog(HEAL_LOG);
}

function rotateLog(filePath) {
    if (!fs.existsSync(filePath)) return;
    try {
        const content = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
        if (content.length > MAX_LOG_LINES) {
            const kept = content.slice(-MAX_LOG_LINES);
            fs.writeFileSync(filePath, kept.join('\n') + '\n');
        }
    } catch (e) {}
}

function checkStall() {
    if (fs.existsSync(STOP_FLAG)) return;

    if (!fs.existsSync(LOG_PATH)) return;
    
    rotateLog(LOG_PATH); // Keep agency log lean

    const stats = fs.statSync(LOG_PATH);
    const lastUpdate = stats.mtimeMs;
    const now = Date.now();
    const diff = now - lastUpdate;

    if (diff > STALL_THRESHOLD_MS) {
        log(`🚨 CRITICAL FAILURE DETECTED: STALL (${Math.round(diff)}ms)`);
        
        try {
            execSync('pgrep -f "orchestrator.cjs" | xargs kill -9 || true');
            const child = require('child_process').spawn('node', [path.join(AGENCY_ROOT, 'orchestrator.cjs')], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
            log(`✅ Orchestrator Resurrected. (PID: ${child.pid})`);
        } catch (e) {
            log(`❌ Resurrection Failed: ${e.message}`);
        }
    }
}

log("Chronos V1.5 (Resource Guardian) Initialized. Log cap: 30 lines.");
setInterval(checkStall, 60000); // Check every minute
checkStall();
