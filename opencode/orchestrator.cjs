const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * ORCHESTRATOR V7.6 (Turn-Aware Chain Edition)
 * Implementation of Dev -> Review -> Done pipeline.
 */

const AGENCY_ROOT = __dirname;
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const CONTEXT_DIR = path.join(AGENCY_ROOT, '.run', 'context');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

const LIMITS = {
    MAX_RETRIES: 3,
    COOLDOWN_MS: 30000,
    AGENT_TIMEOUT_MS: 360000  // 6 minutes
};

const lastDispatchTimes = new Map();
let isShuttingDown = false;

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

function notifyTelegram(text) {
    if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
    spawn('curl', ['-s', '-o', '/dev/null', '-X', 'POST', `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, '-d', `chat_id=${CONFIG.TELEGRAM_CHAT_ID}`, '--data-urlencode', `text=${text}`], { stdio: 'ignore' });
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
    // If explicitly in review, use reviewer
    if (task.status === 'awaiting_review') return 'code-reviewer';
    
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
    const contextMatch = output.match(/@@@WRITE_CONTEXT:(\w+)@@@\n?([\s\S]*?)\n?@@@END_WRITE@@@/);
    if (contextMatch) {
        try {
            return JSON.parse(contextMatch[2]);
        } catch (e) {
            log(`[WARN] Failed to parse context JSON: ${e.message}`);
        }
    }
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
    if (isShuttingDown) return;
    
    if ((task.retry_count || 0) >= LIMITS.MAX_RETRIES) {
        log(`[🚨 CIRCUIT BREAKER] Task ${id} blocked after 3 failures.`);
        notifyTelegram(`🚨 *CIRCUIT BREAKER*\nTask \`${id}\` blocked after 3 failures.`);
        updateTask(id, { 
            status: 'blocked', 
            error: 'Exceeded retry limit (Rule of Three)',
            retry_count: LIMITS.MAX_RETRIES 
        });
        return;
    }

    const now = Date.now();
    const lastTime = lastDispatchTimes.get(id) || 0;
    if (now - lastTime < LIMITS.COOLDOWN_MS) return;
    lastDispatchTimes.set(id, now);

    const prevStatus = task.status;
    updateTask(id, { status: 'in_progress', started_at: new Date().toISOString() });
    log(`[DISPATCH] ${agentName} for ${id} (Mode: ${prevStatus})`);
    
    const workspace = CONFIG.PROJECT_WORKSPACE || "/root/Playground_AI_Dev";
    const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
    
    if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR, { recursive: true });
    
    // Inject review context if needed
    let dynamicPrompt = task.description || task.content || `Complete task: ${id}`;
    if (prevStatus === 'awaiting_review') {
        dynamicPrompt = `REVIEW THE FOLLOWING TASK COMPLETION:\nTask: ${dynamicPrompt}\n\nReview the current workspace for changes and verify they meet requirements. Include 'APPROVED' or 'REJECTED' in your verdict.`;
    }

    const child = spawn(opencodeBin, [
        'run', dynamicPrompt,
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
        notifyTelegram(`⏱️ *TIMEOUT*\nAgent \`${agentName}\` for task \`${id}\` reached 6m limit.`);
        child.kill('SIGKILL');
        updateTask(id, { 
            status: prevStatus, // Return to previous state (pending or awaiting_review)
            retry_count: (task.retry_count || 0) + 1, 
            last_error: `Agent timed out after ${LIMITS.AGENT_TIMEOUT_MS/1000}s`
        });
    }, LIMITS.AGENT_TIMEOUT_MS);

    child.on('close', (code) => {
        clearTimeout(timeout);
        if (isTimedOut) return;
        
        log(`[🏁 FINISHED] ${agentName} for ${id} (Exit: ${code})`);
        const fullOutput = stdout + '\n' + stderr;
        const context = parseAgentOutput(fullOutput);
        
        // Summary extraction
        let agentSummary = "No summary provided.";
        const summaryMatch = fullOutput.match(/(?:summary|conclusion|done|review):\s*([\s\S]*?)(?:\n\n|$)/i);
        if (summaryMatch) {
            agentSummary = summaryMatch[1].trim();
        } else {
            agentSummary = fullOutput.trim().split('\n').slice(-3).join('\n');
        }

        if (prevStatus === 'pending' || prevStatus === 'in_progress') {
            // DEVELOPER FINISHED -> GO TO REVIEW
            if (code === 0 || (context && context.verdict === 'approved')) {
                log(`[⛓️ CHAIN] ${id} developer success -> Move to code-reviewer`);
                notifyTelegram(`🛠️ *DEV SUCCESS*\nID: \`${id}\`\nSummary: _${agentSummary}_\n\n⚖️ *Dispatching Reviewer...*`);
                updateTask(id, { status: 'awaiting_review', retry_count: 0 });
            } else {
                notifyTelegram(`❌ *DEV FAILED*\nID: \`${id}\`\nRetrying...`);
                updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
            }
        } else if (prevStatus === 'awaiting_review') {
            // REVIEWER FINISHED -> GO TO COMPLETED OR BACK TO DEV
            if (context && context.verdict === 'approved') {
                log(`[⚖️ APPROVED] ${id} review passed -> Completed`);
                notifyTelegram(`✅ *GOVERNANCE PASSED*\nID: \`${id}\`\nReview: _${agentSummary}_\n\n🚀 *Task officially Closed.*`);
                updateTask(id, { status: 'completed', completed_at: new Date().toISOString() });
            } else {
                log(`[⚖️ REJECTED] ${id} review failed -> Back to pending`);
                notifyTelegram(`🛡️ *REVIEW REJECTED*\nID: \`${id}\`\nIssues: _${agentSummary}_\n\n🔄 *Returning to Developer.*`);
                updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
            }
        }
    });
}

function orchestrate() {
    if (isShuttingDown) return;
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        // Prioritize Reviewing tasks
        const nextTask = data.tasks.find(t => t.status === 'awaiting_review') || data.tasks.find(t => t.status === 'pending');
        if (nextTask) {
            const agent = selectAgent(nextTask);
            runAgent(agent, nextTask);
        }
    } catch (e) { log(`[FATAL] ${e.message}`); }
}

process.on('SIGTERM', () => { isShuttingDown = true; setTimeout(() => process.exit(0), 1000); });
process.on('SIGINT', () => { isShuttingDown = true; setTimeout(() => process.exit(0), 1000); });

log("========================================");
log("Orchestrator V7.6 (Turn-Aware Chain) Starting");
log("========================================");
recoverStuckTasks();
setInterval(orchestrate, 15000);
orchestrate();
