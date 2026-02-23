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
 * 5. ONE-SHOT MODE: For benchmark runner (--task <id>)
 */

const AGENCY_ROOT = __dirname;
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const LOG_PATH = path.join(AGENCY_ROOT, '.run', 'agency.log');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');
const ALIGNMENT_PATH = path.join(AGENCY_ROOT, 'ALIGNMENT.md');

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

// Define BENCHMARK_TASKS_PATH after CONFIG is loaded
const BENCHMARK_TASKS_PATH = path.join(CONFIG.PROJECT_WORKSPACE, 'benchmark', 'tasks');

const LIMITS = {
    MAX_RETRIES: 5,        // Increased from 3 - KPI loop has internal retries
    COOLDOWN_MS: 30000,
    AGENT_TIMEOUT_MS: 480000, // 8 minutes - increased for KPI loops
    MAX_CHAIN_LAPS: 5      // Increased from 3
};

const lastDispatchTimes = new Map();
let isShuttingDown = false;

// ============================================
// ONE-SHOT MODE (BENCHMARK RUNNER)
// ============================================
const taskArgIndex = process.argv.indexOf('--task');
const isOneShotMode = taskArgIndex !== -1 && taskArgIndex < process.argv.length - 1;

if (isOneShotMode) {
    const taskId = process.argv[taskArgIndex + 1];
    console.log(`\n=== ONE-SHOT MODE: Task ${taskId} ===\n`);
    
    // Run single task and exit
    runOneShotTask(taskId)
        .then(result => {
            console.log(`\n=== ONE-SHOT COMPLETE: ${result.success ? 'SUCCESS' : 'FAILED'} ===\n`);
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error(`\n=== ONE-SHOT ERROR: ${err.message} ===\n`, err.stack);
            process.exit(1);
        });
    
    // Don't continue to daemon mode
    return;
}

// ============================================
// DAEMON MODE (DEFAULT)
// ============================================

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
// ONE-SHOT TASK EXECUTION (BENCHMARK)
// ============================================
function loadTaskById(taskId) {
    // First try to load from tasks.json (daemon mode)
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
        const task = data.tasks.find(t => t.id === taskId);
        if (task) return task;
    } catch (e) {
        // tasks.json may not exist for benchmark mode
    }
    
    // Second try: load from tasks/ directory (benchmark files)
    try {
        // Load directly by ID (benchmark files are named like bench-001.json)
        const taskFile = path.join(BENCHMARK_TASKS_PATH, `${taskId}.json`);
        if (fs.existsSync(taskFile)) {
            const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
            console.log(`[ONE-SHOT] Loaded task from: ${taskFile}`);
            return task;
        }
    } catch (e) {
        console.error(`[ONE-SHOT] Failed to load task ${taskId}:`, e.message);
    }
    
    return null;
}

