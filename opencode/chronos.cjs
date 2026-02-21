const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * CHRONOS V2.0 (The Complete Guardian)
 * Features: 
 * - Stall Detection & Auto-Healing
 * - Log Rotation (30 line cap on main logs)
 * - Agent Log Purge (Delete logs > 24h)
 * - Process Zombie Slaying
 * - Disk Space Monitoring
 */

const AGENCY_ROOT = '/root/FutureOfDev/opencode';
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
const LOG_PATH = path.join(RUN_DIR, 'agency.log');
const HEAL_LOG = path.join(RUN_DIR, 'chronos_healing.log');
const STOP_FLAG = path.join(RUN_DIR, 'CHRONOS_DISABLED');

const CONFIG = {
    MAX_LOG_LINES: 30,
    STALL_THRESHOLD_MS: 300000,     // 5 minutes
    LOG_MAX_AGE_HOURS: 24,
    DISK_WARNING_THRESHOLD: 90      // % usage
};

function log(msg) {
    const line = `[CHRONOS][${new Date().toISOString()}] ${msg}`;
    console.log(line);
    if (fs.existsSync(HEAL_LOG)) fs.appendFileSync(HEAL_LOG, line + '\n');
    rotateLog(HEAL_LOG);
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
            if (file.endsWith('.log') && file !== 'agency.log' && file !== 'chronos_healing.log') {
                const filePath = path.join(RUN_DIR, file);
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    purged++;
                }
            }
        }
        if (purged > 0) log(`🧹 Purged ${purged} old agent logs (>24h).`);
    } catch (e) {
        log(`⚠️ Log purge error: ${e.message}`);
    }
}

function slayZombieProcesses() {
    try {
        // Kill duplicate telegram-control instances (keep newest)
        const out = execSync("pgrep -f 'telegram-control.cjs' | sort -n | head -n -1").toString().trim();
        if (out) {
            const pids = out.split('\n').filter(p => p);
            for (const pid of pids) {
                try {
                    process.kill(parseInt(pid), 'SIGKILL');
                    log(`🗡️ Slayed zombie telegram-control PID ${pid}`);
                } catch (e) {}
            }
        }
        
        // Kill any hanging curl processes older than 60s
        execSync("pkill -9 -f 'curl.*telegram.org.*timeout' 2>/dev/null || true");
    } catch (e) {}
}

function checkDiskSpace() {
    try {
        const out = execSync("df -h / | tail -1 | awk '{print $5}' | tr -d '%'").toString().trim();
        const usage = parseInt(out);
        if (usage > CONFIG.DISK_WARNING_THRESHOLD) {
            log(`🚨 DISK WARNING: ${usage}% usage detected!`);
        }
    } catch (e) {}
}

function checkStall() {
    if (fs.existsSync(STOP_FLAG)) {
        log("🛑 Safety Lock engaged. Chronos standing down.");
        return;
    }

    if (!fs.existsSync(LOG_PATH)) return;
    
    rotateLog(LOG_PATH);
    purgeOldAgentLogs();
    slayZombieProcesses();
    checkDiskSpace();

    const stats = fs.statSync(LOG_PATH);
    const lastUpdate = stats.mtimeMs;
    const now = Date.now();
    const diff = now - lastUpdate;

    if (diff > CONFIG.STALL_THRESHOLD_MS) {
        log(`🚨 STALL DETECTED (${Math.round(diff/1000)}s since last activity)`);
        
        try {
            execSync('pgrep -f "orchestrator.cjs" | xargs kill -9 2>/dev/null || true');
            const child = require('child_process').spawn('node', [path.join(AGENCY_ROOT, 'orchestrator.cjs')], {
                detached: true,
                stdio: 'ignore',
                cwd: AGENCY_ROOT
            });
            child.unref();
            log(`✅ Orchestrator Resurrected (PID: ${child.pid})`);
        } catch (e) {
            log(`❌ Resurrection Failed: ${e.message}`);
        }
    }
}

// Ensure log directory exists
if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });

log("Chronos V2.0 (Complete Guardian) Initialized.");
log("Features: Log Rotation, Agent Log Purge, Zombie Slaying, Disk Monitor.");

// Immediate cleanup on start
purgeOldAgentLogs();
slayZombieProcesses();

setInterval(checkStall, 60000);
checkStall();