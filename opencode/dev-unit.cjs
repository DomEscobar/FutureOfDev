#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn, execSync } = require('child_process');

/**
 * ADVANCED DEV-UNIT WRAPPER V2.1 (Iron Dome + Infrastructure Awareness)
 * 
 * Features:
 * 1. Multi-Stage Cognition (Plan -> Execute -> Verify)
 * 2. Plan Validation Gate (Idea 1)
 * 3. Stage Fallback / Graceful Degradation (Idea 4)
 * 4. Context Sterilization between stages
 * 5. Alignment Enforcement
 * 6. Infrastructure Awareness (detect DB requirements)
 */

const [,, taskId, taskDesc, workspace] = process.argv;
const AGENCY_ROOT = __dirname;
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
const GHOSTPAD_PATH = path.join(RUN_DIR, `ghostpad_${taskId}.md`);
const ALIGNMENT_PATH = path.join(AGENCY_ROOT, 'ALIGNMENT.md');
const DEV_UNIT_PATH = path.join(AGENCY_ROOT, 'DEV_UNIT.md');
const ARCHITECTURE_PATH = path.join(workspace, 'docs', 'ARCHITECTURE.md');
const FAILURE_TRACKER_PATH = path.join(RUN_DIR, `ghostpad_failures_${taskId}.json`);
const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';

if (!taskId || !taskDesc || !workspace) {
    console.error('Usage: node dev-unit.cjs <task-id> "<task-desc>" <workspace>');
    process.exit(1);
}

function log(msg) {
    console.log(`[DEV-UNIT][${taskId}] ${msg}`);
}

const logFile = path.join(RUN_DIR, `dev_unit_${taskId}_debug.log`);
const fsLog = (msg) => {
    try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {}
};

// ============================================
// INFRASTRUCTURE AWARENESS
// ============================================
function checkInfrastructure(taskDescription) {
    const warnings = [];
    
    // Check if task mentions database operations
    const dbKeywords = /database|postgres|sql|seed|migration|db|table|query/i;
    const needsDb = dbKeywords.test(taskDescription);
    
    if (needsDb) {
        try {
            // Check if PostgreSQL is accessible
            const result = execSync('pg_isready -h localhost -p 5432 2>&1 || echo "NOT_READY"', { 
                encoding: 'utf8', 
                timeout: 5000 
            });
            if (result.includes('NOT_READY') || result.includes('refused')) {
                warnings.push('[INFRASTRUCTURE WARNING] PostgreSQL is not available on localhost:5432. Avoid database operations.');
            }
        } catch (e) {
            warnings.push('[INFRASTRUCTURE WARNING] Cannot check PostgreSQL status. Avoid database operations.');
        }
    }
    
    return warnings;
}

// ============================================
// TASK COMPLEXITY DETECTION (Enhanced Planning)
// ============================================
function detectTaskComplexity(taskDescription) {
    const complexity = {
        score: 0,
        reasons: [],
        needsEnhancedPlanning: false
    };
    
    // Multi-file changes (+2 complexity)
    if (/replace|refactor|integrate|migrate|restructure/i.test(taskDescription)) {
        complexity.score += 2;
        complexity.reasons.push("Multi-file operation");
    }
    
    // New feature creation (+1)
    if (/create|build|implement|add new/i.test(taskDescription)) {
        complexity.score += 1;
        complexity.reasons.push("Feature creation");
    }
    
    // Multiple explicit steps (+1 per step)
    const stepMatches = taskDescription.match(/\d+\)\s/g);
    if (stepMatches && stepMatches.length > 2) {
        complexity.score += stepMatches.length;
        complexity.reasons.push(`${stepMatches.length} steps`);
    }
    
    // Integration work (+2)
    if (/integrate|wire up|connect|import.*from/i.test(taskDescription)) {
        complexity.score += 2;
        complexity.reasons.push("Integration work");
    }
    
    // Enhanced planning threshold: score >= 3 → add extra context/examples
    complexity.needsEnhancedPlanning = complexity.score >= 3;
    
    return complexity;
}