async function runOneShotTask(taskId) {
    const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';
    
    // Load task
    const task = loadTaskById(taskId);
    if (!task) {
        console.error(`[ONE-SHOT] Task not found: ${taskId}`);
        return { success: false, error: 'Task not found' };
    }
    
    const workspace = CONFIG.PROJECT_WORKSPACE;
    console.log(`Task: ${task.name || task.description}`);
    console.log(`Category: ${task.category || 'N/A'}`);
    console.log(`Difficulty: ${task.difficulty || 'N/A'}`);
    console.log(`Workspace: ${workspace}\n`);
    
    // Auto-onboard if dependencies are missing
    await autoOnboardWorkspace(workspace);

    const startTime = Date.now();
    const kpis = {
        typescript: false,
        lint: false,
        build: false,
        tests: false,
        startTime: startTime
    };
    
    try {
        // Step 1: Run PM for planning (if available)
        let plannedTask = { ...task };
        let keywords = [];
        let taskIntent = 'CREATE'; // Default for benchmark

        try {
            console.log('[1/4] Running PM for planning...\n');
            
            const pmPrompt = `You are the PM (Project Manager). Analyze this task and create a plan.
TASK: ${task.description}
REQUIREMENTS: ${JSON.stringify(task.requirements, null, 2)}

OUTPUT:
- Identify the intent (CREATE/MODIFY)
- List keywords for file discovery
- List files to create/modify (absolute paths)
- End with "PLAN COMPLETE"`;
            
            const pmResult = await spawnPromise(opencodeBin, ['run', pmPrompt, '--agent', 'pm', '--dir', workspace], { timeout: 120000 });
            console.log(pmResult.stdout);
            
            // Parse PM output for intent
            const intentMatch = pmResult.stdout.match(/intent[:\s]*(CREATE|MODIFY|DELETE)/i);
            if (intentMatch) taskIntent = intentMatch[1].toUpperCase();

            // Parse PM output for keywords
            const keywordMatch = pmResult.stdout.match(/keywords?[:\s]*([^\n]+)/i);
            if (keywordMatch) keywords = extractKeywords(keywordMatch[1]);

            // Parse PM output for file list - match both "FILES:" and "**FILES TO CREATE/MODIFY**"
            const fileMatch = pmResult.stdout.match(/(?:files?|FILES TO CREATE\/MODIFY)[:\*\s]*([\s\S]*?)(?:\n\n[A-Z]|\n\n|PLAN COMPLETE|$)/i);
            if (fileMatch) {
                plannedTask.files = extractFilesFromText(fileMatch[1]);
                console.log(`[PM] Identified ${plannedTask.files?.length || 0} files`);
            }
        } catch (e) {
            console.warn('[ONE-SHOT] PM failed, proceeding with task description only');
        }
        
        // Step 2: Run dev-unit for execution
        console.log('\n[2/4] Running dev-unit for execution...\n');
        
        // Force intent into beginning of description to help dev-unit regex
        const effectiveDesc = `${taskIntent}: ${task.description}`;
        const devPrompt = `[ALIGNMENT] Read ${ALIGNMENT_PATH} before starting.
[TASK] ${effectiveDesc}
[REQUIREMENTS] ${JSON.stringify(task.requirements, null, 2)}
[BRAIN-LOOP] Before finishing, verify all KPIs pass.
[MANDATORY] Do NOT just research. CREATE or MODIFY files as specified in the requirements.
[CRITICAL] IMMEDIATELY start creating files. Do NOT ask questions. Use 'write' tool now.
[OUTPUT] When done, provide a 'Summary:' showing all created files.`;

        // Update task JSON with PM findings
        plannedTask.intent = taskIntent;
        plannedTask.keywords = keywords;
        plannedTask.description = effectiveDesc;

        // Write task JSON to temp file for dev-unit discovery phase
        const taskJsonPath = path.join(AGENCY_ROOT, '.run', `task_${taskId}.json`);
        if (!fs.existsSync(path.dirname(taskJsonPath))) fs.mkdirSync(path.dirname(taskJsonPath), { recursive: true });
        fs.writeFileSync(taskJsonPath, JSON.stringify(plannedTask, null, 2));

        // Use absolute path for dev-unit.cjs
        const devUnitScript = path.join(AGENCY_ROOT, 'dev-unit.cjs');
        const devResult = await spawnPromise('node', [devUnitScript, taskId, devPrompt, workspace, taskJsonPath].filter(Boolean), { 
            timeout: 600000,
            env: { ...process.env, ONE_SHOT: 'true' }  // Signal one-shot mode to dev-unit
        });
        console.log(devResult.stdout);
        
        // Step 3: Verify KPIs
        console.log('\n[3/4] Verifying KPIs...\n');
        
        // TypeScript
        console.log('  Checking TypeScript...');
        const tsResult = await checkTypeScript(workspace);
        kpis.typescript = tsResult.passed;
        console.log(`  TypeScript: ${tsResult.passed ? '✅' : '❌'} ${tsResult.output || ''}`);
        
        // Lint
        console.log('  Checking Lint...');
        const lintResult = await checkLint(workspace);
        kpis.lint = lintResult.passed;
        console.log(`  Lint: ${lintResult.passed ? '✅' : '❌'} ${lintResult.output || ''}`);
        
        // Build
        console.log('  Checking Build...');
        const buildResult = await checkBuild(workspace);
        kpis.build = buildResult.passed;
        console.log(`  Build: ${buildResult.passed ? '✅' : '❌'} ${buildResult.output || ''}`);
        
        // Tests
        console.log('  Checking Tests...');
        const testResult = await checkTests(workspace);
        kpis.tests = testResult.passed;
        console.log(`  Tests: ${testResult.passed ? '✅' : '❌'} ${testResult.output || ''}`);
        
        const allPassed = kpis.typescript && kpis.lint && kpis.build && kpis.tests;
        const duration = Date.now() - startTime;
        
        console.log('\n[4/4] Results Summary:');
        console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log(`  KPI Status: ${allPassed ? '✅ ALL PASS' : '❌ SOME FAILED'}`);
        
        // Print structured output for benchmark runner
        console.log('\n[KPI_RESULTS]');
        console.log(JSON.stringify(kpis, null, 2));
        
        return {
            success: allPassed,
            kpis,
            duration,
            filesCreated: plannedTask.files || []
        };
        
    } catch (error) {
        console.error('\n[ONE-SHOT ERROR]:', error.message);
        return {
            success: false,
            kpis,
            error: error.message
        };
    }
}

