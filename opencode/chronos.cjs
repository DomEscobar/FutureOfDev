const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * CHRONOS V2.5 (The Self-Sufficient Guardian)
 * 
 * Features:
 * - Stall Detection & Auto-Healing
 * - Log Rotation (30 line cap on main logs)
 * - Agent Log Purge (Runs EVERY cycle, not just on stall)
 * - Disk Space Monitoring
 * - Self-Start Orchestrator if not running
 */

const AGENCY_ROOT = __dirname;
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
const LOG_PATH = path.join(RUN_DIR, 'agency.log');
const HEAL_LOG = path.join(RUN_DIR, 'chronos_healing.log');
const STOP_FLAG = path.join(RUN_DIR, 'CHRONOS_DISABLED');

const CONFIG = {
    MAX_LOG_LINES: 30,
    STALL_THRESHOLD_MS: 300000,     // 5 minutes
    LOG_MAX_AGE_HOURS: 24,
    DISK_WARNING_THRESHOLD: 90,
    ORCHESTRATOR_CHECK_MS: 60000    // Check every minute
};

// Ensure directories and logs exist
if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });
if (!fs.existsSync(HEAL_LOG)) fs.writeFileSync(HEAL_LOG, '');

function log(msg) {
    const line = `[CHRONOS][${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(HEAL_LOG, line + '\n');
        rotateLog(HEAL_LOG);
    } catch (e) {}
}

function rotateLog(filePath) {
    if (!fs.existsSync(filePath)) return;
    try {
        const content = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
        if (content.length > CONFIG.MAX_LOG_LINES) {
            const kept = content.slice(-CONFIG.MAX_LOG_LINES);
            fs.writeFileSync(filePath, kept.join('\n') + '\n');
        }
    } catch (e) {}
}

function purgeOldAgentLogs() {
    if (!fs.existsSync(RUN_DIR)) return;
    
    const now = Date.now();
    const maxAgeMs = CONFIG.LOG_MAX_AGE_HOURS * 60 * 60 * 1000;
    let purged = 0;
    
    try {
        const files = fs.readdirSync(RUN_DIR);
        for (const file of files) {
            // Purge any .log file that's not agency.log or chronos_healing.log
            if (file.endsWith('.log') && file !== 'agency.log' && file !== 'chronos_healing.log') {
                const filePath = path.join(RUN_DIR, file);
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    purged++;
                }
            }
            // Also purge .out files
            if (file.endsWith('.out')) {
                const filePath = path.join(RUN_DIR, file);
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    purged++;
                }
            }
        }
        if (purged > 0) log(`🧹 Purged ${purged} old log files.`);
    } catch (e) {
        log(`⚠️ Log purge error: ${e.message}`);
    }
}

function checkDiskSpace() {
    try {
        const out = execSync("df -h / | tail -1 | awk '{print $5}' | tr -d '%'").toString().trim();
        const usage = parseInt(out);
        if (usage > CONFIG.DISK_WARNING_THRESHOLD) {
            log(`🚨 DISK WARNING: ${usage}% usage!`);
        }
        return usage;
    } catch (e) {
        return -1;
    }
}

function isOrchestratorRunning() {
    try {
        const out = execSync('pgrep -f "node.*orchestrator.cjs"').toString().trim();
        return out.length > 0;
    } catch (e) {
        return false;
    }
}

function startOrchestrator() {
    try {
        const child = require('child_process').spawn('node', [path.join(AGENCY_ROOT, 'orchestrator.cjs')], {
            detached: true,
            stdio: 'ignore',
            cwd: AGENCY_ROOT
        });
        child.unref();
        log(`✅ Orchestrator Started (PID: ${child.pid})`);
        return child.pid;
    } catch (e) {
        log(`❌ Failed to start orchestrator: ${e.message}`);
        return null;
    }
}

function checkStall() {
    // Check stop flag first
    if (fs.existsSync(STOP_FLAG)) {
        log("🛑 Safety Lock engaged. Standing down.");
        return;
    }

    // ALWAYS run these (not just on stall)
    rotateLog(LOG_PATH);
    purgeOldAgentLogs();
    checkDiskSpace();

    // Check if orchestrator is running
    if (!isOrchestratorRunning()) {
        log("⚠️ Orchestrator not running. Starting...");
        startOrchestrator();
        return;
    }

    // Check for stall (no activity in agency.log)
    if (fs.existsSync(LOG_PATH)) {
        const stats = fs.statSync(LOG_PATH);
        const lastUpdate = stats.mtimeMs;
        const now = Date.now();
        const diff = now - lastUpdate;

        if (diff > CONFIG.STALL_THRESHOLD_MS) {
            log(`🚨 STALL DETECTED (${Math.round(diff/1000)}s since last activity)`);
            
            try {
                execSync('pkill -f "node.*orchestrator.cjs" 2>/dev/null || true');
                startOrchestrator();
            } catch (e) {
                log(`❌ Recovery failed: ${e.message}`);
            }
        }
    }
}

// Initialize
log("========================================");
log("Chronos V2.5 (Self-Sufficient Guardian)");
log("========================================");
log("Features: Log Rotation, Auto-Purge, Disk Monitor, Auto-Start");

// Immediate actions on startup
purgeOldAgentLogs();
if (!isOrchestratorRunning()) {
    log("⚠️ Orchestrator not running at startup. Starting...");
    startOrchestrator();
}

// Main loop
setInterval(checkStall, CONFIG.ORCHESTRATOR_CHECK_MS);
checkStall();