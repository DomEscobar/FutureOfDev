const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * ORCHESTRATOR V7.0 (Protocol-Aware Edition)
 * 
 * FIXES:
 * - Uses protocol-bridge for context file generation
 * - Correct agent routing (backend → dev-unit)
 * - Task state recovery on startup
 * - Graceful shutdown handling
 * - Direct stdout parsing (no context file dependency)
 */

const AGENCY_ROOT = __dirname;
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const CONTEXT_DIR = path.join(AGENCY_ROOT, '.run', 'context');
const BRIDGE_PATH = path.join(AGENCY_ROOT, 'protocol-bridge.cjs');

const LIMITS = {
    MAX_RETRIES: 3,
    COOLDOWN_MS: 30000,
    AGENT_TIMEOUT_MS: 180000  // 3 minutes for complex tasks
};

const lastDispatchTimes = new Map();
let isShuttingDown = false;

// CORRECT agent routing - developers BUILD, reviewers CHECK
const AGENT_ROUTING = {
    'backend': 'dev-unit',
    'frontend': 'dev-unit', 
    'api': 'dev-unit',
    'feature': 'dev-unit',
    'bug': 'dev-unit',
    'fix': 'dev-unit',
    'test': 'test-unit',
    'unit': 'test-unit',
    'review': 'code-reviewer',
    'refactor': 'dev-unit',
    'default': 'dev-unit'
};

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
        if (!fs.existsSync(path.dirname(LOG_PATH))) fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        fs.appendFileSync(LOG_PATH, line + '\n');
    } catch (e) {}
}

function updateTask(id, updates) {
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        const idx = data.tasks.findIndex(t => t.id === id);
        if (idx !== -1) {
            data.tasks[idx] = { ...data.tasks[idx], ...updates, updated_at: new Date().toISOString() };
            fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));
        }
    } catch (e) {
        log(`[ERROR] Failed to update task ${id}: ${e.message}`);
    }
}

function recoverStuckTasks() {
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        let recovered = 0;
        for (const task of data.tasks) {
            if (task.status === 'in_progress') {
                task.status = 'pending';
                task.recovered = true;
                recovered++;
            }
        }
        if (recovered > 0) {
            fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));
            log(`[RECOVERY] Recovered ${recovered} stuck tasks from in_progress → pending`);
        }
    } catch (e) {
        log(`[ERROR] Task recovery failed: ${e.message}`);
    }
}

function selectAgent(task) {
    const id = (task.id || '').toLowerCase();
    const content = (task.content || task.description || '').toLowerCase();
    
    for (const [keyword, agent] of Object.entries(AGENT_ROUTING)) {
        if (keyword !== 'default' && (id.includes(keyword) || content.includes(keyword))) {
            return agent;
        }
    }
    return AGENT_ROUTING.default;
}

function parseAgentOutput(output) {
    // Parse @@@WRITE_CONTEXT:type@@@ ... @@@END_WRITE@@@ tags
    const contextMatch = output.match(/@@@WRITE_CONTEXT:(\w+)@@@\n?([\s\S]*?)\n?@@@END_WRITE@@@/);
    if (contextMatch) {
        try {
            return JSON.parse(contextMatch[2]);
        } catch (e) {
            log(`[WARN] Failed to parse context JSON: ${e.message}`);
        }
    }
    
    // Fallback: look for verdict keywords in output
    const lowerOutput = output.toLowerCase();
    if (lowerOutput.includes('approved') || lowerOutput.includes('✅') || lowerOutput.includes('completed successfully')) {
        return { verdict: 'approved', summary: 'Detected approval in output' };
    }
    if (lowerOutput.includes('rejected') || lowerOutput.includes('❌') || lowerOutput.includes('failed')) {
        return { verdict: 'rejected', summary: 'Detected rejection in output' };
    }
    if (lowerOutput.includes('pass') && !lowerOutput.includes('fail')) {
        return { verdict: 'pass', summary: 'Tests passed' };
    }
    if (lowerOutput.includes('fail')) {
        return { verdict: 'fail', summary: 'Tests failed' };
    }
    
    return null;
}