function extractKeywords(text) {
    return text.split(/[,;|]/).map(k => k.trim()).filter(k => k.length > 0);
}

function extractFilesFromText(text) {
    const files = [];
    const filePatterns = [
        /([a-zA-Z0-9_\-\/]+\.(vue|ts|tsx|go|js|jsx))/gi
    ];
    
    for (const pattern of filePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            files.push(match[1]);
        }
    }
    
    return [...new Set(files)]; // Deduplicate
}

async function spawnPromise(cmd, args, options = {}) {
    return new Promise((resolve, reject) => {
        // Construct full path for frontend/backend bins
        const nodeBinPath = options.cwd ? path.join(options.cwd, 'node_modules', '.bin') : '';
        const systemPath = process.env.PATH || '';
        const extendedPath = nodeBinPath ? `${nodeBinPath}:${systemPath}` : systemPath;

        const spawnOptions = {
            cwd: AGENCY_ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { 
                ...process.env, 
                PATH: extendedPath,
                PROJECT_WORKSPACE: CONFIG.PROJECT_WORKSPACE 
            },
            ...options
        };
        
        const child = spawn(cmd, args, spawnOptions);
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', d => stdout += d);
        child.stderr.on('data', d => stderr += d);
        
        child.on('close', code => {
            resolve({ stdout, stderr, code });
        });
        
        child.on('error', reject);
        
        if (options.timeout) {
            setTimeout(() => {
                child.kill();
                reject(new Error(`Timeout after ${options.timeout}ms`));
            }, options.timeout);
        }
    });
}

async function checkTypeScript(workspace) {
    try {
        const frontendPath = path.join(workspace, 'frontend');
        if (!fs.existsSync(frontendPath)) return { passed: true };
        
        const result = await spawnPromise('npm', ['run', 'type-check'], { cwd: frontendPath, timeout: 60000 });
        return { 
            passed: result.code === 0,
            output: result.stderr || result.stdout
        };
    } catch (e) {
        return { passed: false, error: e.message };
    }
}

