const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * TELEGRAM CONTROL BOT (V2.0)
 * Specialized for deep agency management and loop recovery.
 */

const AGENCY_ROOT = __dirname;
const ORCHESTRATOR_PATH = path.join(AGENCY_ROOT, 'orchestrator.cjs');
const CHRONOS_PATH = path.join(AGENCY_ROOT, 'chronos.cjs');
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const STOP_FLAG = path.join(AGENCY_ROOT, '.run', 'CHRONOS_DISABLED');

const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: allowedChatId } = CONFIG;

if (!token) {
    console.error('[TG-CONTROL] Missing TELEGRAM_BOT_TOKEN in config.json');
    process.exit(1);
}

function log(msg) {
    console.log(`[TG-CONTROL][${new Date().toISOString()}] ${msg}`);
}

function sendMessage(chatId, text) {
    const safeText = text.replace(/'/g, '').substring(0, 4000);
    spawn('curl', ['-s', '-o', '/dev/null', '-X', 'POST', `https://api.telegram.org/bot${token}/sendMessage`, '-d', `chat_id=${chatId}`, '--data-urlencode', `text=${safeText}`], { stdio: 'ignore' });
}

function getPids() {
    try {
        const stdout = execSync('ps aux | grep -E "node /root/FutureOfDev/opencode/.*.cjs" | grep -v grep | awk "{print $2, $11, $12}"').toString();
        return stdout.trim();
    } catch { return "None"; }
}

function startOrchestrator() {
    // Force remove stop flag if starting
    if (fs.existsSync(STOP_FLAG)) fs.unlinkSync(STOP_FLAG);
    
    const out = fs.openSync(path.join(AGENCY_ROOT, '.run', 'nohup.out'), 'a');
    const err = fs.openSync(path.join(AGENCY_ROOT, '.run', 'nohup.out'), 'a');
    const child = spawn('node', [ORCHESTRATOR_PATH], {
        detached: true,
        stdio: ['ignore', out, err],
        cwd: AGENCY_ROOT
    });
    child.unref();
    return child.pid;
}

function startChronos() {
    const out = fs.openSync(path.join(AGENCY_ROOT, '.run', 'chronos.out'), 'a');
    const err = fs.openSync(path.join(AGENCY_ROOT, '.run', 'chronos.out'), 'a');
    const child = spawn('node', [CHRONOS_PATH], {
        detached: true,
        stdio: ['ignore', out, err],
        cwd: AGENCY_ROOT
    });
    child.unref();
    return child.pid;
}

function stopAll() {
    fs.writeFileSync(STOP_FLAG, 'Manual Stop');
    try { execSync('pkill -f "node /root/FutureOfDev/opencode/orchestrator.cjs"'); } catch(e){}
    try { execSync('pkill -f "node /root/FutureOfDev/opencode/chronos.cjs"'); } catch(e){}
}

function getStatusSummary() {
    let msg = "📊 Agency Briefing\n----------------\n";
    const pids = getPids();
    msg += `Processes:\n${pids || "All Stopped"}\n\n`;
    msg += `Safety Lock: ${fs.existsSync(STOP_FLAG) ? "🔴 ENGAGED" : "🟢 DISENGAGED"}\n\n`;
    
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        const active = data.tasks.filter(t => t.status !== 'completed' && t.status !== 'blocked').length;
        const blocked = data.tasks.filter(t => t.status === 'blocked').length;
        msg += `Tasks:\n- Active: ${active}\n- Blocked: ${blocked}\n- Total: ${data.tasks.length}\n`;
    } catch(e) {}
    
    return msg;
}

let offset = 0;
async function poll() {
    try {
        const res = execSync(`curl -s "https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=10"`).toString();
        const data = JSON.parse(res);
        if (data.ok) {
            for (const update of data.result) {
                offset = update.update_id + 1;
                if (update.message && update.message.text && update.message.chat.id == allowedChatId) {
                    handle(update.message.chat.id, update.message.text);
                }
            }
        }
    } catch(e) {}
    setTimeout(poll, 1000);
}

