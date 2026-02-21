const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const AGENCY_ROOT = __dirname;
const ORCHESTRATOR_PATH = path.join(AGENCY_ROOT, 'orchestrator.cjs');
const CHRONOS_PATH = path.join(AGENCY_ROOT, 'chronos.cjs');

const CONFIG = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'config.json'), 'utf8'));
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: allowedChatId } = CONFIG;

if (!token) {
    console.error('[TG-CONTROL] Missing TELEGRAM_BOT_TOKEN in config.json');
    process.exit(1);
}

function log(msg) {
    console.log(`[TG-CONTROL][${new Date().toISOString()}] ${msg}`);
}

function sendMessage(chatId, text) {
    spawn('curl', ['-s', '-X', 'POST', `https://api.telegram.org/bot${token}/sendMessage`, '-d', `chat_id=${chatId}`, '--data-urlencode', `text=${text}`], { stdio: 'ignore' });
}

function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function getPidByName(filePath) {
    try {
        const stdout = spawn('bash', ['-c', `ps aux | grep "[n]ode ${filePath}" | awk '{print $2}'`]).output?.toString() || '';
        return stdout.trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

function startOrchestrator() {
    const pids = getPidByName(ORCHESTRATOR_PATH);
    if (pids.length > 0) return { success: false, message: `Orchestrator already running (PIDs: ${pids.join(', ')})` };

    const out = fs.openSync(path.join(AGENCY_ROOT, '.run', 'nohup.out'), 'a');
    const err = fs.openSync(path.join(AGENCY_ROOT, '.run', 'nohup.out'), 'a');
    const child = spawn('node', [ORCHESTRATOR_PATH], {
        detached: true,
        stdio: ['ignore', out, err],
        cwd: AGENCY_ROOT
    });
    child.unref();
    return { success: true, message: `Orchestrator started (PID: ${child.pid})` };
}

function startChronos() {
    const pids = getPidByName(CHRONOS_PATH);
    if (pids.length > 0) return { success: false, message: `Chronos already running (PIDs: ${pids.join(', ')})` };

    const out = fs.openSync(path.join(AGENCY_ROOT, '.run', 'chronos.out'), 'a');
    const err = fs.openSync(path.join(AGENCY_ROOT, '.run', 'chronos.out'), 'a');
    const child = spawn('node', [CHRONOS_PATH], {
        detached: true,
        stdio: ['ignore', out, err],
        cwd: AGENCY_ROOT
    });
    child.unref();
    return { success: true, message: `Chronos started (PID: ${child.pid})` };
}

function stopProcess(filePath) {
    const pids = getPidByName(filePath);
    if (pids.length === 0) return { success: false, message: `${filePath.split('/').pop()} not running` };

    pids.forEach(pid => {
        try { process.kill(pid, 'SIGKILL'); } catch (e) {}
    });
    return { success: true, message: `Stopped ${pids.length} instance(s)` };
}

function getStatus() {
    const orchPids = getPidByName(ORCHESTRATOR_PATH);
    const chronosPids = getPidByName(CHRONOS_PATH);
    
    let status = `🖥️ *Agency Status*\n\n`;
    status += `Orchestrator: ${orchPids.length > 0 ? `🟢 RUNNING (PIDs: ${orchPids.join(', ')})` : '🔴 STOPPED'}\n`;
    status += `Chronos: ${chronosPids.length > 0 ? `🟢 RUNNING (PIDs: ${chronosPids.join(', ')})` : '🔴 STOPPED'}`;
    
    // Check tasks.json
    try {
        const tasks = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'tasks.json'), 'utf8')).tasks;
        const pending = tasks.filter(t => t.status === 'pending').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const blocked = tasks.filter(t => t.status === 'blocked').length;
        status += `\n\n📊 *Task Summary*\n`;
        status += `⏳ Pending: ${pending}\n`;
        status += `🏃 In Progress: ${inProgress}\n`;
        status += `✅ Completed: ${completed}\n`;
        status += `🚫 Blocked: ${blocked}`;
    } catch (e) {
        status += `\n\n⚠️ Could not read tasks.json`;
    }
    
    return status;
}

// Main Telegram polling loop (long polling)
let offset = 0;

async function pollTelegram() {
    try {
        const response = await spawn('curl', ['-s', `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`], { shell: true }).output?.toString() || '{}';
        const data = JSON.parse(response);
        
        if (data.ok && data.result) {
            data.result.forEach(update => {
                offset = update.update_id + 1;
                if (update.message && update.message.text) {
                    handleCommand(update.message.chat.id, update.message.text);
                }
            });
        }
    } catch (e) {
        log(`Poll error: ${e.message}`);
    }
    
    setTimeout(pollTelegram, 1000);
}

function handleCommand(chatId, text) {
    log(`Command from ${chatId}: ${text}`);
    
    // Restrict to authorized chat
    if (allowedChatId && chatId != allowedChatId) {
        sendMessage(chatId, `⛔ Unauthorized. Chat ID: ${chatId}`);
        return;
    }
    
    const command = text.trim().toLowerCase();
    let response = '';
    
    switch (command) {
        case '/agency_start':
        case '/start':
            const orchStart = startOrchestrator();
            const chronosStart = startChronos();
            response = `🚀 *Agency Starting...*\n${orchStart.message}\n${chronosStart.message}\n\nMonitor: /status | Logs: /logs`;
            break;
            
        case '/agency_stop':
        case '/stop':
            const orchStop = stopProcess(ORCHESTRATOR_PATH);
            const chronosStop = stopProcess(CHRONOS_PATH);
            response = `🛑 *Agency Stop*\n${orchStop.message}\n${chronosStop.message}`;
            break;
            
        case '/agency_status':
        case '/status':
            response = getStatus();
            break;
            
        case '/agency_restart':
        case '/restart':
            stopProcess(ORCHESTRATOR_PATH);
            stopProcess(CHRONOS_PATH);
            setTimeout(() => {
                const orchStart2 = startOrchestrator();
                const chronosStart2 = startChronos();
                sendMessage(chatId, `🔄 *Agency Restart*\n${orchStart2.message}\n${chronosStart2.message}`);
            }, 2000);
            response = '⏳ Restarting...';
            break;
            
        case '/agency_logs':
        case '/logs':
            try {
                const logTail = spawn('bash', ['-c', `tail -n 50 ${AGENCY_ROOT}/.run/agency.log`]).output?.toString() || 'No logs';
                response = `📋 *Recent Agency Logs*:\n\`\`\`\n${logTail.substring(0, 3000)}\n\`\`\``;
            } catch (e) {
                response = `❌ Could not fetch logs: ${e.message}`;
            }
            break;
            
        case '/help':
            response = `🛠️ *Agency Control Commands*\n\n/start - Start Orchestrator + Chronos\n/stop - Stop all agents\n/restart - Full restart\n/status - Show runtime status\n/logs - Recent agency logs\n/help - This message`;
            break;
            
        default:
            response = `❓ Unknown command.\nAvailable: /start, /stop, /restart, /status, /logs, /help`;
    }
    
    sendMessage(chatId, response);
}

log('🚀 Telegram Control Bot starting...');
if (!allowedChatId) log('⚠️ WARNING: No TELEGRAM_CHAT_ID set - accepting commands from any chat (INSECURE)');
pollTelegram();
