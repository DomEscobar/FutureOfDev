const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * ORCHESTRATOR V6.1 (Universal Edition)
 * 🔬 CIRCUIT BREAKER: Rule of Three (3 retries max)
 * 🧊 COOLDOWN: 30s between same-task dispatches
 * ⏱️ HANDSHAKING: 120s Hard Agent Timeout
 * 📊 UNIVERSAL: Handles all task types, not just backend
 */

const AGENCY_ROOT = __dirname;
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const CONTEXT_DIR = path.join(AGENCY_ROOT, '.run', 'context');

const LIMITS = {
    MAX_RETRIES: 3,
    COOLDOWN_MS: 30000,
    AGENT_TIMEOUT_MS: 120000
};

const lastDispatchTimes = new Map();

// Agent routing based on task type
const AGENT_ROUTING = {
    'backend': 'code-reviewer',
    'frontend': 'code-reviewer', 
    'test': 'test-unit',
    'unit': 'test-unit',
    'review': 'code-reviewer',
    'default': 'code-reviewer'
};

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    if (!fs.existsSync(path.dirname(LOG_PATH))) fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line + '\n');
}

function updateTask(id, updates) {
    const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
    const idx = data.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
        data.tasks[idx] = { ...data.tasks[idx], ...updates };
        fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));
    }
}

function selectAgent(task) {
    const id = task.id.toLowerCase();
    const content = (task.content || '').toLowerCase();
    
    for (const [keyword, agent] of Object.entries(AGENT_ROUTING)) {
        if (keyword !== 'default' && (id.includes(keyword) || content.includes(keyword))) {
            return agent;
        }
    }
    return AGENT_ROUTING.default;
}

async function runAgent(agentName, task) {
    const id = task.id;
    
    // 1. CIRCUIT BREAKER
    if ((task.retry_count || 0) >= LIMITS.MAX_RETRIES) {
        log(`[🚨 CIRCUIT BREAKER] Task ${id} blocked after 3 failures.`);
        updateTask(id, { 
            status: 'blocked', 
            error: 'Exceeded retry limit (Rule of Three)',
            retry_count: LIMITS.MAX_RETRIES 
        });
        return;
    }

    // 2. COOLDOWN
    const now = Date.now();
    const lastTime = lastDispatchTimes.get(id) || 0;
    if (now - lastTime < LIMITS.COOLDOWN_MS) {
        return;
    }
    lastDispatchTimes.set(id, now);

    // Update task to in_progress
    updateTask(id, { status: 'in_progress' });

    log(`[DISPATCH] ${agentName} for ${id} (Attempt ${(task.retry_count || 0) + 1})`);
    
    const contextFile = path.join(CONTEXT_DIR, `${id}-context.json`);
    if (fs.existsSync(contextFile)) fs.unlinkSync(contextFile);
    if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR, { recursive: true });

    const workspace = process.env.PROJECT_WORKSPACE || "/root/Playground_AI_Dev";
    const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
    
    const child = spawn(opencodeBin, [
        'run', task.description || task.content,
        '--agent', agentName,
        '--dir', workspace
    ], { 
        cwd: AGENCY_ROOT,
        env: { ...process.env, PROJECT_ID: id, CONTEXT_FILE: contextFile }
    });

    let timeout = setTimeout(() => {
        log(`[⏱️ TIMEOUT] ${agentName} for ${id} exceeded 120s`);
        child.kill('SIGKILL');
        updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
    }, LIMITS.AGENT_TIMEOUT_MS);

    child.on('close', (code) => {
        clearTimeout(timeout);
        log(`[🏁 FINISHED] ${agentName} for ${id} (Exit: ${code})`);
        
        setTimeout(() => {
            if (fs.existsSync(contextFile)) {
                try {
                    const ctx = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
                    log(`[⚖️ VERDICT] ${id}: ${ctx.verdict}`);
                    
                    if (ctx.verdict === 'approved' || ctx.verdict === 'pass') {
                        updateTask(id, { status: 'completed', completed_at: new Date().toISOString() });
                    } else {
                        updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1, last_error: ctx.summary });
                    }
                } catch(e) {
                    log(`[❌ ERROR] Malformed context for ${id}`);
                    updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
                }
            } else {
                log(`[😶 STALL] No context from ${agentName} for ${id}`);
                updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
            }
        }, 2000);
    });

    child.on('error', (err) => {
        log(`[❌ SPAWN ERROR] ${err.message}`);
        updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
    });
}

function orchestrate() {
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        const pendingTasks = data.tasks.filter(t => t.status === 'pending');

        for (const task of pendingTasks) {
            const agent = selectAgent(task);
            runAgent(agent, task);
        }
    } catch(e) {
        log(`[FATAL] ${e.message}`);
    }
}

log("Orchestrator V6.1 (Universal) Active");
setInterval(orchestrate, 15000);
orchestrate();