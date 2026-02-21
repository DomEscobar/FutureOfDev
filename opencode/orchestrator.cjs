const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const AGENCY_ROOT = __dirname;
const TASKS_FILE = path.join(AGENCY_ROOT, 'tasks.json');
const SUGGESTIONS_FILE = path.join(AGENCY_ROOT, 'SUGGESTIONS.md');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
const CONTEXT_DIR = path.join(RUN_DIR, 'context');
const MEMORY_DIR = path.join(RUN_DIR, 'memory'); // Long-term legacy of rejections/lessons

[RUN_DIR, CONTEXT_DIR, MEMORY_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const LOG_FILE = path.join(RUN_DIR, 'agency.log');
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 2;
const AGENT_TIMEOUT = 15 * 60 * 1000;

let runningAgents = 0;
const queue = [];
let dispatchedStates = new Map(); 

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
    const truncated = message.replace(/'/g, '').substring(0, 400); 
    spawn('curl', ['-s', '-X', 'POST', `https://api.telegram.org/bot${token}/sendMessage`, '-d', `chat_id=${chatId}`, '--data-urlencode', `text=${truncated}`], { detached: true, stdio: 'ignore' }).unref();
}

function loadTasks() {
    try { return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')); } catch { return null; }
}

function saveTasks(data) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
}

function updateTask(id, updates) {
    const data = loadTasks();
    const idx = data?.tasks?.findIndex(t => t.id == id);
    if (idx === undefined || idx === -1) return;
    Object.assign(data.tasks[idx], updates);
    saveTasks(data);
}

function getTaskLabel(task) { return task.title || task.content || task.id; }

// ── MCP Simulated Memory ──

function recallMemory(tid) {
    const memoryPath = path.join(MEMORY_DIR, 'lessons.json');
    if (!fs.existsSync(memoryPath)) return "";
    try {
        const lessons = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
        // Filter for this specific task or general system failures like Timeouts
        const relevant = lessons.filter(l => l.tid === tid || l.reason.toLowerCase().includes('timeout') || l.reason.toLowerCase().includes('bloat')).slice(-5);
        return relevant.length ? `\n\n--- MEMORY OF REGRETS (MCP) ---\n${relevant.map(l => `- ${l.reason}`).join('\n')}` : "";
    } catch { return ""; }
}

function storeMemory(tid, reason) {
    const memoryPath = path.join(MEMORY_DIR, 'lessons.json');
    let lessons = [];
    try { if (fs.existsSync(memoryPath)) lessons = JSON.parse(fs.readFileSync(memoryPath, 'utf8')); } catch {}
    lessons.push({ tid, reason, timestamp: new Date().toISOString() });
    fs.writeFileSync(memoryPath, JSON.stringify(lessons, null, 2));
}

// ── Performance Oracle (MCP Proxy) ──

function runPerformanceAudit(workspace) {
    // Simulated Lighthouse/Bundle audit
    // In a real MCP setup, this would call the mcp-lighthouse-server
    log(`[ORACLE] Running Performance Audit (Excluding node_modules)...`);
    // Placeholder logic: fail if any single JS file exceeds 200KB (artificial constraint)
    try {
        const stats = execSync(`find ${workspace} -not -path "*/node_modules/*" -name "*.js" -size +200k`).toString().trim();
        if (stats) return { pass: false, reason: `Bundle bloat detected in source: ${stats.split('\n')[0]}` };
    } catch (e) {
        log(`[ORACLE ERR] Audit failed: ${e.message}`);
    }
    return { pass: true };
}

// ── Stream Parsing Proxy (God-Mode) ──

function processOutputBuffer(tid, agentName, buffer, workdir) {
    const isImplementationPath = (pth) => pth.includes('src/') || pth.includes('backend/') || pth.includes('frontend/') || pth.endsWith('.js') || pth.endsWith('.tsx');
    
    const fileRegex = /@@@WRITE_FILE:(.+?)@@@\n([\s\S]*?)\n@@@END_WRITE@@@/mg;
    let match;
    while ((match = fileRegex.exec(buffer)) !== null) {
        const pth = match[1].trim();
        const content = match[2];
        if (agentName === 'project-manager' && isImplementationPath(pth)) continue;

        try {
            const isLocal = pth === 'tasks.json' || pth === 'SUGGESTIONS.md';
            const fullPath = isLocal ? path.join(AGENCY_ROOT, pth) : (path.isAbsolute(pth) ? pth : path.join(workdir, pth));
            if (!fs.existsSync(path.dirname(fullPath))) fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content);
            if (!isLocal) sendTelegram(`🛠️ [${agentName.toUpperCase()}] Updated: ${pth}`);
        } catch (e) {}
    }

    const ctxRegex = /@@@WRITE_CONTEXT:(.+?)@@@\n([\s\S]*?)\n@@@END_WRITE@@@/mg;
    while ((match = ctxRegex.exec(buffer)) !== null) {
        const stage = match[1].trim();
        try {
            const data = JSON.parse(match[2]);
            const dir = path.join(CONTEXT_DIR, String(tid));
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${stage}.json`), JSON.stringify(data, null, 2));
        } catch (e) {}
    }
}

// ── Agent Runner ──

function runAgent(agentName, prompt, workdir, tid, label, callback) {
    log(`[DISPATCH] ${agentName} for ${tid}`);
    sendTelegram(`🚀 [DISPATCH] ${agentName.toUpperCase()}: "${label}"`);

    const agentLog = path.join(RUN_DIR, `${agentName}-${Date.now()}.log`);
    const logStream = fs.createWriteStream(agentLog, { flags: 'w' });
    const args = ['run', prompt, '--agent', agentName, '--format', 'json', '--dir', workdir];
    
    // SAFETY CHECK: Ensure agents never write to Agency Root if a specific workspace is provided
    if (workdir === AGENCY_ROOT && agentName.includes('engineer')) {
       log(`[SAFETY BLOCK] Prevented ${agentName} from writing to AGENCY_ROOT.`);
       if(callback) callback(1);
       return;
    }

    const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';

    const child = spawn(opencodeBin, args, { cwd: AGENCY_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

    let fullOutput = '';
    child.stdout.on('data', (data) => {
        fullOutput += data.toString();
        logStream.write(data);
        processOutputBuffer(tid, agentName, fullOutput, workdir);
    });
    child.stderr.on('data', d => logStream.write(d));

    let finished = false;
    const end = (code) => {
        if (finished) return; finished = true;
        logStream.end();
        log(`[EXIT] ${agentName} code=${code}`);
        if(callback) try { callback(code); } catch(e) { log(`[CALLBACK ERR] ${e.message}`); }
    };

    const timeout = setTimeout(() => { log(`[TIMEOUT] ${agentName}`); child.kill('SIGKILL'); end(1); }, AGENT_TIMEOUT);
    child.on('close', code => { clearTimeout(timeout); end(code); });
    child.on('error', err => { log(`[ERROR] ${err.message}`); clearTimeout(timeout); end(1); });
}

function buildPrompt(tid, base, workdir) {
    let p = base;
    const ctx = allContext(tid);
    if (Object.keys(ctx).length > 0) p += `\n\nCONTEXT:\n${JSON.stringify(ctx)}`;
    p += recallMemory(tid); // HYPOTHESIS 4
    p += `\n\nCRITICAL: Use @@@WRITE_FILE@@@ blocks. Follow ARCHITECTURE.md.`;
    return p;
}

function allContext(tid) {
    const dir = path.join(CONTEXT_DIR, String(tid));
    const ctx = {};
    try {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => {
                ctx[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
            });
        }
    } catch {}
    return ctx;
}

function evaluate() {
    const data = loadTasks();
    if (!data?.tasks) {
        log("[EVALUATE] No tasks found or tasks.json missing wrapper.");
        return;
    }
    const lastMod = fs.statSync(TASKS_FILE).mtimeMs;

    let activeCount = 0;
    for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i];
        if (task.status === 'completed' || task.status === 'blocked') continue;
        activeCount++;

        const id = task.id;
        const stateKey = `${id}-${task.status}-${task.retry_count || 0}-${lastMod}`;
        if (dispatchedStates.has(stateKey)) continue;

        const config = loadConfig();
        const workspace = config.AGENCY_WORKSPACE || '.';
        
        const handlers = {
            pending: (t) => {
                const isMinorUI = t.content.toLowerCase().match(/css|style|animation|responsive|icon|color/);
                if (isMinorUI) {
                    dispatchedStates.set(stateKey, true);
                    updateTask(id, { status: 'implementation' });
                    return;
                }

                dispatchedStates.set(stateKey, true);
                const architectPrompt = `Review the project's HIGH-LEVEL ARCHITECTURE in ARCHITECTURE.md for ${getTaskLabel(t)}.
ONLY update the broad system boundaries, technology stacks, or governance rules in CODE_OF_CONDUCT.md.
CRITICAL: Do not design implementation details for individual tasks. Do not write code.
If the existing high-level architecture covers this work, exit with code 0 immediately.`;
                
                enqueue('dev-architect', buildPrompt(id, architectPrompt, workspace), AGENCY_ROOT, id, `System Audit: ${getTaskLabel(t)}`, (code) => {
                    if (code === 0) updateTask(id, { status: 'planning' });
                });
            },
            planning: (t) => {
                // HYPOTHESIS 5: If a task has no subtasks or is marked as 'minor', skip detailed PM planning
                const isMinor = t.content.toLowerCase().match(/css|style|animation|responsive|icon|color|test|doc/);
                if (isMinor) {
                    dispatchedStates.set(stateKey, true);
                    updateTask(id, { status: 'implementation' });
                    return;
                }

                dispatchedStates.set(stateKey, true);
                enqueue('project-manager', buildPrompt(id, `Plan ${getTaskLabel(t)}`, workspace), AGENCY_ROOT, id, `Planning: ${getTaskLabel(t)}`, (code) => {
                    if (code === 0) updateTask(id, { status: 'implementation' });
                });
            },
            implementation: (t) => {
                dispatchedStates.set(stateKey, true);
                const isBackend = t.id.includes('backend') || t.content.toLowerCase().includes('backend');
                const targetAgent = isBackend ? 'backend-engineer' : 'frontend-engineer';
                enqueue(targetAgent, buildPrompt(id, `Build ${getTaskLabel(t)}`, workspace), workspace, id, getTaskLabel(t), (code) => {
                    if (code === 0) updateTask(id, { status: 'code_review' });
                });
            },
            code_review: (t) => {
                dispatchedStates.set(stateKey, true);
                // HYPOTHESIS 2: PERF ORACLE GATE
                const perf = runPerformanceAudit(workspace);
                if (!perf.pass) {
                    storeMemory(id, perf.reason); // HYPOTHESIS 4: LOG TO MEMORY
                    sendTelegram(`⛔ [ORACLE FAIL] ${perf.reason}`);
                    updateTask(id, { status: 'implementation', retry_count: (t.retry_count || 0) + 1, description: (t.description||t.content) + `\n\nPerformance Error: ${perf.reason}` });
                    return;
                }

                enqueue('code-reviewer', buildPrompt(id, `Review ${getTaskLabel(t)}`, workspace), AGENCY_ROOT, id, getTaskLabel(t), (code) => {
                    const r = readContext(id, 'review');
                    if (r?.verdict === 'approved') updateTask(id, { status: 'testing' });
                    else if (r) {
                        storeMemory(id, r.comments || "Code Review Rejected"); // MEMORY LOG
                        updateTask(id, { status: 'implementation', retry_count: (t.retry_count || 0) + 1 });
                    }
                });
            },
            testing: (t) => {
                dispatchedStates.set(stateKey, true);
                enqueue('test-unit', buildPrompt(id, `Test ${getTaskLabel(t)}`, workspace), AGENCY_ROOT, id, getTaskLabel(t), (code) => {
                    const r = readContext(id, 'testing');
                    if (r?.verdict === 'pass') updateTask(id, { status: 'completed' });
                    else if (r) updateTask(id, { status: 'implementation', retry_count: (t.retry_count || 0) + 1 });
                });
            }
        };

        if (handlers[task.status]) handlers[task.status](task);
    }
}

function enqueue(agent, prompt, workdir, tid, label, onDone) {
    queue.push({ agent, prompt, workdir, tid, label, onDone });
    processQueue();
}

function processQueue() {
    while (runningAgents < MAX_CONCURRENT && queue.length > 0) {
        const job = queue.shift();
        runningAgents++;
        runAgent(job.agent, job.prompt, job.workdir, job.tid, job.label, (code) => {
            runningAgents--;
            if (job.onDone) job.onDone(code);
            evaluate();
            processQueue();
        });
    }
}

function readContext(tid, stage) {
    const file = path.join(CONTEXT_DIR, String(tid), `${stage}.json`);
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

setInterval(() => {
    evaluate();
}, 20000); // 20s heartbeat

log('Orchestrator starting (V5 - MCP Memory + Oracle Edition)');
evaluate();
