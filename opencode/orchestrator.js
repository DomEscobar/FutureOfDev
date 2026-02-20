const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const AGENCY_ROOT = __dirname;
const TASKS_FILE = path.join(AGENCY_ROOT, 'tasks.json');
const SUGGESTIONS_FILE = path.join(AGENCY_ROOT, 'SUGGESTIONS.md');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
const CONTEXT_DIR = path.join(RUN_DIR, 'context');

[RUN_DIR, CONTEXT_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const LOG_FILE = path.join(RUN_DIR, 'agency.log');
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 2;
const AGENT_TIMEOUT = 8 * 60 * 1000;

let running = 0;
const queue = [];
const dispatched = new Map();

// ── Logging & Config ──

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch { return {}; }
}

function sendTelegram(message) {
    const config = loadConfig();
    const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = config;
    if (!token || !chatId) return;
    const truncated = message.length > 4000 ? message.substring(0, 4000) + '...' : message;
    try {
        execSync(`curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" -d chat_id=${chatId} --data-urlencode "text=${truncated}"`, { stdio: 'ignore', timeout: 10000 });
    } catch {}
}

// ── Task Persistence ──

function loadTasks() {
    try { return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')); }
    catch { return null; }
}

function saveTasks(data) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
}

function getTask(index) {
    const data = loadTasks();
    return data?.tasks?.[index] || null;
}

function updateTask(index, updates) {
    const data = loadTasks();
    if (!data?.tasks?.[index]) return;
    Object.assign(data.tasks[index], updates);
    saveTasks(data);
}

function taskLabel(task) {
    return task.title || task.content || task.name || JSON.stringify(task).substring(0, 80);
}

function taskId(task, index) {
    return task.id || `task-${index}`;
}

// ── Context Store ──

function contextDir(tid) {
    const dir = path.join(CONTEXT_DIR, tid);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function writeContext(tid, stage, data) {
    fs.writeFileSync(path.join(contextDir(tid), `${stage}.json`), JSON.stringify(data, null, 2));
}

function readContext(tid, stage) {
    const file = path.join(contextDir(tid), `${stage}.json`);
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return null; }
}

function allContext(tid) {
    const dir = contextDir(tid);
    const ctx = {};
    try {
        fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
            ctx[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        });
    } catch {}
    return ctx;
}

// ── Agent Runner ──