async function checkLint(workspace) {
    try {
        const frontendPath = path.join(workspace, 'frontend');
        const backendPath = path.join(workspace, 'backend');
        
        // Frontend lint
        let frontendResult = { code: 0 };
        if (fs.existsSync(frontendPath)) {
            frontendResult = await spawnPromise('npm', ['run', 'lint'], { cwd: frontendPath, timeout: 60000 });
        }
        
        // Backend lint
        let backendResult = { code: 0 };
        if (fs.existsSync(backendPath)) {
            const env = { ...process.env, PATH: '/usr/local/go/bin:' + process.env.PATH };
            backendResult = await spawnPromise('golangci-lint', ['run', './...'], { cwd: backendPath, timeout: 60000, env });
        }
        
        return { 
            passed: frontendResult.code === 0 && backendResult.code === 0,
            output: `frontend:${frontendResult.code}, backend:${backendResult.code}`
        };
    } catch (e) {
        return { passed: false, error: e.message };
    }
}

async function checkBuild(workspace) {
    try {
        const frontendPath = path.join(workspace, 'frontend');
        const backendPath = path.join(workspace, 'backend');
        
        // Frontend build
        let frontendResult = { code: 0 };
        if (fs.existsSync(frontendPath)) {
            frontendResult = await spawnPromise('npm', ['run', 'build-only'], { cwd: frontendPath, timeout: 120000 });
        }
        
        // Backend build
        let backendResult = { code: 0 };
        if (fs.existsSync(backendPath)) {
            const env = { ...process.env, PATH: '/usr/local/go/bin:' + process.env.PATH };
            backendResult = await spawnPromise('go', ['build', '-o', '/dev/null', './cmd/main.go'], { cwd: backendPath, timeout: 60000, env });
        }
        
        return { 
            passed: frontendResult.code === 0 && backendResult.code === 0,
            output: `frontend:${frontendResult.code}, backend:${backendResult.code}`
        };
    } catch (e) {
        return { passed: false, error: e.message };
    }
}

async function checkTests(workspace) {
    try {
        const frontendPath = path.join(workspace, 'frontend');
        const backendPath = path.join(workspace, 'backend');
        
        // Frontend tests
        let frontendResult = { code: 0, stdout: '' };
        if (fs.existsSync(frontendPath)) {
            frontendResult = await spawnPromise('npm', ['run', 'test:unit', '--', '--run'], { cwd: frontendPath, timeout: 60000 });
        }
        
        // Backend tests
        let backendResult = { code: 0, stdout: '' };
        if (fs.existsSync(backendPath)) {
            const env = { ...process.env, PATH: '/usr/local/go/bin:' + process.env.PATH };
            backendResult = await spawnPromise('go', ['test', './...'], { cwd: backendPath, timeout: 60000, env });
        }
        
        const frontendPassed = frontendResult.stdout.includes('passed');
        const backendPassed = backendResult.stdout.includes('PASS') || backendResult.stdout.includes('ok');
        
        return { 
            passed: frontendPassed && backendPassed,
            output: `frontend:${frontendPassed ? 'pass' : 'fail'}, backend:${backendPassed ? 'pass' : 'fail'}`
        };
    } catch (e) {
        return { passed: false, error: e.message };
    }
}

