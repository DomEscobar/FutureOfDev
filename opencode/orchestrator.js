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
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch (e) { return {}; }
}

function sendTelegram(message) {
    const config = loadConfig();
    const token = config.TELEGRAM_BOT_TOKEN;
    const chatId = config.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    const escaped = JSON.stringify(message).slice(1, -1);
    const truncated = escaped.length > 4046 ? escaped.substring(0, 4046) + '...' : escaped;
    try {
        execSync(`curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" -d "chat_id=${chatId}&text=${truncated}&parse_mode=Markdown"`, { stdio: 'ignore' });
    } catch (e) {}
}

function loadTasks() {
    try { return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')); }
    catch (e) { return null; }
}

function saveTasks(data) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
}

function setTaskStatus(index, status) {
    const data = loadTasks();
    if (!data || !data.tasks || !data.tasks[index]) return;
    data.tasks[index].status = status;
    saveTasks(data);
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
            callback(1);
        }
    }, AGENT_TIMEOUT);

    child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        logStream.end();
        log(`${role} exited (code ${code}, see .run/${role}.log)`);
        sendTelegram(code === 0 ? `*DONE: ${role}*` : `*FAIL: ${role}* (exit ${code})`);
        callback(code);
    });

    child.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        logStream.end();
        log(`${role} error: ${err.message}`);
        callback(1);
    });
}

function processQueue() {
    if (agentRunning || queue.length === 0) return;
    const job = queue.shift();
    agentRunning = true;
    runAgent(job.role, job.prompt, job.workdir, (code) => {
        agentRunning = false;
        if (job.onDone) job.onDone(code);
        log(`Queue: ${queue.length} remaining`);
        evaluate();
        processQueue();
    });
}

function enqueue(role, prompt, workdir, onDone) {
    queue.push({ role, prompt, workdir, onDone });
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
                `Edit tasks.json: set this task (index ${i}) status to "in_progress" and fill in the "description" field with concrete, numbered implementation steps for a developer. ` +
                `The developer will write code to: ${workspace}`,
                AGENCY_ROOT,
                (code) => {
                    const fresh = loadTasks();
                    if (fresh && fresh.tasks[i] && fresh.tasks[i].status !== 'in_progress') {
                        log('PM did not advance status, forcing to in_progress');
                        setTaskStatus(i, 'in_progress');
                    }
                }
            );
            return;
        }

        if (task.status === 'in_progress') {
            log(`Task "${label}" in_progress -> Dev`);
            enqueue('dev',
                `You are the Developer. Implement this task: "${label}". ` +
                `Details: ${task.description || 'Build what the title says.'}. ` +
                `The target workspace is ${workspace}. Create and write all code files there. ` +
                `Do NOT update tasks.json -- the system handles that automatically.`,
                workspace,
                (code) => {
                    if (code === 0) {
                        log('Dev completed, advancing to ready_for_test');
                        setTaskStatus(i, 'ready_for_test');
                    } else {
                        log('Dev failed, keeping in_progress');
                    }
                }
            );
            return;
        }

        if (task.status === 'ready_for_test') {
            log(`Task "${label}" ready_for_test -> Test`);

            // Phase 1: run gatekeeper script directly (no LLM cost)
            let gateResult = 'pass';
            try {
                execSync(`bash ${AGENCY_ROOT}/scripts/gatekeeper.sh`, {
                    cwd: workspace, stdio: 'pipe', timeout: 30000
                });
                log('Gatekeeper: PASS');
            } catch (e) {
                gateResult = (e.stdout || e.stderr || 'unknown failure').toString().substring(0, 500);
                log(`Gatekeeper: FAIL - ${gateResult}`);
            }

            if (gateResult !== 'pass') {
                const d = loadTasks();
                if (d && d.tasks[i]) {
                    d.tasks[i].status = 'in_progress';
                    d.tasks[i].description += `\n\nGatekeeper failure: ${gateResult}`;
                    saveTasks(d);
                }
                dispatched.set(id, 'in_progress');
                return;
            }

            // Phase 2: LLM agent verifies the actual task implementation
            enqueue('test',
                `You are the QA Engineer. The task was: "${label}". ` +
                `Description: ${task.description || 'none'}. ` +
                `The code is in this directory. Examine the files, determine how to test the implementation, and verify it works correctly. ` +
                `If you have a browser tool, open the HTML files to check them visually. ` +
                `Write your verdict to a file called .test_result in this directory: the first line must be exactly PASS or FAIL, followed by your reasoning.`,
                workspace,
                (code) => {
                    const resultFile = path.join(workspace, '.test_result');
                    let verdict = 'pass';
                    let reason = '';
                    if (fs.existsSync(resultFile)) {
                        const content = fs.readFileSync(resultFile, 'utf8').trim();
                        fs.unlinkSync(resultFile);
                        const firstLine = content.split('\n')[0].trim().toUpperCase();
                        if (firstLine === 'FAIL') {
                            verdict = 'fail';
                            reason = content.substring(content.indexOf('\n') + 1).substring(0, 500);
                        }
                    }

                    if (verdict === 'pass') {
                        log('QA verified: PASS, advancing to completed');
                        setTaskStatus(i, 'completed');
                    } else {
                        log(`QA verified: FAIL - ${reason}`);
                        const d = loadTasks();
                        if (d && d.tasks[i]) {
                            d.tasks[i].status = 'in_progress';
                            d.tasks[i].description += `\n\nQA failure: ${reason}`;
                            saveTasks(d);
                        }
                    }
                }
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
            watcher.on('error', () => { setTimeout(watch, 2000); });
        } catch (e) {
            log(`Watch error: ${e.message}`);
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
