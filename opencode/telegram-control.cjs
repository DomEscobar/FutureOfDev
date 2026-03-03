const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * TELEGRAM CONTROL BOT (V3.0)
 * Now with: per-finding message editing, global mute, diff viewing, notify command
 * Exit code 3 from agency = blocked (Checker/Medic/Skeptic BLOCKED or stuck); watcher sets finding state to 'blocked'.
 */

const AGENCY_ROOT = __dirname;
const ORCHESTRATOR_PATH = path.join(AGENCY_ROOT, 'orchestrator.cjs');
const CHRONOS_PATH = path.join(AGENCY_ROOT, 'chronos.cjs');
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const SUGGESTIONS_PATH = path.join(AGENCY_ROOT, 'SUGGESTIONS.md');
const STOP_FLAG = path.join(AGENCY_ROOT, '.run', 'CHRONOS_DISABLED');
const tg = require('./telegram');

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
    try { execSync(`pkill -f "opencode run"`); } catch(e){}
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

// Mute control
function setMute(minutes) {
    try {
        const mm = require('./mute-manager');
        mm.setGlobalMute(minutes);
        return `🔔 Global mute set for ${minutes} minutes.`;
    } catch (e) {
        return `❌ Mute error: ${e.message}`;
    }
}

function getMuteStatus() {
    try {
        const mm = require('./mute-manager');
        const state = mm.load();
        const muted = mm.isGloballyMuted();
        return `🔔 Notification Status:\nGlobal Mute: ${muted ? '🔇 MUTED' : '🔊 ACTIVE'}\n` + (state.global.until ? `Until: ${state.global.until}\n` : '');
    } catch (e) {
        return `❌ Mute status error: ${e.message}`;
    }
}

// Edit existing Telegram message
function editTelegramMessage(messageId, text, reply_markup = null) {
    try {
        const payload = {
            chat_id: allowedChatId,
            message_id: messageId,
            text: text,
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
            ...(reply_markup && { reply_markup: JSON.stringify(reply_markup) })
        };
        const payloadPath = path.join(AGENCY_ROOT, '.run', 'tg_edit_payload.json');
        fs.writeFileSync(payloadPath, JSON.stringify(payload));
        execSync(`curl -s -X POST "https://api.telegram.org/bot${token}/editMessageText" -H "Content-Type: application/json" -d @${payloadPath}`);
    } catch (e) {
        console.error('Edit failed:', e.message);
    }
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
                if (update.callback_query && update.callback_query.message && update.callback_query.message.chat.id == allowedChatId) {
                    await handleCallback(update.callback_query);
                }
            }
        }
    } catch(e) {}
    setTimeout(poll, 1000);
}