function runAgent(agentName, prompt, workdir, callback) {
    log(`[DISPATCH] ${agentName}`);
    sendTelegram(`Dispatching: ${agentName}`);

    const agentLog = path.join(RUN_DIR, `${agentName}-${Date.now()}.log`);
    const logStream = fs.createWriteStream(agentLog, { flags: 'w' });

    const args = ['run', prompt, '--agent', agentName, '--format', 'json', '--dir', workdir];

    const opencodeBin = fs.existsSync('/root/.opencode/bin/opencode')
        ? '/root/.opencode/bin/opencode'
        : '/usr/bin/opencode';

    const child = spawn(opencodeBin, args, {
        cwd: AGENCY_ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    let finished = false;
    const timeout = setTimeout(() => {
        if (!finished) {
            finished = true;
            log(`[TIMEOUT] ${agentName}`);
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
        log(`[EXIT] ${agentName} code=${code}`);
        sendTelegram(code === 0 ? `Done: ${agentName}` : `FAIL: ${agentName} (exit ${code})`);
        callback(code);
    });

    child.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        logStream.end();
        log(`[ERROR] ${agentName}: ${err.message}`);
        callback(1);
    });
}

// ── Queue with Parallel Execution ──

function processQueue() {
    while (running < MAX_CONCURRENT && queue.length > 0) {
        const job = queue.shift();
        running++;
        runAgent(job.agent, job.prompt, job.workdir, (code) => {
            running--;
            if (job.onDone) job.onDone(code);
            log(`Queue: ${queue.length} pending, ${running} running`);
            evaluate();
            processQueue();
        });
    }
}

function enqueue(agent, prompt, workdir, onDone) {
    queue.push({ agent, prompt, workdir, onDone });
    processQueue();
}

// ── Stage Handlers ──

function buildPromptWithContext(tid, basePrompt) {
    const ctx = allContext(tid);
    if (Object.keys(ctx).length === 0) return basePrompt;
    return `${basePrompt}\n\n--- Prior Stage Context ---\n${JSON.stringify(ctx, null, 2)}`;
}

function handlePending(task, index) {
    const id = taskId(task, index);
    const label = taskLabel(task);
    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';

    log(`[STAGE] ${label} -> planning (PM)`);
    enqueue('project-manager',
        `Task: "${label}" (index ${index}, id: "${id}")\n` +
        `Workspace: ${workspace}\n\n` +
        `Break this task down into concrete implementation steps. ` +
        `Update tasks.json: set status to "architecture" if complexity is "complex", otherwise "implementation". ` +
        `Fill the description field with numbered steps. ` +
        `If needed, set type/complexity/needs_security_audit/needs_visual_check fields.`,
        AGENCY_ROOT,
        (code) => {
            const fresh = getTask(index);
            if (fresh && !['architecture', 'implementation'].includes(fresh.status)) {
                log('PM did not advance status, forcing to implementation');
                updateTask(index, { status: 'implementation' });
            }
        }
    );
}

function handleArchitecture(task, index) {
    const id = taskId(task, index);
    const label = taskLabel(task);
    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';

    log(`[STAGE] ${label} -> architecture (Architect)`);
    enqueue('architect',
        buildPromptWithContext(id,
            `Task: "${label}" (index ${index}, id: "${id}")\n` +
            `Description: ${task.description || 'See title.'}\n` +
            `Workspace: ${workspace}\n\n` +
            `Design the technical architecture. Update tasks.json: set status to "implementation" when done.`
        ),
        AGENCY_ROOT,
        (code) => {
            const fresh = getTask(index);
            if (fresh && fresh.status !== 'implementation') {
                log('Architect did not advance status, forcing to implementation');
                updateTask(index, { status: 'implementation' });
            }
        }
    );
}

function handleImplementation(task, index) {
    const id = taskId(task, index);
    const label = taskLabel(task);
    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';

    log(`[STAGE] ${label} -> implementation (Dev)`);
    enqueue('dev-unit',
        buildPromptWithContext(id,
            `Task: "${label}" (index ${index}, id: "${id}")\n` +
            `Description: ${task.description || 'Build what the title says.'}\n` +
            `Workspace: ${workspace}\n\n` +
            `Implement this task. Write all code to the workspace. ` +
            `Do NOT update tasks.json -- the orchestrator handles status transitions.`
        ),
        workspace,
        (code) => {
            const fresh = getTask(index);
            if (code === 0) {
                log(`Dev completed "${label}", advancing to code_review`);
                updateTask(index, { status: 'code_review' });
            } else {
                const retries = (fresh?.retry_count || 0);
                if (retries >= MAX_RETRIES) {
                    log(`Dev failed "${label}" after ${retries} retries, marking blocked`);
                    updateTask(index, { status: 'blocked' });
                    sendTelegram(`BLOCKED: "${label}" failed after ${MAX_RETRIES} retries`);
                } else {
                    log(`Dev failed "${label}", retry ${retries + 1}/${MAX_RETRIES}`);
                    updateTask(index, { status: 'implementation', retry_count: retries + 1 });
                }
            }
        }
    );
}

function handleCodeReview(task, index) {
    const id = taskId(task, index);
    const label = taskLabel(task);
    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';

    log(`[STAGE] ${label} -> code_review (Reviewer)`);
    enqueue('code-reviewer',
        buildPromptWithContext(id,
            `Task: "${label}" (index ${index}, id: "${id}")\n` +
            `Description: ${task.description || 'See title.'}\n` +
            `Workspace: ${workspace}\n\n` +
            `Review the implementation. Write verdict to .run/context/${id}/review.json with format: ` +
            `{"verdict": "approved" or "rejected", "issues": [...], "summary": "..."}`
        ),
        AGENCY_ROOT,
        (code) => {
            const review = readContext(id, 'review');
            const fresh = getTask(index);
            if (review?.verdict === 'rejected') {
                const retries = (fresh?.retry_count || 0);
                if (retries >= MAX_RETRIES) {
                    log(`Review rejected "${label}" after max retries, marking blocked`);
                    updateTask(index, { status: 'blocked' });
                    sendTelegram(`BLOCKED: "${label}" rejected by reviewer after ${MAX_RETRIES} attempts`);
                } else {
                    log(`Review rejected "${label}", sending back to implementation`);
                    updateTask(index, {
                        status: 'implementation',
                        retry_count: retries + 1,
                        description: (fresh?.description || '') + `\n\nReview feedback (attempt ${retries + 1}): ${review.summary || ''}\nIssues: ${JSON.stringify(review.issues || [])}`
                    });
                }
            } else {
                log(`Review approved "${label}", advancing to testing`);
                updateTask(index, { status: 'testing' });
            }
        }
    );
}

function handleTesting(task, index) {
    const id = taskId(task, index);
    const label = taskLabel(task);
    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';

    log(`[STAGE] ${label} -> testing (Gatekeeper + QA)`);

    // Phase 1: Gatekeeper script (free, no LLM)
    let gateResult = 'pass';
    try {
        execSync(`bash ${AGENCY_ROOT}/scripts/gatekeeper.sh`, {
            cwd: workspace, stdio: 'pipe', timeout: 30000
        });
        log('Gatekeeper: PASS');
    } catch (e) {
        gateResult = (e.stdout || e.stderr || 'unknown').toString().substring(0, 500);
        log(`Gatekeeper: FAIL - ${gateResult}`);
    }

    if (gateResult !== 'pass') {
        writeContext(id, 'testing', { verdict: 'fail', source: 'gatekeeper', details: gateResult });
        const fresh = getTask(index);
        const retries = (fresh?.retry_count || 0);
        if (retries >= MAX_RETRIES) {
            updateTask(index, { status: 'blocked' });
            sendTelegram(`BLOCKED: "${label}" failed gatekeeper after ${MAX_RETRIES} retries`);
        } else {
            updateTask(index, {
                status: 'implementation',
                retry_count: retries + 1,
                description: (fresh?.description || '') + `\n\nGatekeeper failure: ${gateResult}`
            });
        }
        return;
    }

    // Phase 2: QA agent
    enqueue('test-unit',
        buildPromptWithContext(id,
            `Task: "${label}" (index ${index}, id: "${id}")\n` +
            `Description: ${task.description || 'See title.'}\n` +
            `Workspace: ${workspace}\n` +
            `App URL: ${config.APP_URL || 'N/A'}\n\n` +
            `Verify the implementation works correctly. Write verdict to .run/context/${id}/testing.json with format: ` +
            `{"verdict": "pass" or "fail", "details": "...", "tests_run": [...]}`
        ),
        AGENCY_ROOT,
        (code) => {
            const result = readContext(id, 'testing');
            const fresh = getTask(index);
            if (result?.verdict === 'fail') {
                const retries = (fresh?.retry_count || 0);
                if (retries >= MAX_RETRIES) {
                    updateTask(index, { status: 'blocked' });
                    sendTelegram(`BLOCKED: "${label}" failed QA after ${MAX_RETRIES} retries`);
                } else {
                    updateTask(index, {
                        status: 'implementation',
                        retry_count: retries + 1,
                        description: (fresh?.description || '') + `\n\nQA failure: ${result.details || ''}`
                    });
                }
            } else {
                handlePostTest(fresh || task, index);
            }
        }
    );
}

function handlePostTest(task, index) {
    const id = taskId(task, index);
    const label = taskLabel(task);
    const config = loadConfig();
    const workspace = config.AGENCY_WORKSPACE || '.';
    let pendingChecks = 0;
    let checksFailed = false;

    const onCheckDone = () => {
        pendingChecks--;
        if (pendingChecks <= 0) {
            if (checksFailed) {
                const fresh = getTask(index);
                const retries = (fresh?.retry_count || 0);
                if (retries >= MAX_RETRIES) {
                    updateTask(index, { status: 'blocked' });
                    sendTelegram(`BLOCKED: "${label}" failed post-test checks`);
                } else {
                    updateTask(index, { status: 'implementation', retry_count: retries + 1 });
                }
            } else {
                log(`All checks passed for "${label}", marking completed`);
                updateTask(index, { status: 'completed' });
                sendTelegram(`COMPLETED: "${label}"`);
            }
        }
    };

    // Security audit (conditional)
    if (task.needs_security_audit) {
        pendingChecks++;
        log(`[STAGE] ${label} -> security_audit (Shadow Tester)`);
        enqueue('shadow-tester',
            buildPromptWithContext(id,
                `Task: "${label}" (index ${index}, id: "${id}")\n` +
                `Workspace: ${workspace}\n\n` +
                `Run security audit. Write findings to .run/context/${id}/security.json with format: ` +
                `{"verdict": "pass" or "fail", "vulnerabilities": [...]}`
            ),
            AGENCY_ROOT,
            (code) => {
                const sec = readContext(id, 'security');
                if (sec?.verdict === 'fail') {
                    log(`Security audit FAILED for "${label}"`);
                    checksFailed = true;
                    const fresh = getTask(index);
                    if (fresh) {
                        updateTask(index, {
                            description: fresh.description + `\n\nSecurity issues: ${JSON.stringify(sec.vulnerabilities || [])}`
                        });
                    }
                } else {
                    log(`Security audit PASSED for "${label}"`);
                }
                onCheckDone();
            }
        );
    }

    // Visual check (conditional)
    if (task.needs_visual_check) {
        pendingChecks++;
        log(`[STAGE] ${label} -> visual_check (Visual Analyst)`);
        enqueue('visual-analyst',
            buildPromptWithContext(id,
                `Task: "${label}" (index ${index}, id: "${id}")\n` +
                `Workspace: ${workspace}\n` +
                `App URL: ${config.APP_URL || 'N/A'}\n\n` +
                `Audit the UI/UX. Write findings to .run/context/${id}/visual.json with format: ` +
                `{"verdict": "pass" or "fail", "issues": [...], "score": 0-100}`
            ),
            AGENCY_ROOT,
            (code) => {
                const vis = readContext(id, 'visual');
                if (vis?.verdict === 'fail') {
                    log(`Visual check FAILED for "${label}"`);
                    checksFailed = true;
                    const fresh = getTask(index);
                    if (fresh) {
                        updateTask(index, {
                            description: fresh.description + `\n\nVisual issues: ${JSON.stringify(vis.issues || [])}`
                        });
                    }
                } else {
                    log(`Visual check PASSED for "${label}"`);
                }
                onCheckDone();
            }
        );
    }

    // No conditional checks needed
    if (pendingChecks === 0) {
        log(`No post-test checks needed for "${label}", marking completed`);
        updateTask(index, { status: 'completed' });
        sendTelegram(`COMPLETED: "${label}"`);
    }
}

// ── Main Evaluation Loop ──

const STAGE_HANDLERS = {
    pending: handlePending,
    architecture: handleArchitecture,
    implementation: handleImplementation,
    code_review: handleCodeReview,
    testing: handleTesting
};

function evaluate() {
    const data = loadTasks();
    if (!data?.tasks) return;

    for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i];
        const id = taskId(task, i);
        const prev = dispatched.get(id);

        if (task.status === prev) continue;
        dispatched.set(id, task.status);

        if (task.status === 'completed') {
            log(`Task "${taskLabel(task)}" completed`);
            checkParentCompletion(task);
            continue;
        }

        if (task.status === 'blocked') {
            log(`Task "${taskLabel(task)}" is blocked`);
            continue;
        }

        const handler = STAGE_HANDLERS[task.status];
        if (handler) {
            handler(task, i);
        }
    }
}

