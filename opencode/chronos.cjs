const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

/**
 * CHRONOS SUPER-OBSERVER (V1.0)
 * Role: Meta-Agent for Autonomous Agency Healing
 * Target: /root/FutureOfDev/opencode/orchestrator.cjs
 */

const AGENCY_ROOT = __dirname;
const ORCHESTRATOR_PATH = path.join(AGENCY_ROOT, 'orchestrator.cjs');
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const HEAL_LOG = path.join(AGENCY_ROOT, '.run', 'chronos_healing.log');

const CONFIG = {
    STALL_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes without log update
    LOOP_THRESHOLD: 4,               // Max repeated dispatches for same task/agent
    RETRY_LIMIT: 5                   // Global task retry limit before forcing block
};

const STOP_FLAG = path.join(AGENCY_ROOT, '.run', 'CHRONOS_DISABLED'); // Graceful shutdown flag

function sendTelegram(message) {
    try {
        const config = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'config.json'), 'utf8'));
        const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = config;
        if (!token || !chatId) return;
        const truncated = message.replace(/'/g, '').substring(0, 400); 
        spawn('curl', ['-s', '-X', 'POST', `https://api.telegram.org/bot${token}/sendMessage`, '-d', `chat_id=${chatId}`, '--data-urlencode', `text=${truncated}`], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) {}
}

function log(msg) {
    const line = `[CHRONOS][${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(HEAL_LOG, line + '\n');
    if (msg.includes('🚨') || msg.includes('✅')) {
        sendTelegram(`🕵️‍♂️ [CHRONOS META-AGENT]\n${msg}`);
    }
}

function healOrchestrator(issue, detail) {
    log(`🚨 CRITICAL FAILURE DETECTED: ${issue}`);
    log(`Detail: ${detail}`);

    let code = fs.readFileSync(ORCHESTRATOR_PATH, 'utf8');

    if (issue === 'LOGIC_LOOP') {
        log("Applying Logic Loop Circuit Breaker...");
        // Inject a dynamic block for thrashing tasks
        if (!code.includes('// CHRONOS: Loop Protection')) {
            const injection = `
        // CHRONOS: Loop Protection
        if (task.retry_count > ${CONFIG.LOOP_THRESHOLD}) {
            log(\`[CHRONOS BLOCK] Task \${id} is thrashing. Marking as blocked.\`);
            updateTask(id, { status: 'blocked', description: (task.description || '') + '\\n\\nBlocked by Chronos: Detected infinite logic loop.' });
            return;
        }
`;
            code = code.replace('const id = task.id;', 'const id = task.id;' + injection);
        }
    }

    if (issue === 'STALL') {
        log("Force Restarting Stalled Orchestrator...");
        try {
            execSync(`ps aux | grep "[n]ode ${ORCHESTRATOR_PATH}" | awk '{print $2}' | xargs kill -9`);
        } catch (e) {}
    }

    fs.writeFileSync(ORCHESTRATOR_PATH, code);
    restartOrchestrator();
}

function restartOrchestrator() {
    if (fs.existsSync(STOP_FLAG)) {
        log("🛑 [HALT] Refusing to restart orchestrator: STOP_FLAG is set.");
        return;
    }
    log("🔄 Relaunching Orchestrator...");
    const out = fs.openSync(path.join(AGENCY_ROOT, '.run', 'nohup.out'), 'a');
    const err = fs.openSync(path.join(AGENCY_ROOT, '.run', 'nohup.out'), 'a');
    
    // Ensure old process is dead
    try { execSync(`pkill -f "node ${ORCHESTRATOR_PATH}"`); } catch(e) {}
    
    const child = spawn('node', [ORCHESTRATOR_PATH], {
        detached: true,
        stdio: ['ignore', out, err],
        cwd: AGENCY_ROOT
    });
    child.unref();
    log(`✅ Orchestrator started (PID: ${child.pid})`);
}

function monitor() {
    // Graceful shutdown: if stop flag exists, exit cleanly
    if (fs.existsSync(STOP_FLAG)) {
        log("[CHRONOS] Stop flag detected. Exiting gracefully.");
        process.exit(0);
    }

    if (!fs.existsSync(LOG_PATH)) return;

    // CHECK 1: STALL
    const stats = fs.statSync(LOG_PATH);
    const timeSinceLastUpdate = Date.now() - stats.mtimeMs;
    if (timeSinceLastUpdate > CONFIG.STALL_THRESHOLD_MS) {
        healOrchestrator('STALL', `${timeSinceLastUpdate}ms since last log entry.`);
        return;
    }

    // CHECK 2: LOGIC LOOPS
    const logs = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean).slice(-50);
    const dispatches = logs.filter(l => l.includes('[DISPATCH]'));
    
    const dispatchCounts = {};
    dispatches.forEach(d => {
        const parts = d.split(' ');
        const key = parts.slice(2).join(' '); // agent + task name
        dispatchCounts[key] = (dispatchCounts[key] || 0) + 1;
        if (dispatchCounts[key] >= CONFIG.LOOP_THRESHOLD) {
             healOrchestrator('LOGIC_LOOP', `Repeated dispatch: ${key}`);
             return;
        }
    });

    // CHECK 3: TASK INTEGRITY
    try {
        const tasks = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8')).tasks;
        tasks.forEach(t => {
            if (t.retry_count > CONFIG.RETRY_LIMIT && t.status !== 'blocked') {
                healOrchestrator('TASK_INTEGRITY', `Task ${t.id} exceeded global retry limit.`);
            }
        });
    } catch (e) {}
}

log("🛡️ CHRONOS SUPER-OBSERVER ACTIVATED.");
setInterval(monitor, 30000); // Audit every 30 seconds
monitor();
