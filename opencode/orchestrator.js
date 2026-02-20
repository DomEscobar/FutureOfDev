const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { execSync } = require('child_process');

const AGENCY_ROOT = __dirname;
const TASKS_FILE = path.join(AGENCY_ROOT, 'tasks.json');
const SUGGESTIONS_FILE = path.join(AGENCY_ROOT, 'SUGGESTIONS.md');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR);
const LOG_FILE = path.join(RUN_DIR, 'agency.log');

const dispatched = new Map();
let agentRunning = false;
const queue = [];

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function sendTelegram(message) {
    const config = loadConfig();
    const token = config.TELEGRAM_BOT_TOKEN;
    const chatId = config.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const escaped = JSON.stringify(message).slice(1, -1);
    const truncated = escaped.length > 4046 ? escaped.substring(0, 4046) + '... [truncated]' : escaped;
    try {
        execSync(
            `curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" -d "chat_id=${chatId}&text=${truncated}&parse_mode=Markdown"`,
            { stdio: 'ignore' }
        );
    } catch (e) { /* best effort */ }
}

function loadTasks() {
    try {
        return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } catch (e) {
        return null;
    }
}

function runAgent(agent, prompt, callback) {
    log(`Dispatching ${agent}`);
    sendTelegram(`*Dispatching ${agent}*\n${prompt.substring(0, 200)}`);

    execFile('/usr/bin/opencode', [
        'run', prompt, '--agent', agent, '--format', 'json'
    ], { cwd: AGENCY_ROOT, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
            log(`Agent ${agent} failed: ${err.message}`);
            sendTelegram(`*FAIL: ${agent}*\n${err.message.substring(0, 300)}`);
        } else {
            log(`Agent ${agent} completed`);
            sendTelegram(`*DONE: ${agent}*`);
        }
        callback();
    });
}

function processQueue() {
    if (agentRunning || queue.length === 0) return;
    const { agent, prompt } = queue.shift();
    agentRunning = true;
    runAgent(agent, prompt, () => {
        agentRunning = false;
        processQueue();
    });
}

function enqueue(agent, prompt) {
    queue.push({ agent, prompt });
    processQueue();
}

function evaluate() {
    const data = loadTasks();
    if (!data || !data.tasks) return;

    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';

    for (const task of data.tasks) {
        const id = task.id || task.title;
        const prev = dispatched.get(id);

        if (task.status === prev) continue;
        dispatched.set(id, task.status);

        if (task.status === 'pending') {
            enqueue('project-manager',
                `Review task: "${task.title}". Read config.json for AGENCY_WORKSPACE. Update tasks.json: set this task status to "in_progress" and add implementation details to the description. Target workspace: ${workspace}`
            );
            return;
        }

        if (task.status === 'in_progress') {
            enqueue('dev-unit',
                `Implement task: "${task.title}". Details: ${task.description || 'none'}. Read config.json for AGENCY_WORKSPACE (${workspace}). Write code there. When done, update tasks.json: set this task status to "ready_for_test".`
            );
            return;
        }

        if (task.status === 'ready_for_test') {
            enqueue('test-unit',
                `Verify task: "${task.title}". Run scripts/gatekeeper.sh and scripts/test-harness.js against workspace ${workspace}. If pass, update tasks.json status to "completed". If fail, set status to "in_progress" and append failure reasons to the description.`
            );
            return;
        }

        if (task.status === 'completed') {
            log(`Task "${task.title}" completed.`);
            sendTelegram(`*TASK COMPLETED*\n${task.title}`);
        }
    }
}

function watchFile(filepath, label, handler) {
    let debounce = null;
    try {
        fs.watch(filepath, () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                log(`${label} changed`);
                handler();
            }, 500);
        });
        log(`Watching ${label}`);
    } catch (e) {
        log(`Failed to watch ${label}: ${e.message}`);
    }
}

// --- Start ---
log('Orchestrator starting');
sendTelegram('*Agency Orchestrator Started*');

watchFile(TASKS_FILE, 'tasks.json', evaluate);

watchFile(SUGGESTIONS_FILE, 'SUGGESTIONS.md', () => {
    const config = loadConfig();
    enqueue('ceo',
        'CEO: Review SUGGESTIONS.md. Translate any NEW (unchecked) feature requests into structured JSON tasks in tasks.json with status "pending". Only add new tasks, do not delete or modify existing ones.'
    );
});

evaluate();

process.on('SIGTERM', () => {
    log('Orchestrator shutting down');
    process.exit(0);
});
process.on('SIGINT', () => {
    log('Orchestrator shutting down');
    process.exit(0);
});
