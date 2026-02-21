const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * ORCHESTRATOR V6.0 (The Governed Edition)
 * 🔬 NEW CIRCUIT BREAKER: The "Rule of Three" (3 Retries max)
 * 🧊 NEW COOLDOWN: 30s Wait between same-task dispatches
 * ⏱️ NEW HANDSHAKING: 120s Hard Agent Timeout
 */

const AGENCY_ROOT = __dirname;
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const CONTEXT_DIR = path.join(AGENCY_ROOT, '.run', 'context');

// --- CIRCUIT BREAKER CONFIG ---
const LIMITS = {
    MAX_RETRIES: 3,           // Hard "Rule of Three"
    COOLDOWN_MS: 30000,      // 30s between same-task dispatches
    AGENT_TIMEOUT_MS: 120000 // 2m max agent runtime
};

const lastDispatchTimes = new Map();

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

async function runAgent(agentName, task) {
    const id = task.id;
    
    // 1. CIRCUIT BREAKER: Rule of Three
    if ((task.retry_count || 0) >= LIMITS.MAX_RETRIES) {
        log(`[🚨 CIRCUIT BREAKER] Task ${id} exceeded 3 attempts. SHUTTING DOWN TASK.`);
        updateTask(id, { status: 'blocked', description: (task.description || '') + '\n\nBLOCK: Exceeded Rule of Three retry limit.' });
        return;
    }

    // 2. COOLDOWN: Prevention of Spasm Loops
    const now = Date.now();
    const lastTime = lastDispatchTimes.get(id) || 0;
    if (now - lastTime < LIMITS.COOLDOWN_MS) {
        return; // Silent discard to prevent log spam
    }
    lastDispatchTimes.set(id, now);

    log(`[DISPATCH] ${agentName} for ${id} (Attempt ${(task.retry_count || 0) + 1})`);
    
    const contextType = agentName === 'code-reviewer' ? 'review' : 'testing';
    const contextFile = path.join(CONTEXT_DIR, `${id}-${contextType}.json`);
    if (fs.existsSync(contextFile)) fs.unlinkSync(contextFile);

    const workspace = "/root/Playground_AI_Dev";
    const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
    
    // 3. HANDSHAKING: Explicit Process Lifecycle Management
    const child = spawn(opencodeBin, [
        'run', task.description, 
        '--agent', agentName, 
        '--format', 'json', 
        '--dir', workspace
    ], { 
        cwd: AGENCY_ROOT
    });

    let timeout = setTimeout(() => {
        log(`[⏱️ TIMEOUT] Agent ${agentName} timed out after 120s.`);
        child.kill('SIGKILL');
    }, LIMITS.AGENT_TIMEOUT_MS);

    child.on('close', (code) => {
        clearTimeout(timeout);
        log(`[🏁 FINISHED] ${agentName} for ${id} (Exit: ${code})`);
        
        if (code !== 0) {
            updateTask(id, { retry_count: (task.retry_count || 0) + 1 });
            return;
        }

        // Wait brief moment for filesystem sync
        setTimeout(() => {
            if (fs.existsSync(contextFile)) {
                try {
                    const ctx = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
                    log(`[⚖️ VERDICT] ${id}: ${ctx.verdict}`);
                    if (ctx.verdict === 'approved' || ctx.verdict === 'pass') {
                        updateTask(id, { status: 'completed' });
                    } else {
                        updateTask(id, { retry_count: (task.retry_count || 0) + 1 });
                    }
                } catch(e) { log(`[❌ ERROR] Malformed verdict for ${id}`); }
            } else {
                log(`[😶 STALL] No verdict generated for ${id}. Agent was silent.`);
                updateTask(id, { retry_count: (task.retry_count || 0) + 1 });
            }
        }, 2000);
    });
}

function orchestrate() {
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        const activeTasks = data.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

        for (const task of activeTasks) {
            if (task.id.includes('backend') && task.status === 'pending') {
                runAgent('code-reviewer', task);
            }
        }
    } catch(e) {
        log(`[FATAL] Task manifest error: ${e.message}`);
    }
}

log("Orchestrator V6.0 (Governed Edition) Active.");
setInterval(orchestrate, 15000); // 15s Pulse
orchestrate();
