const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

/**
 * ORCHESTRATOR V8.0 (ALIGNMENT & BRAIN-LOOP EDITION)
 * 
 * Features:
 * 1. MEMORY BRIDGE: Injects Reviewer notes into Developer prompts.
 * 2. ALIGNMENT FILES: Forces agents to read /root/FutureOfDev/opencode/ALIGNMENT.md.
 * 3. BRAIN-LOOP: In-process self-correction before finishing.
 * 4. GOVERNANCE: Dev -> Review -> Done chain.
 */

const AGENCY_ROOT = __dirname;
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');
const ALIGNMENT_PATH = path.join(AGENCY_ROOT, 'ALIGNMENT.md');

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

const LIMITS = {
    MAX_RETRIES: 5,        // Increased from 3 - KPI loop has internal retries
    COOLDOWN_MS: 30000,
    AGENT_TIMEOUT_MS: 480000, // 8 minutes - increased for KPI loops
    MAX_CHAIN_LAPS: 5      // Increased from 3
};

const lastDispatchTimes = new Map();
let isShuttingDown = false;

// Ensure Alignment file exists
if (!fs.existsSync(ALIGNMENT_PATH)) {
    fs.writeFileSync(ALIGNMENT_PATH, `# AGENCY ALIGNMENT STANDARDS
- Use modular, clean code.
- Always verify your work with a 'check' or 'ls' before finishing.
- Provide a clear 'Summary:' at the end of your output.
- If you see a [REJECTION NOTES] block, address it first.`);
}

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
            // State Machine Fix: Clear completed_at when moving to non-completed states
            if (updates.status && updates.status !== 'completed') {
                updates.completed_at = null;
            }
            // State Machine Fix: Set completed_at when completing
            if (updates.status === 'completed' && !updates.completed_at) {
                updates.completed_at = new Date().toISOString();
            }
            data.tasks[idx] = { ...data.tasks[idx], ...updates, updated_at: new Date().toISOString() };
            fs.writeFileSync(TASKS_PATH, JSON.stringify(data, null, 2));
        }
    } catch (e) { log(`[ERROR] Update failed: ${e.message}`); }
}

// ============================================
// FILE EXISTENCE CHECK FOR REVIEWER
// ============================================
function checkTaskFiles(taskDescription, workspace) {
    const results = { exists: [], missing: [], modified: [] };
    
    // Extract potential file paths from task description
    const filePatterns = [
        /([a-zA-Z0-9_\-\/]+\.(vue|ts|tsx|go|js|jsx))/gi,
        /(?:create|add|modify|update)\s+([a-zA-Z0-9_\-\/]+\.(vue|ts|tsx|go|js|jsx))/gi
    ];
    
    const mentionedFiles = new Set();
    for (const pattern of filePatterns) {
        let match;
        while ((match = pattern.exec(taskDescription)) !== null) {
            mentionedFiles.add(match[1]);
        }
    }
    
    // Check each mentioned file
    for (const file of mentionedFiles) {
        // Try both relative and absolute paths
        const paths = [
            path.join(workspace, file),
            file.startsWith('/') ? file : null
        ].filter(Boolean);
        
        for (const filePath of paths) {
            if (fs.existsSync(filePath)) {
                try {
                    const stat = fs.statSync(filePath);
                    // File exists and was modified recently (within 1 hour)
                    const isRecent = (Date.now() - stat.mtimeMs) < 3600000;
                    if (isRecent) {
                        results.modified.push(filePath);
                    } else {
                        results.exists.push(filePath);
                    }
                } catch (e) {
                    results.exists.push(filePath);
                }
                break;
            }
        }
    }
    
    return results;
}

function selectAgent(task) {
    if (task.status === 'awaiting_review') return 'code-reviewer';
    return 'dev-unit'; // Default to developer
}

function parseAgentOutput(output) {
    const lower = output.toLowerCase();
    if (lower.includes('approved') || lower.includes('✅')) return { verdict: 'approved' };
    if (lower.includes('rejected') || lower.includes('❌')) return { verdict: 'rejected' };
    return null;
}