async function runAgent(agentName, task) {
    const id = task.id;
    
    if (isShuttingDown) {
        log(`[SHUTDOWN] Skipping dispatch during shutdown`);
        return;
    }
    
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

    updateTask(id, { status: 'in_progress', started_at: new Date().toISOString() });

    log(`[DISPATCH] ${agentName} for ${id} (Attempt ${(task.retry_count || 0) + 1})`);
    
    const workspace = process.env.PROJECT_WORKSPACE || "/root/Playground_AI_Dev";
    const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
    
    // Ensure context directory exists
    if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR, { recursive: true });
    const contextFile = path.join(CONTEXT_DIR, `${id}-context.json`);

    const child = spawn(opencodeBin, [
        'run', 
        task.description || task.content || `Complete task: ${id}`,
        '--agent', agentName, 
        '--dir', workspace
    ], { 
        cwd: AGENCY_ROOT,
        env: { ...process.env, PROJECT_ID: id },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    let isTimedOut = false;
    let timeout = setTimeout(() => {
        isTimedOut = true;
        log(`[⏱️ TIMEOUT] ${agentName} for ${id} exceeded ${LIMITS.AGENT_TIMEOUT_MS/1000}s`);
        child.kill('SIGKILL');
        // Update task immediately on timeout (close event may not fire after SIGKILL)
        updateTask(id, { 
            status: 'pending', 
            retry_count: (task.retry_count || 0) + 1, 
            last_error: `Agent timed out after ${LIMITS.AGENT_TIMEOUT_MS/1000}s`
        });
    }, LIMITS.AGENT_TIMEOUT_MS);

    child.on('close', (code) => {
        clearTimeout(timeout);
        
        // Skip if already handled by timeout
        if (isTimedOut) {
            log(`[🏁 FINISHED (TIMEOUT)] ${agentName} for ${id} - already marked as pending`);
            return;
        }
        
        log(`[🏁 FINISHED] ${agentName} for ${id} (Exit: ${code})`);
        
        // Try to parse output for verdict
        const fullOutput = stdout + '\n' + stderr;
        const context = parseAgentOutput(fullOutput);
        
        if (context) {
            log(`[⚖️ VERDICT] ${id}: ${context.verdict}`);
            
            // Save context file for audit
            try {
                fs.writeFileSync(contextFile, JSON.stringify({
                    ...context,
                    agent: agentName,
                    task_id: id,
                    exit_code: code,
                    timestamp: new Date().toISOString()
                }, null, 2));
            } catch (e) {}
            
            if (context.verdict === 'approved' || context.verdict === 'pass' || context.verdict === 'completed') {
                updateTask(id, { status: 'completed', completed_at: new Date().toISOString() });
            } else {
                updateTask(id, { 
                    status: 'pending', 
                    retry_count: (task.retry_count || 0) + 1, 
                    last_error: context.summary || 'Agent rejected',
                    last_output: fullOutput.substring(0, 1000)
                });
            }
        } else {
            // No verdict found - check exit code
            if (code === 0) {
                log(`[✅ SUCCESS] ${id} completed (exit 0, no explicit verdict)`);
                updateTask(id, { status: 'completed', completed_at: new Date().toISOString() });
                
                // Write default context
                try {
                    fs.writeFileSync(contextFile, JSON.stringify({
                        verdict: 'completed',
                        summary: 'Agent completed successfully',
                        agent: agentName,
                        task_id: id,
                        exit_code: code,
                        timestamp: new Date().toISOString()
                    }, null, 2));
                } catch (e) {}
            } else {
                log(`[❌ FAILURE] ${id} failed (exit ${code}, no verdict)`);
                updateTask(id, { 
                    status: 'pending', 
                    retry_count: (task.retry_count || 0) + 1,
                    last_error: `Agent exited with code ${code}`,
                    last_output: fullOutput.substring(0, 1000)
                });
            }
        }
    });

    child.on('error', (err) => {
        clearTimeout(timeout);
        log(`[❌ SPAWN ERROR] ${err.message}`);
        updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1, last_error: err.message });
    });
}

function orchestrate() {
    if (isShuttingDown) return;
    
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        const pendingTasks = data.tasks.filter(t => t.status === 'pending');

        for (const task of pendingTasks) {
            const agent = selectAgent(task);
            runAgent(agent, task);
            // Only dispatch one task per cycle to avoid race conditions
            break;
        }
    } catch (e) {
        log(`[FATAL] ${e.message}`);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    log('[SHUTDOWN] SIGTERM received, stopping...');
    isShuttingDown = true;
    setTimeout(() => process.exit(0), 1000);
});

process.on('SIGINT', () => {
    log('[SHUTDOWN] SIGINT received, stopping...');
    isShuttingDown = true;
    setTimeout(() => process.exit(0), 1000);
});

// Startup
log("========================================");
log("Orchestrator V7.0 (Protocol-Aware) Starting");
log("========================================");

// Recover stuck tasks on startup
recoverStuckTasks();

// Start polling
setInterval(orchestrate, 15000);
orchestrate();