// ============================================
// IDEA 1: PLAN VALIDATION GATE
// ============================================
function validatePlan(plan) {
    if (!plan || plan.length < 50) {
        return { valid: false, reason: "Plan too short or empty" };
    }

    // Must contain at least ONE file path reference
    const filePatterns = [
        /[\w\/\-]+\.(ts|tsx|go|js|vue|jsx|py|java|c|cpp|h)/gi,
        /(?:file|modify|update|create|edit):\s*[\w\/\-\.]+/gi
    ];
    const hasFiles = filePatterns.some(pattern => pattern.test(plan));
    
    // Must contain action verbs
    const actionVerbs = /(?:add|modify|create|update|fix|implement|change|refactor|remove|add|write|edit|delete)/i;
    const hasActions = actionVerbs.test(plan);
    
    // Must NOT be just research notes (common failure pattern)
    const researchOnlyPatterns = [
        /I will (examine|analyze|look at|read|understand|review|check|investigate)/i,
        /Let me (start by|first|begin)/i,
        /I need to (understand|analyze|examine)/i
    ];
    const isJustResearch = researchOnlyPatterns.some(pattern => pattern.test(plan)) && !hasFiles;

    // Check for plan locking marker
    const hasLockMarker = /### PLAN_LOCKED ###|PLAN_LOCKED/i.test(plan);

    if (isJustResearch) {
        return { valid: false, reason: "Plan is research-only, no concrete actions" };
    }
    if (!hasFiles) {
        return { valid: false, reason: "No file paths found in plan" };
    }
    if (!hasActions) {
        return { valid: false, reason: "No action verbs found in plan" };
    }

    return { valid: true, reason: "Plan validated successfully" };
}

// ============================================
// FAILURE TRACKING (For Idea 7 - Teleport Fallback)
// ============================================
function trackGhostpadFailure() {
    try {
        let failures = 0;
        if (fs.existsSync(FAILURE_TRACKER_PATH)) {
            const data = JSON.parse(fs.readFileSync(FAILURE_TRACKER_PATH, 'utf8'));
            failures = data.count || 0;
        }
        failures++;
        fs.writeFileSync(FAILURE_TRACKER_PATH, JSON.stringify({ count: failures, lastFailure: new Date().toISOString() }));
        return failures;
    } catch (e) {
        return 1;
    }
}

function getGhostpadFailures() {
    try {
        if (fs.existsSync(FAILURE_TRACKER_PATH)) {
            const data = JSON.parse(fs.readFileSync(FAILURE_TRACKER_PATH, 'utf8'));
            return data.count || 0;
        }
    } catch (e) {}
    return 0;
}

// ============================================
// CORE FUNCTIONS
// ============================================
function runOpencode(prompt, agent = 'dev-unit') {
    fsLog(`>>> RUNNING AGENT Turn: ${agent}`);
    const result = spawnSync(opencodeBin, ['run', prompt, '--agent', agent, '--dir', workspace], {
        cwd: AGENCY_ROOT,
        env: { ...process.env, PROJECT_ID: taskId },
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000 // 5 minute timeout
    });
    fsLog(`<<< AGENT EXITED TURN: ${agent} (status: ${result.status})`);
    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        status: result.status
    };
}

function telegramKeepAlive(stage) {
    const stageTalk = {
        "PLANNING": [
            "Strategizing on the board... ♟️",
            "Analyzing the architecture and mapping out dependencies. 🗺️",
            "Checking ALIGNMENT.md for the golden rules. 📜"
        ],
        "LOCKED & LOADED": [
            "Writing the final plan into the Ghost-Pad. 📝",
            "Blueprint finalized. Ready for clean-room execution. 🏗️",
            "Context sanitized. Moving to implementation. 🧪"
        ],
        "EXECUTING": [
            "Executing the plan. High-precision mode active. 🛠️",
            "Refactoring with modular focus. 🧩",
            "Applying the logic changes to the workspace. 🏗️"
        ],
        "AUDITING": [
            "Self-auditing the changes. No slump allowed. ⚖️",
            "Comparing workspace vs. Ghost-Pad alignment. 🔍",
            "Verifying mobile breakpoints and edge cases. 📱"
        ],
        "RE-PLANNING": [
            "Previous plan was invalid. Forcing concrete strategy... 🔄",
            "Plan validation failed. Extracting real actions... 🔧"
        ],
        "FALLBACK": [
            "Using fallback mode. Proceeding with task description. 🆘"
        ],
        "DELEGATING": [
            "Complex task detected. Delegating to Claude Code... 🧩",
            "Routing to coding-agent for high-quality output. 🎯"
        ],
        "COMPLETE": [
            "Task completed successfully. ✅",
            "Changes verified and applied. 🏁"
        ]
    };
    
    const phrases = stageTalk[stage] || ["Processing... ⚙️"];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    notifyTelegram(`💭 *Team Sync: [${stage}]*\n"${phrase}"`);
}

