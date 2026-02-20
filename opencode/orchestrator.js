const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const AGENCY_ROOT = __dirname;
const TASKS_FILE = path.join(AGENCY_ROOT, 'tasks.json');
const SUGGESTIONS_FILE = path.join(AGENCY_ROOT, 'SUGGESTIONS.md');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR);
const LOG_FILE = path.join(RUN_DIR, 'agency.log');

const AGENT_TIMEOUT = 5 * 60 * 1000;

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

function runAgent(role, prompt, workdir, callback) {
    log(`Dispatching ${role}`);
    sendTelegram(`*Dispatching ${role}*`);

    const agentLog = path.join(RUN_DIR, `${role}.log`);
    const logStream = fs.createWriteStream(agentLog, { flags: 'w' });

    const child = spawn('/usr/bin/opencode', [
        'run', prompt, '--format', 'json'
    ], { cwd: workdir, stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    let finished = false;
    const timeout = setTimeout(() => {
        if (!finished) {
            finished = true;
            log(`${role} timed out, killing`);
            child.kill('SIGKILL');
            logStream.end();
            callback();
        }
    }, AGENT_TIMEOUT);

    child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        logStream.end();
        if (code !== 0) {
            log(`${role} exited with code ${code} (see .run/${role}.log)`);
            sendTelegram(`*FAIL: ${role}* (exit ${code})`);
        } else {
            log(`${role} completed (see .run/${role}.log)`);
            sendTelegram(`*DONE: ${role}*`);
        }
        callback();
    });

    child.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        logStream.end();
        log(`${role} error: ${err.message}`);
        callback();
    });
}

function processQueue() {
    if (agentRunning || queue.length === 0) return;
    const { role, prompt, workdir } = queue.shift();
    agentRunning = true;
    runAgent(role, prompt, workdir, () => {
        agentRunning = false;
        log(`Queue: ${queue.length} remaining`);
        evaluate();
        processQueue();
    });
}

function enqueue(role, prompt, workdir) {
    queue.push({ role, prompt, workdir });
    processQueue();
}

function taskLabel(task) {
    return task.title || task.content || task.name || task.summary || JSON.stringify(task).substring(0, 100);
}

function taskId(task, index) {
    return task.id || `task-${index}`;
}

function evaluate() {
    const data = loadTasks();
    if (!data || !data.tasks) return;

    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';

    for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i];
        const id = taskId(task, i);
        const label = taskLabel(task);
        const prev = dispatched.get(id);

        if (task.status === prev) continue;
        dispatched.set(id, task.status);

        if (task.status === 'pending') {
            log(`Task "${label}" pending -> PM`);
            enqueue('pm',
                `You are the Project Manager. Your task: "${label}". ` +
                `Edit tasks.json: set this task (index ${i}) status to "in_progress" and fill in the "description" field with concrete implementation steps for a developer. ` +
                `The developer will write code to: ${workspace}`,
                AGENCY_ROOT
            );
            return;
        }

        if (task.status === 'in_progress') {
            log(`Task "${label}" in_progress -> Dev`);
            enqueue('dev',
                `You are the Developer. Implement this task: "${label}". ` +
                `Details: ${task.description || 'Build what the title says.'}. ` +
                `The target workspace is ${workspace}. Use bash tool to create/write files there (e.g. bash: cat > ${workspace}/file.html << 'EOF' ... EOF). ` +
                `When done, edit tasks.json and set the task at index ${i} status to "ready_for_test".`,
                AGENCY_ROOT
            );
            return;
        }

        if (task.status === 'ready_for_test') {
            log(`Task "${label}" ready_for_test -> Test`);
            enqueue('test',
                `You are the QA Engineer. Verify task: "${label}". ` +
                `Run: bash scripts/gatekeeper.sh and node scripts/test-harness.js. ` +
                `If all pass, edit tasks.json and set task at index ${i} status to "completed". ` +
                `If any fail, set status to "in_progress" and append the failure details to the description.`,
                AGENCY_ROOT
            );
            return;
        }

        if (task.status === 'completed') {
            log(`Task "${label}" completed`);
            sendTelegram(`*TASK COMPLETED*\n${label}`);
        }
    }
}

function watchSuggestions() {
    let debounce = null;
    const watch = () => {
        try {
            const watcher = fs.watch(SUGGESTIONS_FILE, () => {
                if (debounce) clearTimeout(debounce);
                debounce = setTimeout(() => {
                    log('SUGGESTIONS.md changed');
                    enqueue('ceo',
                        `You are the CEO. Review SUGGESTIONS.md. ` +
                        `For each NEW unchecked request, add a task to the "tasks" array in tasks.json using this exact format: ` +
                        `{"id": "unique-id", "title": "short title", "description": "", "status": "pending"}. ` +
                        `Do not delete or modify existing tasks.`,
                        AGENCY_ROOT
                    );
                }, 500);
            });
            watcher.on('error', () => {
                log('Watcher error, re-watching in 2s');
                setTimeout(watch, 2000);
            });
        } catch (e) {
            log(`Failed to watch: ${e.message}`);
            setTimeout(watch, 2000);
        }
    };
    watch();
}

log('Orchestrator starting');
sendTelegram('*Agency Orchestrator Started*');

watchSuggestions();
log('Watching SUGGESTIONS.md');

evaluate();

process.on('SIGTERM', () => { log('Shutting down'); process.exit(0); });
process.on('SIGINT', () => { log('Shutting down'); process.exit(0); });