async function runAgent(agentName, task) {
    const id = task.id;
    if (isShuttingDown) return;

    // CRITICAL: Define workspace and opencodeBin BEFORE any early returns
    const workspace = CONFIG.PROJECT_WORKSPACE || "/root/Playground_AI_Dev";
    const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';

    if ((task.retry_count || 0) >= LIMITS.MAX_RETRIES) {
        updateTask(id, { status: 'blocked', error: 'Max retries' });
        notifyTelegram(`🚨 *CIRCUIT BREAKER* \`${id}\` blocked.`);
        return;
    }

    // 2. Governance Loop Breaker (The Architect/Supreme Court Intervention)
    if ((task.chain_laps || 0) >= LIMITS.MAX_CHAIN_LAPS) {
        log(`[🏛️ ARCHITECT INTERVENTION] Task ${id} reached loop limit. Summoning Supreme Court...`);
        notifyTelegram(`🏛️ *ARCHITECT INTERVENTION*\nTask \`${id}\` reached loop limit. Summoning higher intelligence to break the stalemate...`);
        
        // Mark task as in_progress to prevent re-dispatch during Architect deliberation
        updateTask(id, { status: 'in_progress' });
        
        const architectModel = "openrouter/google/gemini-3-flash-preview";
        const architectPrompt = `[SUPREME COURT / ARCHITECT TURN]
You are the Lead Architect. Two agents (Developer and Reviewer) are in a stalemate.
TASK: ${task.description}
LAST REJECTION NOTES: ${task.rejection_notes}

YOUR JOB:
1. Examine the project in ${workspace}.
2. Decided if the current implementation is "Good Enough" or if specific fixes are needed.
3. If "Good Enough", provide a summary and end with 'VERDICT: APPROVED'.
4. If not, provide the FINAL MANDATORY SPEC and end with 'VERDICT: REJECTED'. This is the last chance.`;

        const child = spawn(opencodeBin, ['run', architectPrompt, '--agent', 'dev-unit', '--model', architectModel, '--dir', workspace], {
            cwd: AGENCY_ROOT,
            env: { ...process.env, PROJECT_ID: id },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '', stderr = '';
        child.stdout.on('data', d => stdout += d);
        child.stderr.on('data', d => stderr += d);

        child.on('close', code => {
            const full = stdout + '\n' + stderr;
            const isApproved = full.toUpperCase().includes('VERDICT: APPROVED');
            
            let summary = "Architect has spoken.";
            const sm = full.match(/(?:Summary|Verdict|Decision):\s*([\s\S]*?)(?:\n\n|$)/i);
            summary = sm ? sm[1].trim() : full.trim().split('\n').slice(-5).join('\n');

            if (isApproved) {
                notifyTelegram(`🏛️ *ARCHITECT OVERRULED REVIEWER*\nID: \`${id}\`\nDecision: _${summary}_\n\n🚀 *Task Closed by Supreme Court.*`);
                updateTask(id, { status: 'completed', completed_at: new Date().toISOString() });
            } else {
                notifyTelegram(`🏛️ *ARCHITECT MANDATED CHANGES*\nID: \`${id}\`\nFinal Spec: _${summary}_\n\n🔄 *Developer must follow this exactly.*`);
                updateTask(id, { status: 'pending', chain_laps: 0, rejection_notes: `[ARCHITECT FINAL SPEC]: ${summary}` });
            }
        });
        return;
    }

    const now = Date.now();
    const lastTime = lastDispatchTimes.get(id) || 0;
    if (now - lastTime < LIMITS.COOLDOWN_MS) return;
    lastDispatchTimes.set(id, now);

    const prevStatus = task.status;
    updateTask(id, { status: 'in_progress', started_at: new Date().toISOString() });
    
    // --- BRAIN-LOOP PROMPT CONSTRUCTION ---
    let prompt = `[ALIGNMENT] Read ${ALIGNMENT_PATH} before starting.\n\n`;
    prompt += `[TASK] ${task.description}\n\n`;
    
    if (prevStatus === 'pending' && task.rejection_notes) {
        prompt += `[REJECTION NOTES FROM PREVIOUS TURN]\n${task.rejection_notes}\n\n`;
        prompt += `Fix the issues mentioned above. Do not repeat the same mistakes.\n\n`;
    }

    if (prevStatus === 'awaiting_review') {
        // Check if files mentioned in task exist before reviewing
        const fileCheck = checkTaskFiles(task.description, workspace);
        let fileContext = '';
        if (fileCheck.modified.length > 0) {
            fileContext = `\n\n[FILES RECENTLY MODIFIED - TASK LIKELY COMPLETED]\n${fileCheck.modified.map(f => `✓ ${f}`).join('\n')}`;
        } else if (fileCheck.exists.length > 0) {
            fileContext = `\n\n[FILES EXIST]\n${fileCheck.exists.map(f => `○ ${f}`).join('\n')}`;
        }
        
        prompt = `[REVIEW TURN] Audit the work done for: ${task.description}.\n${fileContext}\n\nVerify logic, mobile responsiveness, and clean code.\n\nIf the files above exist and contain the expected functionality, APPROVE.\nProvide 'APPROVED' or 'REJECTED'.`;
    } else {
        // Force a Brain-Loop concept for the Dev
        prompt += `[BRAIN-LOOP] Before finishing, perform a self-review. Ensure all edge cases defined in requirements are met. Provide a 'Summary:' of changes.`;
    }

    log(`[DISPATCH] ${agentName} for ${id}`);
    
    // In V8.2, we use the specialized dev-unit.cjs wrapper for all dev tasks
    const isDevTask = agentName === 'dev-unit';
    const cmd = isDevTask ? 'node' : opencodeBin;
    const args = isDevTask 
        ? [path.join(AGENCY_ROOT, 'dev-unit.cjs'), id, prompt, workspace]
        : ['run', prompt, '--agent', agentName, '--dir', workspace];

    const child = spawn(cmd, args, {
        cwd: AGENCY_ROOT,
        env: { ...process.env, PROJECT_ID: id },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);

    let timeout = setTimeout(() => {
        child.kill('SIGKILL');
        updateTask(id, { status: prevStatus, retry_count: (task.retry_count || 0) + 1 });
    }, LIMITS.AGENT_TIMEOUT_MS);

    child.on('close', code => {
        clearTimeout(timeout);
        const full = stdout + '\n' + stderr;
        const context = parseAgentOutput(full);
        
        let summary = "N/A";
        const sm = full.match(/(?:summary|conclusion):\s*([\s\S]*?)(?:\n\n|$)/i);
        summary = sm ? sm[1].trim() : full.trim().split('\n').slice(-2).join(' ');

        if (prevStatus === 'pending' || prevStatus === 'in_progress') {
            if (code === 0) {
                notifyTelegram(`🛠️ *DEV BRAIN-LOOP DONE*\nID: \`${id}\`\nSummary: _${summary}_`);
                updateTask(id, { status: 'awaiting_review' });
            } else {
                updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
            }
        } else if (prevStatus === 'awaiting_review') {
            if (context && context.verdict === 'approved') {
                notifyTelegram(`✅ *APPROVED*\nID: \`${id}\`\nNotes: _${summary}_`);
                updateTask(id, { status: 'completed' });
            } else {
                const laps = (task.chain_laps || 0) + 1;
                notifyTelegram(`🛡️ *REJECTED* (${laps}/${LIMITS.MAX_CHAIN_LAPS})\nID: \`${id}\`\nCritique: _${summary}_`);
                updateTask(id, { status: 'pending', chain_laps: laps, rejection_notes: summary });
            }
        }
    });
}

function orchestrate() {
    if (isShuttingDown) return;
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        const next = data.tasks.find(t => t.status === 'awaiting_review') || data.tasks.find(t => t.status === 'pending');
        if (next) runAgent(selectAgent(next), next);
    } catch (e) {}
}

setInterval(orchestrate, 15000);
orchestrate();
log("Orchestrator V8.3 (Team Talk) Started.");