function notifyTelegram(text) {
    try {
        const config = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'config.json'), 'utf8'));
        if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) return;
        spawnSync('sleep', ['3']); 
        spawnSync('curl', ['-s', '-o', '/dev/null', '-X', 'POST', 
            `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, 
            '-d', `chat_id=${config.TELEGRAM_CHAT_ID}`, 
            '--data-urlencode', `text=${text}`]);
    } catch (e) {}
}

function getFilesSnapshot() {
    try {
        // Get all source files with their modification times for proper diff detection
        const result = execSync(
            `find ${workspace} -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.go" -o -name "*.js" -o -name "*.vue" -o -name "*.jsx" \\) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.git/*" 2>/dev/null | head -50`,
            { encoding: 'utf8', timeout: 10000 }
        );
        return result.trim().split('\n').filter(f => f.length > 0);
    } catch (e) {
        return [];
    }
}

function getFileModTimes(files) {
    const modTimes = {};
    for (const file of files) {
        try {
            const stat = fs.statSync(file);
            modTimes[file] = stat.mtimeMs;
        } catch (e) {
            // File might not exist
        }
    }
    return modTimes;
}

function computeFileDiff(beforeTimes, afterTimes) {
    const created = [];
    const modified = [];
    const deleted = [];
    
    // Check for new or modified files
    for (const [file, afterTime] of Object.entries(afterTimes)) {
        if (!(file in beforeTimes)) {
            created.push(file);
        } else if (afterTime > beforeTimes[file] + 1000) { // 1s tolerance
            modified.push(file);
        }
    }
    
    // Check for deleted files
    for (const file of Object.keys(beforeTimes)) {
        if (!(file in afterTimes)) {
            deleted.push(file);
        }
    }
    
    return { created, modified, deleted };
}

// ============================================
// MAIN EXECUTION FLOW
// ============================================

log("🚀 Starting Iron Dome V2.0...");
fsLog(`=== NEW RUN === Task: ${taskId}`);

// Check for teleport fallback condition
const priorFailures = getGhostpadFailures();
if (priorFailures >= 2) {
    log("🏛️ Ghost-Pad failed twice previously. Using fallback mode.");
    telegramKeepAlive("FALLBACK");
    fs.unlinkSync(FAILURE_TRACKER_PATH);
    
    // Use task description as plan
    const fallbackPlan = `[FALLBACK PLAN]\nImplement: ${taskDesc}\n\nUse your best judgment to complete this task.`;
    fs.writeFileSync(GHOSTPAD_PATH, fallbackPlan);
    
    // Skip to direct execution
    const result = runOpencode(taskDesc);
    console.log(result.stdout);
    process.exit(result.status === 0 ? 0 : 1);
}

// ============================================
// STAGE 1: PLANNING WITH VALIDATION GATE
// ============================================
log("🧠 Stage 1: Strategic Planning...");
telegramKeepAlive("PLANNING");

// Load context files
let devUnitContext = '';
let architectureContext = '';
try {
    if (fs.existsSync(DEV_UNIT_PATH)) {
        devUnitContext = fs.readFileSync(DEV_UNIT_PATH, 'utf8');
    }
} catch (e) {}
try {
    if (fs.existsSync(ARCHITECTURE_PATH)) {
        architectureContext = fs.readFileSync(ARCHITECTURE_PATH, 'utf8');
    }
} catch (e) {}

// Infrastructure Awareness Check
const infraWarnings = checkInfrastructure(taskDesc);
if (infraWarnings.length > 0) {
    infraWarnings.forEach(w => log(w));
}

// ============================================
// TASK COMPLEXITY ROUTING (Enhanced Context)
// ============================================
const complexity = detectTaskComplexity(taskDesc);
fsLog(`Task complexity: ${complexity.score} (${complexity.reasons.join(', ')})`);

log(`📊 Task complexity: ${complexity.score}/10`);
if (complexity.reasons.length > 0) {
    log(`   Factors: ${complexity.reasons.join(', ')}`);
}

// For complex tasks, add extra examples and context to the plan prompt
let enhancedPlanPrompt = '';
if (complexity.needsEnhancedPlanning) {
    log(`🎯 Enhanced planning mode enabled for complex task`);
    enhancedPlanPrompt = `

[ENHANCED PLANNING - COMPLEX TASK DETECTED]
This task has complexity score ${complexity.score}. Take extra care:

1. Read the target files FIRST before planning
2. Identify exact line numbers where changes will occur  
3. List ALL imports that need to be added
4. Show the EXACT component usage syntax

Example for INTEGRATION task:
## PLAN
### Files to Modify:
1. /root/EmpoweredPixels/frontend/src/pages/Leagues.vue
   - Action: Import LeagueList component at line ~310
   - Action: Add <LeagueList :leagues="store.leagues" ... /> in template after header
   - Action: Remove inline loading/error/empty/league-grid sections (lines ~50-200)
   
### Files That Already Exist:
- /root/EmpoweredPixels/frontend/src/features/leagues/LeagueList.vue (DO NOT RECREATE)

### PLAN_LOCKED
`;
}

const planPrompt = `
[AGENT IDENTITY]
${devUnitContext || 'You are a Developer Agent. Create concrete file-based plans.'}

[PROJECT ARCHITECTURE]
${architectureContext || 'Frontend: frontend/src/, Backend: backend/'}

[ALIGNMENT STANDARDS]
Read ${ALIGNMENT_PATH} and follow all standards.
${infraWarnings.length > 0 ? `\n[INFRASTRUCTURE CONSTRAINTS]\n${infraWarnings.join('\n')}\n` : ''}
${enhancedPlanPrompt}
[GOAL] Create a MANDATORY implementation plan for:
TASK: ${taskDesc}

[PLAN FORMAT - COPY THIS STRUCTURE]
## PLAN

### Files to Modify:
1. /absolute/path/to/file.extension
   - Action: What you will do

### Files to Create:
1. /absolute/path/to/new.extension
   - Action: What it will contain

### No Changes Required:
- /path/to/existing/file.extension (reason)

### PLAN_LOCKED

[CRITICAL RULES]
- Use ABSOLUTE paths starting with ${workspace}
- "examine", "analyze", "research" = REJECTED PLAN
- No file paths = REJECTED PLAN
- Always end with ### PLAN_LOCKED

Create your plan now.
`;

let plan = "";
let planValid = false;
let planAttempts = 0;
const MAX_PLAN_ATTEMPTS = 2;

while (!planValid && planAttempts < MAX_PLAN_ATTEMPTS) {
    planAttempts++;
    fsLog(`Plan attempt ${planAttempts}/${MAX_PLAN_ATTEMPTS}`);
    
    const stage1 = runOpencode(planPrompt + (planAttempts > 1 ? "\n\n[PREVIOUS PLAN WAS REJECTED - BE MORE CONCRETE]" : ""));
    
    // Extract plan - try multiple markers
    const planMatch = stage1.stdout.match(/([\s\S]*?)(?:### PLAN_LOCKED ###|PLAN_LOCKED)/i);
    plan = planMatch ? planMatch[1].trim() : stage1.stdout.trim();
    
    // Validate the plan
    const validation = validatePlan(plan);
    fsLog(`Plan validation: ${validation.valid ? 'PASS' : 'FAIL'} - ${validation.reason}`);
    
    if (validation.valid) {
        planValid = true;
    } else {
        log(`⚠️ Plan validation failed: ${validation.reason}`);
        telegramKeepAlive("RE-PLANNING");
    }
}

// FALLBACK: If plan still invalid after retries
if (!planValid) {
    log("⚠️ Plan validation failed after max attempts. Using task as fallback plan.");
    telegramKeepAlive("FALLBACK");
    plan = `[FALLBACK PLAN - Original task]\n${taskDesc}\n\n[NOTE: Agent could not produce a concrete plan. Using best judgment.]`;
}

fs.writeFileSync(GHOSTPAD_PATH, plan);
log(`📝 Plan locked in Ghost-Pad. (Length: ${plan.length} chars)`);
telegramKeepAlive("LOCKED & LOADED");

// ============================================
// STAGE 2: EXECUTION
// ============================================
log("🛠️ Stage 2: Clean-Room Execution...");
telegramKeepAlive("EXECUTING");

const filesBefore = getFilesSnapshot();
const modTimesBefore = getFileModTimes(filesBefore);
fsLog("Files snapshot before execution captured (" + filesBefore.length + " files)");

const execPrompt = `
[GHOST-PAD / MANDATORY PLAN]
${plan}

[INSTRUCTION]
Execute the plan above EXACTLY as specified.
Read ${ALIGNMENT_PATH} again to ensure compliance.
When finished, provide a clear 'Summary:' of actions taken.

DO NOT just research. MODIFY FILES.
`;

const stage2 = runOpencode(execPrompt);

// FALLBACK: If execution failed but produced output
if (stage2.status !== 0) {
    log("⚠️ Stage 2 exited with non-zero status. Proceeding with partial results.");
    fsLog("Stage 2 non-zero exit, continuing with fallback");
}

const filesAfter = getFilesSnapshot();
const modTimesAfter = getFileModTimes(filesAfter);
const fileDiff = computeFileDiff(modTimesBefore, modTimesAfter);
fsLog(`Files snapshot after execution captured (${filesAfter.length} files)`);
fsLog(`File diff: ${fileDiff.created.length} created, ${fileDiff.modified.length} modified, ${fileDiff.deleted.length} deleted`);

// ============================================
// STAGE 3: VERIFICATION
// ============================================
log("⚖️ Stage 3: Self-Verification...");
telegramKeepAlive("AUDITING");

// Build file change summary
const fileChangeSummary = fileDiff.created.length > 0 
    ? `✅ NEW FILES CREATED:\n${fileDiff.created.map(f => `  + ${f}`).join('\n')}\n`
    : '';
const modifiedSummary = fileDiff.modified.length > 0
    ? `📝 FILES MODIFIED:\n${fileDiff.modified.map(f => `  ~ ${f}`).join('\n')}\n`
    : '';
const noChangesWarning = (fileDiff.created.length === 0 && fileDiff.modified.length === 0)
    ? `⚠️ WARNING: No file changes detected! The plan may not have been executed.\n`
    : '';

const verifyPrompt = `
[GHOST-PAD - THE PLAN]
${plan}

[FILE CHANGE DETECTION]
${fileChangeSummary}${modifiedSummary}${noChangesWarning}

[AGENT'S CLAIMED CHANGES]
${stage2.stdout}

[INSTRUCTION]
1. Check if files were created or modified (see above).
2. If changes exist and match the plan, output: VERDICT: APPROVED
3. If NO changes were detected but plan was valid, output: VERDICT: REJECTED - No files modified
4. If changes don't match plan, output: VERDICT: REJECTED with explanation.

You MUST provide a final verdict.
`;

const stage3 = runOpencode(verifyPrompt);

// ============================================
// STAGE 4: BUILD VERIFICATION (NEW!)
// ============================================
log("🏗️ Stage 4: Build Verification...");
let buildPassed = true;
let buildOutput = '';

// Check if workspace has a frontend with build script
const frontendPackageJson = path.join(workspace, 'frontend', 'package.json');
if (fs.existsSync(frontendPackageJson)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(frontendPackageJson, 'utf8'));
        if (pkg.scripts && pkg.scripts.build) {
            log("Running frontend build...");
            const buildResult = spawnSync('npm', ['run', 'build'], {
                cwd: path.join(workspace, 'frontend'),
                encoding: 'utf8',
                timeout: 120000 // 2 min timeout
            });
            
            if (buildResult.status !== 0) {
                buildPassed = false;
                buildOutput = buildResult.stderr || buildResult.stdout;
                log(`❌ Build FAILED!`);
                fsLog(`Build failed: ${buildOutput.substring(0, 500)}`);
            } else {
                log(`✅ Build passed`);
                fsLog('Build verification passed');
            }
        }
    } catch (e) {
        log(`⚠️ Build check skipped: ${e.message}`);
    }
}

// ============================================
// FINAL OUTPUT & FALLBACK LOGIC
// ============================================
const finalOutput = `
=== STAGE 1: PLAN ===
${plan}

=== STAGE 2: EXECUTION ===
${stage2.stdout}

=== STAGE 3: VERDICT ===
${stage3.stdout}
`;

console.log(finalOutput);

// Check for verdict
const hasApproved = stage3.stdout.toUpperCase().includes('VERDICT: APPROVED') || 
                    stage3.stdout.includes('✅ APPROVED') ||
                    stage3.stdout.includes('APPROVED');

const hasRejected = stage3.stdout.toUpperCase().includes('VERDICT: REJECTED') ||
                    stage3.stdout.includes('❌ REJECTED') ||
                    stage3.stdout.includes('REJECTED');

// Build failure overrides approval
if (!buildPassed) {
    log("❌ Task rejected - Build failed!");
    notifyTelegram(`❌ *Build Failed*\n\nTask: ${taskId}\n\`\`\`\n${buildOutput.substring(0, 500)}\n\`\`\``);
    trackGhostpadFailure();
    process.exit(1);
}

if (hasApproved) {
    log("✅ Task verified and approved locally.");
    notifyTelegram(`✅ *Task Complete*\n\nTask: ${taskId}\nBuild: ✅ Passed`);
    // Clear failure tracker on success
    try { fs.unlinkSync(FAILURE_TRACKER_PATH); } catch (e) {}
    process.exit(0);
} else if (hasRejected) {
    log("❌ Task rejected by verification.");
    trackGhostpadFailure();
    process.exit(1);
} else {
    // FALLBACK: No clear verdict - send to code-reviewer
    log("⚠️ No clear verdict. Handing to code-reviewer for external review.");
    console.log("NO_VERDICT:SEND_TO_REVIEWER");
    
    // This is not a failure - let the orchestrator's code-reviewer handle it
    process.exit(0);
}