// ── Sub-task Parent Tracking ──

function checkParentCompletion(task) {
    if (!task.parent_id) return;
    const data = loadTasks();
    if (!data?.tasks) return;

    const parentIdx = data.tasks.findIndex(t => t.id === task.parent_id);
    if (parentIdx === -1) return;

    const parent = data.tasks[parentIdx];
    const subtaskIds = parent.subtasks || [];
    if (subtaskIds.length === 0) return;

    const allDone = subtaskIds.every(sid =>
        data.tasks.some(t => t.id === sid && t.status === 'completed')
    );

    if (allDone) {
        log(`All subtasks complete for "${taskLabel(parent)}", advancing parent`);
        updateTask(parentIdx, { status: 'completed' });
        sendTelegram(`COMPLETED (all subtasks): "${taskLabel(parent)}"`);
    }
}

// ── Suggestion Watcher ──

function watchSuggestions() {
    let debounce = null;
    const watch = () => {
        try {
            const watcher = fs.watch(SUGGESTIONS_FILE, () => {
                if (debounce) clearTimeout(debounce);
                debounce = setTimeout(() => {
                    log('SUGGESTIONS.md changed');
                    enqueue('ceo',
                        `Review SUGGESTIONS.md. For each NEW unchecked request, add a task to tasks.json. ` +
                        `Use the schema: {"id":"kebab-id","title":"...","description":"","status":"pending",` +
                        `"type":"frontend|backend|fullstack|docs|config","complexity":"simple|moderate|complex",` +
                        `"needs_security_audit":false,"needs_visual_check":false,"retry_count":0}. ` +
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

// ── Periodic Re-evaluation ──

setInterval(() => {
    evaluate();
}, 15000);

// ── Startup ──

log('Orchestrator starting (graph-based, parallel, agent-aware)');
sendTelegram('Agency Orchestrator Started (v2 - graph-based)');
watchSuggestions();
log('Watching SUGGESTIONS.md');
evaluate();

process.on('SIGTERM', () => { log('Shutting down'); process.exit(0); });
process.on('SIGINT', () => { log('Shutting down'); process.exit(0); });