async function handle(chatId, text) {
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
            stopAll();
            const resetPath = path.join(AGENCY_ROOT, 'reset.cjs');
            if (!fs.existsSync(resetPath)) {
                return sendMessage(chatId, "🧹 Agency stopped. (reset.cjs not present; no wipe performed). Use /start to begin a fresh run.");
            }
            const out = execSync(`node ${resetPath}`).toString();
            sendMessage(chatId, `🧹 *Agency Reset Complete*\n\`\`\`\n${out}\n\`\`\`\nAgency stopped. Use /start to begin a fresh run.`);
        } catch (e) {
            sendMessage(chatId, `❌ Reset failed: ${e.message}`);
        }
    } else if (cmd === '/logs') {
        try {
            const logPath = path.join(AGENCY_ROOT, '.run', 'agency.log');
            const fallbackPath = path.join(AGENCY_ROOT, '.run', 'nohup.out');
            const f = fs.existsSync(logPath) ? logPath : fallbackPath;
            if (!fs.existsSync(f)) {
                return sendMessage(chatId, "No log file found (.run/agency.log or .run/nohup.out).");
            }
            const log = execSync('tail -n 20 ' + f).toString();
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
            const pmPath = path.join(AGENCY_ROOT, 'pm.cjs');
            if (!fs.existsSync(pmPath)) {
                return sendMessage(chatId, "Suggestion saved. (pm.cjs not present; no PM task created.)");
            }
            const pm = require('./pm.cjs');
            const tasksData = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
            const result = await pm.processSuggestion(suggestion, tasksData.tasks);
            if (result) {
                tasksData.tasks.push(result.parent);
                if (result.subtasks && result.subtasks.length > 0) {
                    tasksData.tasks.push(...result.subtasks);
                }
                fs.writeFileSync(TASKS_PATH, JSON.stringify(tasksData, null, 2));
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
            const out = execSync(`${bin} agent config set model ${model}`).toString();
            sendMessage(chatId, `✅ Pass-through Output:\n\`\`\`\n${out}\n\`\`\``);
        } catch (e) {
            sendMessage(chatId, `❌ Pass-through Error:\n\`\`\`\n${e.stdout?.toString() || e.message}\n\`\`\``);
        }
    } else if (cmd === '/listmodels' || cmd === '/models') {
        const provider = parts[1];
        const bin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
        const cmdStr = provider ? `cd /tmp && ${bin} models ${provider}` : `cd /tmp && ${bin} models`;
        sendMessage(chatId, `🔍 Fetching available models${provider ? ` for ${provider}` : ''}...`);
        try {
            const out = execSync(cmdStr).toString();
            sendMessage(chatId, `📋 Available Models:\n\`\`\`\n${out.substring(0, 3500)}\n\`\`\``);
        } catch (e) {
            sendMessage(chatId, `❌ Error:\n\`\`\`\n${e.stdout?.toString() || e.message}\n\`\`\``);
        }
    } else if (cmd === '/notify') {
        const arg = parts[1];
        if (!arg || arg === 'status') {
            sendMessage(chatId, getMuteStatus());
        } else if (arg === 'off') {
            sendMessage(chatId, setMute(0));
        } else if (arg === 'on') {
            sendMessage(chatId, setMute(1440));
        } else if (!isNaN(arg) && Number(arg) > 0) {
            sendMessage(chatId, setMute(Number(arg)));
        } else {
            sendMessage(chatId, "Usage: /notify [on|off|<minutes>|status]");
        }
    } else if (cmd === '/help') {
        let help = "🛠 *Agency Command & Control v3.0*\n\n";
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
        help += "/reset confirm - Wipe all & factory reset\n\n";
        help += "🔔 *Notifications*\n";
        help += "/notify [on|off|<minutes>|status] - Control global mute\n\n";
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

// Inline button callbacks
async function handleCallback(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    answerCallbackQuery(callbackQuery.id, "⏳ Processing…");

    try {
        if (data === 'explorer_run') {
            const explorerBin = path.join(AGENCY_ROOT, 'hyper-explorer', 'src', 'hyper-explorer-mcp.mjs');
            const out = execSync(`node ${explorerBin} http://localhost:5173 explore_max_coverage 2>&1 | tail -n 5`).toString();
            sendMessage(chatId, `🔄 Explorer triggered:\n\`\`\`\n${out}\n\`\`\``);
        } 
        else if (data.startsWith('verify_fix:')) {
            const findingId = data.split(':')[1];
            answerCallbackQuery(callbackQuery.id, "🔍 Verifying fix…");
            
            const ledger = require('./ledger');
            const finding = ledger.getFinding(findingId);
            if (!finding) {
                sendMessage(chatId, `❌ Finding ${findingId} not found in ledger.`);
                answerCallbackQuery(callbackQuery.id, "❌ not found");
                return;
            }
            
            const statePath = path.join(AGENCY_ROOT, '.run', 'findings_state', `${findingId}.json`);
            let state = null;
            if (fs.existsSync(statePath)) {
                state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            }
            
            sendMessage(chatId, `🔍 Running Explorer to verify fix for: ${finding.player.title}`);
            const explorerBin = path.join(AGENCY_ROOT, 'hyper-explorer', 'src', 'hyper-explorer-mcp.mjs');
            execSync(`node ${explorerBin} http://localhost:5173 explore_max_coverage 2>&1`, { stdio: 'inherit' });
            
            const findingsFile = path.join(AGENCY_ROOT, 'roster/player/memory/findings.md');
            let stillPresent = false;
            if (fs.existsSync(findingsFile)) {
                const content = fs.readFileSync(findingsFile, 'utf8');
                stillPresent = content.includes(finding.player.title) || content.includes(findingId);
            }
            
            const now = new Date().toISOString();
            if (stillPresent) {
                ledger.verifyFinding(findingId, 'failed', 'Finding still present after re‑explore', 'telegram-bot');
                if (state) {
                    state.verification = { status: 'failed', lastChecked: now, notes: 'Still present.' };
                    const payload = tg.renderAgency(state);
                    editTelegramMessage(state.messageId, payload.text, payload.reply_markup);
                    sendMessage(chatId, `❌ Verification FAILED: ${finding.player.title} still detected.`);
                } else {
                    sendMessage(chatId, `❌ Verification FAILED (state missing).`);
                }
            } else {
                ledger.markFixed(findingId, null);
                ledger.verifyFinding(findingId, 'verified', 'No longer present in findings.md', 'telegram-bot');
                if (state) {
                    state.verification = { status: 'verified', lastChecked: now, notes: 'Resolved.' };
                    state.phases.medic.status = '✅ Fixed';
                    const payload = tg.renderAgency(state);
                    editTelegramMessage(state.messageId, payload.text, payload.reply_markup);
                    sendMessage(chatId, `✅ Verification PASSED: ${finding.player.title} resolved.`);
                } else {
                    sendMessage(chatId, `✅ Verification PASSED (state missing).`);
                }
            }
            answerCallbackQuery(callbackQuery.id, "✅ Verification complete");
        } 
        else if (data.startsWith('mute:')) {
            const minutes = data.split(':')[1];
            setMute(Number(minutes));
            sendMessage(chatId, `🔔 Global mute set for ${minutes} minutes.`);
        }
        else if (data.startsWith('view_log:')) {
            const logType = data.split(':')[1];
            if (logType === 'diff') {
                try {
                    const diff = execSync('git diff HEAD~1 HEAD --stat', { cwd: AGENCY_ROOT, encoding: 'utf8' });
                    sendMessage(chatId, `📋 *git diff HEAD~1 HEAD*:\n\`\`\`\n${diff.slice(0, 2000)}\n\`\`\``);
                } catch(e) {
                    sendMessage(chatId, `📋 *diff*: No git history available.`);
                }
            } else {
                let logFile = '';
                if (logType === 'telemetry') logFile = '.run/telemetry_state.json';
                else if (logType === 'journal') logFile = 'roster/player/memory/HERO_JOURNAL.md';
                else logFile = fs.existsSync(path.join(AGENCY_ROOT, '.run', 'agency.log')) ? '.run/agency.log' : '.run/nohup.out';
                try {
                    const fullPath = path.join(AGENCY_ROOT, logFile);
                    if (!fs.existsSync(fullPath)) {
                        return sendMessage(chatId, `📋 *${logType}*: No log file available.`);
                    }
                    const log = execSync(`tail -n 30 "${fullPath}"`).toString();
                    sendMessage(chatId, `📋 *${logType}*:\n\`\`\`\n${log}\n\`\`\``);
                } catch(e) {
                    sendMessage(chatId, `📋 *${logType}*: No log available.`);
                }
            }
        }
        answerCallbackQuery(callbackQuery.id, "✅ Done");
    } catch (err) {
        answerCallbackQuery(callbackQuery.id, `❌ ${err.message}`);
        sendMessage(chatId, `Error: ${err.message}`);
    }
}

function answerCallbackQuery(callbackId, text) {
    try {
        execSync(`curl -s -X POST "https://api.telegram.org/bot${token}/answerCallbackQuery" -d "callback_query_id=${callbackId}&text=${encodeURIComponent(text)}" >/dev/null`);
    } catch(e) {}
}

log("Telegram Management Core V3.0 initialized.");
poll();