function handle(chatId, text) {
    const parts = text.split(' ');
    const cmd = parts[0].toLowerCase();
    
    if (cmd === '/status') {
        sendMessage(chatId, getStatusSummary());
    } else if (cmd === '/stop') {
        stopAll();
        sendMessage(chatId, "🛑 Full Shutdown Executed. Chronos Disabled.");
    } else if (cmd === '/start') {
        const opid = startOrchestrator();
        const cpid = startChronos();
        sendMessage(chatId, `🚀 Engine Started.\n- Orchestrator: ${opid}\n- Chronos: ${cpid}`);
    } else if (cmd === '/unblock') {
        const tid = parts[1];
        if (!tid) return sendMessage(chatId, "Usage: /unblock <task-id>");
        try {
            const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
            const task = data.tasks.find(t => t.id === tid);
            if (task) {
                task.status = 'pending';
                task.retry_count = 0;
                fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));
                sendMessage(chatId, `🔓 Unblocked ${tid}. Set to pending.`);
            } else {
                sendMessage(chatId, `❌ Task ${tid} not found.`);
            }
        } catch(e) { sendMessage(chatId, "Error unblocking."); }
    } else if (cmd === '/logs') {
        try {
            const log = execSync('tail -n 20 ' + path.join(AGENCY_ROOT, '.run', 'agency.log')).toString();
            sendMessage(chatId, `📋 Latest Logs:\n${log}`);
        } catch(e) { sendMessage(chatId, "Could not fetch logs."); }
    } else if (cmd === '/top') {
        sendMessage(chatId, `🔝 Active Nodes:\n${getPids()}`);
    } else if (cmd === '/op' || cmd === '/run') {
        const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
        const subCommand = parts.slice(1).join(' ');
        if (!subCommand) return sendMessage(chatId, "Usage: /op <command>");
        
        sendMessage(chatId, `⏳ Executing: opencode ${subCommand}...`);
        try {
            const out = execSync(`${opencodeBin} ${subCommand}`).toString();
            sendMessage(chatId, `✅ Output:\n\`\`\`\n${out.substring(0, 3500)}\n\`\`\``);
        } catch (e) {
            sendMessage(chatId, `❌ Error:\n\`\`\`\n${e.stdout?.toString() || e.message}\n\`\`\``);
        }
    } else if (cmd === '/agents') {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'opencode.json'), 'utf8'));
            let msg = "🤖 Configured Agents:\n";
            for (const [name, config] of Object.entries(data.agent)) {
                msg += `- ${name}: \`${config.model}\`\n`;
            }
            sendMessage(chatId, msg);
        } catch (e) { sendMessage(chatId, "Error reading agents."); }
    } else if (cmd === '/setmodel') {
        const agent = parts[1];
        const model = parts[2];
        if (!agent || !model) return sendMessage(chatId, "Usage: /setmodel <agent> <provider/model>");
        try {
            const opjson = path.join(AGENCY_ROOT, 'opencode.json');
            const data = JSON.parse(fs.readFileSync(opjson, 'utf8'));
            if (!data.agent[agent]) return sendMessage(chatId, `❌ Agent "${agent}" not found.`);
            
            data.agent[agent].model = model;
            fs.writeFileSync(opjson, JSON.stringify(data, null, 2));
            sendMessage(chatId, `✅ Updated ${agent} to use \`${model}\`.`);
        } catch (e) { sendMessage(chatId, "Error updating model."); }
    } else {
        sendMessage(chatId, "🛠 Commands:\n/status, /start, /stop, /unblock <id>, /logs, /top, /run <cmd>, /agents, /setmodel <agent> <model>");
    }
}

log("Telegram Management Core V2.0 initialized.");
poll();
