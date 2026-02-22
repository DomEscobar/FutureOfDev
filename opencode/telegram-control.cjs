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
const SUGGESTIONS_PATH = path.join(AGENCY_ROOT, 'SUGGESTIONS.md');
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
        const stdout = execSync(`ps aux | grep -E "node ${AGENCY_ROOT}/.*.cjs" | grep -v grep | awk "{print $2, $11, $12}"`).toString();
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
    try { execSync(`pkill -f "node ${ORCHESTRATOR_PATH}"`); } catch(e){}
    try { execSync(`pkill -f "node ${CHRONOS_PATH}"`); } catch(e){}
    try { execSync(`pkill -f "node ${AGENCY_ROOT}/dev-unit.cjs"`); } catch(e){}
    try { execSync(`pkill -f "opencode run"`); } catch(e){}
    try { execSync(`pkill -f "node.*dev-unit"`); } catch(e){}
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
                    await handle(update.message.chat.id, update.message.text);
                }
            }
        }
    } catch(e) {}
    setTimeout(poll, 1000);
}

async function handle(chatId, text) {
    // Strip bot username if present (e.g. /status@my_bot -> /status)
    const rawText = text.replace(/@\w+_bot/g, '');
    const parts = rawText.split(' ');
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
    } else if (cmd === '/reset') {
        if (parts[1] !== 'confirm') {
            return sendMessage(chatId, "⚠️ *DANGER ZONE*\nThis will wipe all tasks, contexts, and logs.\nTo proceed, type: `/reset confirm`.");
        }
        
        try {
            // 1. Stop processes
            stopAll();
            // 2. Run reset script using node
            const out = execSync(`node ${path.join(AGENCY_ROOT, 'reset.cjs')}`).toString();
            sendMessage(chatId, `🧹 *Agency Reset Complete*\n\`\`\`\n${out}\n\`\`\`\nAgency stopped. Use /start to begin a fresh run.`);
        } catch (e) {
            sendMessage(chatId, `❌ Reset failed: ${e.message}`);
        }
    } else if (cmd === '/logs') {
        try {
            const log = execSync('tail -n 20 ' + path.join(AGENCY_ROOT, '.run', 'agency.log')).toString();
            sendMessage(chatId, `📋 Latest Logs:\n${log}`);
        } catch(e) { sendMessage(chatId, "Could not fetch logs."); }
    } else if (cmd === '/workdir' || cmd === '/workspace') {
        const newPath = parts[1];
        if (!newPath) {
            try {
                const conf = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
                return sendMessage(chatId, `📂 Current Workspace: \`${conf.PROJECT_WORKSPACE || "/root/Playground_AI_Dev"}\``);
            } catch(e) { return sendMessage(chatId, "Error reading workspace config."); }
        }
        
        try {
            const conf = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            conf.PROJECT_WORKSPACE = newPath;
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(conf, null, 2));
            sendMessage(chatId, `✅ Workspace updated to: \`${newPath}\`. Restarting orchestrator to apply...`);
            
            // Restart orchestrator
            try { execSync(`pkill -f "node ${ORCHESTRATOR_PATH}"`); } catch(e){}
            setTimeout(() => startOrchestrator(), 1000);
        } catch(e) { sendMessage(chatId, "Error updating workspace."); }
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
    } else if (cmd === '/suggest') {
        const suggestion = parts.slice(1).join(' ');
        if (!suggestion) return sendMessage(chatId, "Usage: /suggest <your idea/instruction>");
        
        try {
            const entry = `\n- [${new Date().toISOString()}] ${suggestion}`;
            fs.appendFileSync(SUGGESTIONS_PATH, entry);
            sendMessage(chatId, "💡 Suggestion recorded. PM Agent is analyzing...");
            
            // Trigger PM agent to process the suggestion
            const pm = require('./pm.cjs');
            const tasksData = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
            const result = await pm.processSuggestion(suggestion, tasksData.tasks);
            
            if (result) {
                tasksData.tasks.push(result.parent);
                if (result.subtasks && result.subtasks.length > 0) {
                    tasksData.tasks.push(...result.subtasks);
                }
                fs.writeFileSync(TASKS_PATH, JSON.stringify(tasksData, null, 2));
                
                // Mark as planned in SUGGESTIONS.md
                const suggestions = fs.readFileSync(SUGGESTIONS_PATH, 'utf8');
                const newContent = suggestions.replace(entry, `${entry.slice(0, -suggestion.length)}[PLANNED] ${suggestion}`);
                fs.writeFileSync(SUGGESTIONS_PATH, newContent);
                
                sendMessage(chatId, `✅ *PM TASK CREATED*\nID: \`${result.parent.id}\`\nTitle: _${result.parent.title}_\nFiles: ${result.parent.files?.length || 0}`);
            }
        } catch (e) {
            sendMessage(chatId, `❌ Error: ${e.message}`);
        }
    } else if (cmd === '/op_setmodel') {
        const model = parts[1];
        if (!model) return sendMessage(chatId, "Usage: /op_setmodel <provider/model>");
        const bin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
        
        sendMessage(chatId, `⏳ Passthrough: Setting opencode default model to \`${model}\`...`);
        try {
            // Correct opencode CLI syntax for global model override usually involves 'agent config' or similar depending on version
            const out = execSync(`${bin} agent config set model ${model}`).toString();
            sendMessage(chatId, `✅ Pass-through Output:\n\`\`\`\n${out}\n\`\`\``);
        } catch (e) {
            sendMessage(chatId, `❌ Pass-through Error:\n\`\`\`\n${e.stdout?.toString() || e.message}\n\`\`\``);
        }
    } else if (cmd === '/listmodels' || cmd === '/models') {
        const provider = parts[1];
        const bin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
        // Force neutral directory to avoid broken workspace plugins
        const cmdStr = provider ? `cd /tmp && ${bin} models ${provider}` : `cd /tmp && ${bin} models`;
        
        sendMessage(chatId, `🔍 Fetching available models${provider ? ` for ${provider}` : ''}...`);
        try {
            const out = execSync(cmdStr).toString();
            sendMessage(chatId, `📋 Available Models:\n\`\`\`\n${out.substring(0, 3500)}\n\`\`\``);
        } catch (e) {
            sendMessage(chatId, `❌ Error:\n\`\`\`\n${e.stdout?.toString() || e.message}\n\`\`\``);
        }
    } else if (cmd === '/help') {
        let help = "🛠 *Agency Command & Control v2.5*\n\n";
        help += "📊 *Surveillance*\n";
        help += "/status - Briefing on logic lock & tasks\n";
        help += "/top - Real-time process tree\n";
        help += "/logs - Last 20 lines of telemetry\n";
        help += "/workspace [path] - Get/Set current work directory\n";
        help += "/agents - List roster & active models\n";
        help += "/models [provider] - List available models\n\n";
        help += "⚡ *Operations*\n";
        help += "/start - Engage engine & Chronos\n";
        help += "/stop - Engage Safety Lock & kill agents\n";
        help += "/unblock <id> - Rescue a thrashing task\n";
        help += "/reset confirm - Wipe all tasks & factory reset\n\n";
        help += "🤖 *Intelligence*\n";
        help += "/suggest <text> - Send instructions to CEO/PM\n";
        help += "/setmodel <agent> <model> - Local agent swap\n";
        help += "/op_setmodel <model> - Pass-through CLI swap\n";
        help += "/run <cmd> - Direct opencode pass-through\n";
        sendMessage(chatId, help);
    } else if (cmd.startsWith('/')) {
        sendMessage(chatId, "🛠 Unknown command. Use /help to see all available options.");
    }
}

log("Telegram Management Core V2.0 initialized.");
poll();