// ============================================
// SELF-HEALING BOOTSTRAP (AUTO-ONBOARDING)
// ============================================
async function autoOnboardWorkspace(workspace) {
    console.log('\n🔧 [SELF-HEALING] Verifying workspace dependencies...');
    
    const frontendPath = path.join(workspace, 'frontend');
    const backendPath = path.join(workspace, 'backend');

    if (fs.existsSync(frontendPath)) {
        if (!fs.existsSync(path.join(frontendPath, 'node_modules'))) {
            console.log('  📦 node_modules missing. Running npm install...');
            await spawnPromise('npm', ['install'], { cwd: frontendPath, timeout: 300000 });
        }
    }

    if (fs.existsSync(backendPath)) {
        console.log('  🐹 Running go mod tidy...');
        const env = { ...process.env, PATH: '/usr/local/go/bin:' + process.env.PATH };
        await spawnPromise('go', ['mod', 'tidy'], { cwd: backendPath, timeout: 60000, env });
    }
    
    console.log('✅ [SELF-HEALING] Workspace ready.\n');
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
                
                // Auto-commit and push changes
                try {
                    const { execSync } = require('child_process');
                    const commitMsg = `feat: ${task.title || id} completed`;
                    execSync('git -C /root/EmpoweredPixels add -A', { stdio: 'ignore' });
                    execSync(`git -C /root/EmpoweredPixels commit -m "${commitMsg}"`, { stdio: 'ignore' });
                    execSync('git -C /root/EmpoweredPixels push origin main', { stdio: 'ignore' });
                    notifyTelegram(`📦 *COMMITTED & PUSHED*\nID: \`${id}\`\nMsg: _${commitMsg}_`);
                } catch (e) {
                    notifyTelegram(`⚠️ *COMMIT FAILED*\nID: \`${id}\`\nError: ${e.message}`);
                }
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
    
    // Add files from PM planning if available
    if (task.files && task.files.length > 0) {
        prompt += `[TARGET FILES]\n`;
        prompt += `The following files have been identified for this task:\n`;
        task.files.forEach(f => prompt += `- ${f}\n`);
        prompt += `\n[INSTRUCTION] Focus on these files. Use absolute paths as shown above.\n\n`;
    }
    
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
    
    // Write task JSON to temp file for dev-unit discovery phase
    let taskJsonPath = null;
    if (isDevTask && task) {
        taskJsonPath = path.join(AGENCY_ROOT, '.run', `task_${id}.json`);
        try {
            fs.writeFileSync(taskJsonPath, JSON.stringify(task, null, 2));
        } catch (e) {
            log(`Failed to write task JSON: ${e.message}`);
            taskJsonPath = null;
        }
    }
    
    const args = isDevTask 
        ? [path.join(AGENCY_ROOT, 'dev-unit.cjs'), id, prompt, workspace, taskJsonPath].filter(Boolean)
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
                
                // FIX P0-2: Track subtask completion for crash recovery
                const isSubtask = id.includes('-');  // task-005-1, task-005-2, etc.
                if (isSubtask) {
                    // Extract parent ID (task-005-1 → task-005)
                    const parentId = id.split('-').slice(0, 2).join('-');
                    
                    try {
                        const data = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
                        const parent = data.tasks.find(t => t.id === parentId);
                        
                        if (parent) {
                            // Add this subtask to completed list
                            const completed = parent.subtasks_completed || [];
                            if (!completed.includes(id)) {
                                completed.push(id);
                                
                                // Update parent task
                                updateTask(parentId, { 
                                    subtasks_completed: completed,
                                    subtasks_pending: (parent.subtasks || [])
                                        .map(st => st.id || st)
                                        .filter(stId => !completed.includes(stId))
                                });
                                
                                log(`[SUBTASK TRACKING] ${id} completed (${completed.length} total)`);
                                
                                // Check if all subtasks completed
                                const allSubtasks = data.tasks.filter(t => t.parent_id === parentId);
                                const allCompleted = allSubtasks.every(st => 
                                    st.status === 'completed' || st.status === 'awaiting_review'
                                );
                                
                                if (allCompleted && allSubtasks.length > 0) {
                                    log(`[SUBTASK CHAIN COMPLETE] All ${allSubtasks.length} subtasks done for ${parentId}`);
                                    notifyTelegram(`✅ *All Subtasks Complete*\n\nParent: \`${parentId}\`\nSubtasks: ${allSubtasks.length}\n\nParent task ready for final review.`);
                                    // Mark parent as ready for review
                                    updateTask(parentId, { status: 'awaiting_review' });
                                }
                            }
                        }
                    } catch (e) {
                        log(`[SUBTASK TRACKING ERROR] ${e.message}`);
                    }
                }
                
                // FIX #1: Inter-subtask commit for subtasks
                if (isSubtask) {
                    try {
                        const { execSync } = require('child_process');
                        const commitMsg = `wip: subtask ${id} complete`;
                        execSync('git -C /root/EmpoweredPixels add -A', { stdio: 'ignore' });
                        execSync(`git -C /root/EmpoweredPixels commit -m "${commitMsg}"`, { stdio: 'ignore' });
                        log(`[SUBTASK COMMIT] ${id} - changes committed for next subtask`);
                    } catch (e) {
                        log(`[SUBTASK COMMIT FAILED] ${id}: ${e.message}`);
                        // Continue even if commit fails - not critical
                    }
                }
            } else {
                updateTask(id, { status: 'pending', retry_count: (task.retry_count || 0) + 1 });
            }
        } else if (prevStatus === 'awaiting_review') {
            if (context && context.verdict === 'approved') {
                notifyTelegram(`✅ *APPROVED*\nID: \`${id}\`\nNotes: _${summary}_`);
                updateTask(id, { status: 'completed' });
                
                // Auto-commit and push changes
                try {
                    const { execSync } = require('child_process');
                    const taskId = id;
                    const commitMsg = `feat: ${task.title || taskId} completed`;
                    execSync('git -C /root/EmpoweredPixels add -A', { stdio: 'ignore' });
                    execSync(`git -C /root/EmpoweredPixels commit -m "${commitMsg}"`, { stdio: 'ignore' });
                    execSync('git -C /root/EmpoweredPixels push origin main', { stdio: 'ignore' });
                    notifyTelegram(`📦 *COMMITTED & PUSHED*\nID: \`${taskId}\`\nMsg: _${commitMsg}_`);
                } catch (e) {
                    notifyTelegram(`⚠️ *COMMIT FAILED*\nID: \`${id}\`\nError: ${e.message}`);
                }
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
        
        // Check for tasks that need splitting - skip them (PM will handle)
        const needsSplit = data.tasks.find(t => t.needs_split === true);
        if (needsSplit) {
            log(`[NEEDS SPLIT] Task ${needsSplit.id} requires PM to create subtasks`);
            notifyTelegram(`⚠️ *Task Needs Split*\n\nID: \`${needsSplit.id}\`\nReason: ${needsSplit.split_reason || 'Too many files'}\n\nWaiting for PM to create subtasks...`);
            // Mark as waiting for split
            updateTask(needsSplit.id, { status: 'needs_split' });
            return;
        }
        
        // FIX P0-2: Check for parent tasks with pending subtasks (crash recovery)
        const parentWithPendingSubtasks = data.tasks.find(t => {
            if (!t.has_subtasks) return false;
            
            // Find all subtasks for this parent
            const parentId = t.id;
            const subtasks = data.tasks.filter(st => st.parent_id === parentId);
            
            // Check if any subtask is pending or in_progress
            const hasPending = subtasks.some(st => 
                st.status === 'pending' || st.status === 'in_progress'
            );
            
            // Parent should be waiting for subtasks
            return hasPending && (t.status === 'pending' || t.status === 'in_progress');
        });
        
        if (parentWithPendingSubtasks) {
            log(`[SUBTASK RECOVERY] Parent ${parentWithPendingSubtasks.id} has pending subtasks`);
            // Don't run parent, run the pending subtask instead
        }
        
        // Priority: awaiting_review > pending subtasks > pending tasks
        const next = data.tasks.find(t => t.status === 'awaiting_review') ||
                     data.tasks.find(t => t.status === 'pending' && t.parent_id) ||  // Subtask
                     data.tasks.find(t => t.status === 'pending' && !t.has_subtasks); // Non-parent task
        
        if (next) runAgent(selectAgent(next), next);
    } catch (e) {}
}

setInterval(orchestrate, 15000);
orchestrate();
log("Orchestrator V8.3 (Team Talk) Started.");
