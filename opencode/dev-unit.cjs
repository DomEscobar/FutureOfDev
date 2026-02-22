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
// IDEA 1: PLAN VALIDATION GATE (Enhanced)
// ============================================
function validatePlan(plan, context = {}) {
    if (!plan || plan.length < 50) {
        return { valid: false, reason: "Plan too short or empty" };
    }

    // Special handling for DELETE tasks
    if (context.intent === 'DELETE') {
        // DELETE tasks are valid if they mention deletion of target files
        const hasDeleteAction = /delete|remove|purge|eliminate/i.test(plan);
        const mentionsTargetFiles = context.targetFiles && context.targetFiles.some(f => 
            plan.includes(f) || plan.includes(path.basename(f))
        );
        
        if (hasDeleteAction && mentionsTargetFiles) {
            return { valid: true, reason: "DELETE plan validated" };
        }
        
        // Even simple "Delete these files" is valid for DELETE tasks
        if (hasDeleteAction && /files?|components?|pages?|directory/i.test(plan)) {
            return { valid: true, reason: "DELETE plan validated (generic)" };
        }
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
    
    for (const [file, afterTime] of Object.entries(afterTimes)) {
        if (!(file in beforeTimes)) created.push(file);
        else if (afterTime > beforeTimes[file] + 1000) modified.push(file);
    }
    
    for (const file of Object.keys(beforeTimes)) {
        if (!(file in afterTimes)) deleted.push(file);
    }
    
    return { created, modified, deleted };
}

// === SNAPSHOT & ROLLBACK SYSTEM ===
function createWorkspaceSnapshot(label) {
    const snapshotDir = path.join(RUN_DIR, 'snapshots');
    if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
    const snapshotId = `${taskId}_${label}_${Date.now()}`;
    const snapshotPath = path.join(snapshotDir, `${snapshotId}.json`);
    
    const snapshot = {
        id: snapshotId,
        taskId,
        label,
        timestamp: new Date().toISOString(),
        files: getFilesSnapshot(),
        modTimes: getFileModTimes(getFilesSnapshot())
    };
    
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    fsLog(`Snapshot created: ${snapshotPath}`);
    return snapshotPath;
}

function rollbackWorkspace(snapshotPath) {
    try {
        if (!fs.existsSync(snapshotPath)) {
            log(`⚠️ Rollback skipped: snapshot not found`);
            return false;
        }
        
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        log(`🔙 Rolling back workspace to snapshot from ${snapshot.label}...`);
        
        // Simple approach: use git if available
        try {
            execSync('git status --porcelain', { cwd: workspace, stdio: 'ignore' });
            // Reset all changes
            execSync('git reset --hard HEAD', { cwd: workspace, stdio: 'ignore' });
            execSync('git clean -fd', { cwd: workspace, stdio: 'ignore' });
            log('✅ Rollback complete via git');
            return true;
        } catch (e) {
            log('⚠️ Git not available or not a git repo. Cannot rollback automatically.');
            return false;
        }
    } catch (e) {
        log(`❌ Rollback failed: ${e.message}`);
        return false;
    }
}

function extractCodeSnippets(output, maxSnippets = 3) {
    const snippets = [];
    const lines = output.split('\n');
    
    // Look for lines with file paths and line numbers
    for (const line of lines) {
        const fileMatch = line.match(/(\/[^\s:]+):(\d+):/);
        if (fileMatch) {
            const file = fileMatch[1];
            const lineNum = parseInt(fileMatch[2]);
            snippets.push({ file, line: lineNum, context: line.trim() });
            if (snippets.length >= maxSnippets) break;
        }
    }
    
    return snippets;
}

// ============================================
// PRE-FLIGHT: PARSE INTENT AND CHECK FILES
// ============================================
function parseTaskIntent(taskDesc) {
    const lower = taskDesc.toLowerCase();
    
    if (/\[delete task|delete|remove|purge|eliminate/i.test(taskDesc)) {
        return 'DELETE';
    }
    if (/create|add new|implement new|build new|new feature/i.test(lower)) {
        return 'CREATE';
    }
    if (/fix|modify|update|change|refactor|improve|enhance|overhaul/i.test(lower)) {
        return 'MODIFY';
    }
    return 'UNKNOWN';
}

function extractTargetFiles(taskDesc) {
    // Extract from [TARGET FILES] section
    const filesMatch = taskDesc.match(/\[TARGET FILES\][\s\S]*?(?=\[|$)/i);
    if (filesMatch) {
        const fileLines = filesMatch[0].match(/- (.+)/g) || [];
        return fileLines.map(l => l.replace('- ', '').trim()).filter(f => f.length > 0);
    }
    return [];
}

function checkIfTaskAlreadyDone(taskDesc, workspace) {
    const intent = parseTaskIntent(taskDesc);
    const targetFiles = extractTargetFiles(taskDesc);
    
    fsLog(`Pre-flight: Intent=${intent}, Files=${targetFiles.length}`);
    
    // No target files - can't determine if done
    if (targetFiles.length === 0) {
        return { 
            done: false, 
            intent,
            reason: 'No target files specified',
            targetFiles: [],
            existingFiles: []
        };
    }
    
    const existingFiles = targetFiles.filter(f => fs.existsSync(f));
    
    // DELETE: All files gone = already done
    if (intent === 'DELETE') {
        if (existingFiles.length === 0) {
            return { 
                done: true, 
                intent,
                reason: 'All target files already deleted',
                targetFiles,
                existingFiles: []
            };
        }
        return { 
            done: false, 
            intent,
            reason: `${existingFiles.length}/${targetFiles.length} files still exist`,
            targetFiles,
            existingFiles
        };
    }
    
    // CREATE/MODIFY: Cannot determine "done" without content check
    return { 
        done: false, 
        intent,
        reason: `${existingFiles.length}/${targetFiles.length} files exist`,
        targetFiles,
        existingFiles
    };
}

// ============================================
// MAIN EXECUTION FLOW
// ============================================

log("🚀 Starting Iron Dome V2.0...");
fsLog(`=== NEW RUN === Task: ${taskId}`);

// PRE-FLIGHT CHECK
const preflight = checkIfTaskAlreadyDone(taskDesc, workspace);
fsLog(`Pre-flight: ${preflight.done ? 'ALREADY DONE' : 'NEEDS WORK'} - ${preflight.reason}`);

// Create snapshot before any work (for potential rollback)
const snapshotPath = createWorkspaceSnapshot('pre-execution');
fsLog(`Workspace snapshot created for rollback: ${snapshotPath}`);

if (preflight.done) {
    log(`✅ Task already complete: ${preflight.reason}`);
    notifyTelegram(`✅ *Already Done*\n\nTask: ${taskId}\n${preflight.reason}`);
    console.log(`ALREADY_DONE: ${preflight.reason}`);
    process.exit(0);
}

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
    const validation = validatePlan(plan, { 
        intent: preflight.intent, 
        targetFiles: preflight.targetFiles 
    });
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
    
    // Include pre-flight info in fallback
    let fallbackInfo = '';
    if (preflight.targetFiles && preflight.targetFiles.length > 0) {
        fallbackInfo = `\n\n[PRE-FLIGHT FILE STATUS]\n`;
        fallbackInfo += `Intent: ${preflight.intent}\n`;
        preflight.targetFiles.forEach(f => {
            const exists = fs.existsSync(f);
            fallbackInfo += `${exists ? '✓' : '✗'} ${f}\n`;
        });
    }
    
    plan = `[FALLBACK PLAN - Original task]\n${taskDesc}${fallbackInfo}\n\n[NOTE: Agent could not produce a concrete plan. Using best judgment.]`;
}

fs.writeFileSync(GHOSTPAD_PATH, plan);
log(`📝 Plan locked in Ghost-Pad. (Length: ${plan.length} chars)`);
telegramKeepAlive("LOCKED & LOADED");

// ============================================
// PROJECT TYPE & FRAMEWORK DETECTION
// ============================================
function detectProjectContext(workspace) {
    const context = {
        type: 'unknown', // frontend, backend, fullstack
        framework: 'unknown',
        frameworkVersion: null,
        testFramework: null,
        mockLibrary: null,
        hasTypeScript: false,
        hasGo: false
    };
    
    // Check for package.json (frontend/fullstack)
    const pkgPath = path.join(workspace, 'frontend', 'package.json');
    if (fs.existsSync(pkgPath)) {
        context.hasTypeScript = true;
        
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            
            // Detect framework
            if (deps.vue) {
                context.framework = 'vue';
                context.frameworkVersion = deps.vue.replace(/[^0-9.]/g, '').split('.')[0];
            } else if (deps.react) {
                context.framework = 'react';
                context.frameworkVersion = deps.react.replace(/[^0-9.]/g, '').split('.')[0];
            } else if (deps.svelte) {
                context.framework = 'svelte';
            }
            
            // Detect test framework
            if (deps.vitest) context.testFramework = 'vitest';
            else if (deps.jest) context.testFramework = 'jest';
            else if (deps.mocha) context.testFramework = 'mocha';
            
            // Detect mock library
            if (deps['@vitest/spy']) context.mockLibrary = 'vitest';
            else if (deps['ts-mockito']) context.mockLibrary = 'ts-mockito';
            else if (deps.sinon) context.mockLibrary = 'sinon';
            
        } catch (e) {}
    }
    
    // Check for Go backend
    const goModPath = path.join(workspace, 'backend', 'go.mod');
    if (fs.existsSync(goModPath)) {
        context.hasGo = true;
        try {
            const goMod = fs.readFileSync(goModPath, 'utf8');
            // Detect mock library
            if (goMod.includes('github.com/stretchr/testify')) context.mockLibrary = 'testify';
            else if (goMod.includes('go.uber.org/mock')) context.mockLibrary = 'gomock';
            else if (goMod.includes('github.com/golang/mock')) context.mockLibrary = 'gomock';
        } catch (e) {}
    }
    
    // Determine project type
    if (context.hasTypeScript && context.hasGo) {
        context.type = 'fullstack';
    } else if (context.hasTypeScript) {
        context.type = 'frontend';
    } else if (context.hasGo) {
        context.type = 'backend';
    }
    
    return context;
}

// ============================================
// STAGE 2: EXECUTION
// ============================================
log("🛠️ Stage 2: Clean-Room Execution...");
telegramKeepAlive("EXECUTING");

// Detect project context
const projectContext = detectProjectContext(workspace);
fsLog(`Project context: ${JSON.stringify(projectContext)}`);

const filesBefore = getFilesSnapshot();
const modTimesBefore = getFileModTimes(filesBefore);
fsLog("Files snapshot before execution captured (" + filesBefore.length + " files)");

// Extract rejection notes from taskDesc
const rejectionMatch = taskDesc.match(/\[REJECTION NOTES[^\]]*\]([\s\S]*?)(?=\[|$)/i);
const rejectionNotes = rejectionMatch ? rejectionMatch[1].trim() : null;

// Build intent-specific execution instructions
let intentInstructions = '';
if (preflight.intent === 'DELETE' && preflight.existingFiles && preflight.existingFiles.length > 0) {
    intentInstructions = `
[DELETE TASK INSTRUCTIONS]
This is a DELETE task. The following files MUST be removed:
${preflight.existingFiles.map(f => `  - rm ${f}`).join('\n')}

Use shell commands or file system operations to DELETE these files.
Do NOT just analyze - actually DELETE them.
`;
} else if (preflight.intent === 'MODIFY') {
    intentInstructions = `
[MODIFY TASK INSTRUCTIONS]
This is a MODIFY task. The following files exist and need changes:
${preflight.targetFiles.filter(f => fs.existsSync(f)).map(f => `  - ${f}`).join('\n')}

Read the files, identify what needs to change, and MODIFY them.
Do NOT just analyze - actually EDIT the files.
`;
} else if (preflight.intent === 'CREATE' && preflight.targetFiles) {
    const missingFiles = preflight.targetFiles.filter(f => !fs.existsSync(f));
    if (missingFiles.length > 0) {
        intentInstructions = `
[CREATE TASK INSTRUCTIONS]
This is a CREATE task. The following files need to be created:
${missingFiles.map(f => `  - ${f}`).join('\n')}

Create these files with appropriate content.
Do NOT just plan - actually CREATE the files.
`;
    }
}

// Build framework context
let frameworkContext = '';
if (projectContext.framework === 'vue') {
    frameworkContext = `
[FRAMEWORK CONTEXT]
Framework: Vue.js ${projectContext.frameworkVersion === '3' ? '3' : '2'}
${projectContext.frameworkVersion === '3' ? 
  'IMPORTANT: Use Vue 3 Composition API (<script setup>, ref, computed). NOT Options API.' :
  'Use Vue 2 Options API patterns.'}
`;
}

// Build rejection notes section (CRITICAL!)
let rejectionSection = '';
if (rejectionNotes) {
    rejectionSection = `
╔══════════════════════════════════════════════════════════════╗
║ ⚠️  CRITICAL: REJECTION NOTES FROM PREVIOUS RUN              ║
╚══════════════════════════════════════════════════════════════╝
${rejectionNotes}

⚠️ THE ABOVE ISSUES MUST BE FIXED. Do NOT repeat the same mistakes!
`;
}

const execPrompt = `
[GHOST-PAD / MANDATORY PLAN]
${plan}
${intentInstructions}${frameworkContext}${rejectionSection}
[PROJECT INFO]
Type: ${projectContext.type}
${projectContext.testFramework ? `Test Framework: ${projectContext.testFramework}` : ''}
${projectContext.mockLibrary ? `Mock Library: ${projectContext.mockLibrary}` : ''}

[ALIGNMENT REMINDER]
Read ${ALIGNMENT_PATH} and follow all standards.

[INSTRUCTION]
Execute the plan above EXACTLY as specified.
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
// STAGE 2.5: CHANGE VERIFICATION (BEFORE KPIs!)
// ============================================
const hasAnyChanges = fileDiff.created.length > 0 || 
                       fileDiff.modified.length > 0 || 
                       fileDiff.deleted.length > 0;

fsLog(`Has changes: ${hasAnyChanges}`);

if (!hasAnyChanges) {
    log("❌ No file changes detected - rejecting task");
    notifyTelegram(`❌ *No Changes Made*\n\nTask: ${taskId}\nThe agent did not modify any files.`);
    trackGhostpadFailure();
    // Rollback workspace
    if (snapshotPath) rollbackWorkspace(snapshotPath);
    process.exit(1);
}

log(`✅ Changes detected: +${fileDiff.created.length} ~${fileDiff.modified.length} -${fileDiff.deleted.length}`);

// ============================================
// KPI VERIFICATION LOOP (Project-Type Aware)
// ============================================
log("📊 Stage 3: KPI Verification...");
telegramKeepAlive("VERIFYING KPIs");

const kpiResults = {
    typescript: { passed: null, output: '', skipped: false },
    lint: { passed: null, output: '', skipped: false },
    build: { passed: null, output: '', skipped: false },
    tests: { passed: null, output: '', skipped: false },
    goBuild: { passed: null, output: '', skipped: false },
    goTest: { passed: null, output: '', skipped: false }
};

let kpiLoopCount = 0;
const MAX_KPI_LOOPS = 3;

// Determine which KPIs to run based on project type and changed files
const hasFrontendChanges = [...fileDiff.created, ...fileDiff.modified, ...fileDiff.deleted]
    .some(f => f.includes('/frontend/'));
const hasBackendChanges = [...fileDiff.created, ...fileDiff.modified, ...fileDiff.deleted]
    .some(f => f.includes('/backend/'));

fsLog(`KPI scope: frontend=${hasFrontendChanges}, backend=${hasBackendChanges}`);

while (kpiLoopCount < MAX_KPI_LOOPS) {
    kpiLoopCount++;
    log(`KPI Loop ${kpiLoopCount}/${MAX_KPI_LOOPS}`);
    
    // FRONTEND KPIs (only if frontend changes)
    if (hasFrontendChanges && projectContext.hasTypeScript) {
        // KPI 1: TypeScript Check
        log("  ├─ TypeScript check...");
        const tsResult = spawnSync('npx', ['vue-tsc', '--noEmit'], {
            cwd: path.join(workspace, 'frontend'),
            encoding: 'utf8',
            timeout: 60000,
            shell: true
        });
        kpiResults.typescript.passed = tsResult.status === 0;
        kpiResults.typescript.output = tsResult.stderr || tsResult.stdout || '';
        
        if (kpiResults.typescript.passed) {
            log("  │  ✅ TypeScript OK");
        } else {
            log("  │  ❌ TypeScript errors");
        }
        
        // KPI 2: Lint Check
        log("  ├─ Lint check...");
        const lintResult = spawnSync('npx', ['eslint', 'src', '--max-warnings=500'], {
            cwd: path.join(workspace, 'frontend'),
            encoding: 'utf8',
            timeout: 60000,
            shell: true
        });
        kpiResults.lint.passed = lintResult.status === 0;
        kpiResults.lint.output = lintResult.stderr || lintResult.stdout || '';
        
        const isConfigError = kpiResults.lint.output.includes('ESLint couldn\'t find') ||
                              kpiResults.lint.output.includes('Cannot find module') ||
                              kpiResults.lint.output.includes('Config Error') ||
                              kpiResults.lint.output.includes('Failed to load config');
        
        if (kpiResults.lint.passed) {
            log("  │  ✅ Lint OK");
        } else if (isConfigError) {
            log("  │  ⚠️ Lint CONFIG error");
        } else {
            log("  │  ❌ Lint errors");
        }
        
        // KPI 3: Frontend Build
        log("  ├─ Frontend build...");
        const buildResult = spawnSync('npm', ['run', 'build'], {
            cwd: path.join(workspace, 'frontend'),
            encoding: 'utf8',
            timeout: 120000
        });
        kpiResults.build.passed = buildResult.status === 0;
        kpiResults.build.output = buildResult.stderr || buildResult.stdout || '';
        
        if (kpiResults.build.passed) {
            log("  │  ✅ Frontend build OK");
        } else {
            log("  │  ❌ Frontend build failed");
        }
        
        // KPI 4: Frontend Tests
        const pkg = JSON.parse(fs.readFileSync(path.join(workspace, 'frontend', 'package.json'), 'utf8'));
        if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo') {
            log("  └─ Frontend tests...");
            const testResult = spawnSync('npm', ['test', '--', '--run'], {
                cwd: path.join(workspace, 'frontend'),
                encoding: 'utf8',
                timeout: 120000
            });
            kpiResults.tests.passed = testResult.status === 0;
            kpiResults.tests.output = testResult.stderr || testResult.stdout || '';
            
            if (kpiResults.tests.passed) {
                log("     ✅ Frontend tests OK");
            } else {
                log("     ❌ Frontend tests failed");
            }
        } else {
            kpiResults.tests.skipped = true;
            kpiResults.tests.passed = true;
            log("  └─ Tests: skipped (no test script)");
        }
    } else {
        // No frontend changes or no frontend project
        kpiResults.typescript.skipped = true;
        kpiResults.typescript.passed = true;
        kpiResults.lint.skipped = true;
        kpiResults.lint.passed = true;
        kpiResults.build.skipped = true;
        kpiResults.build.passed = true;
        kpiResults.tests.skipped = true;
        kpiResults.tests.passed = true;
        log("  ⏭️ Frontend KPIs skipped (no frontend changes)");
    }
    
    // BACKEND KPIs (only if backend changes)
    if (hasBackendChanges && projectContext.hasGo) {
        // KPI 5: Go Build
        log("  ├─ Go build...");
        const goBuildResult = spawnSync('go', ['build', './...'], {
            cwd: path.join(workspace, 'backend'),
            encoding: 'utf8',
            timeout: 120000
        });
        kpiResults.goBuild.passed = goBuildResult.status === 0;
        kpiResults.goBuild.output = goBuildResult.stderr || goBuildResult.stdout || '';
        
        if (kpiResults.goBuild.passed) {
            log("  │  ✅ Go build OK");
        } else {
            log("  │  ❌ Go build failed");
        }
        
        // KPI 6: Go Tests
        log("  └─ Go tests...");
        const goTestResult = spawnSync('go', ['test', './...', '-v'], {
            cwd: path.join(workspace, 'backend'),
            encoding: 'utf8',
            timeout: 120000
        });
        kpiResults.goTest.passed = goTestResult.status === 0;
        kpiResults.goTest.output = goTestResult.stderr || goTestResult.stdout || '';
        
        if (kpiResults.goTest.passed) {
            log("     ✅ Go tests OK");
        } else {
            log("     ❌ Go tests failed");
        }
    } else {
        kpiResults.goBuild.skipped = true;
        kpiResults.goBuild.passed = true;
        kpiResults.goTest.skipped = true;
        kpiResults.goTest.passed = true;
        if (hasBackendChanges) {
            log("  ⏭️ Backend KPIs skipped (no Go project)");
        } else {
            log("  ⏭️ Backend KPIs skipped (no backend changes)");
        }
    }
    
    // Check if ALL applicable KPIs passed
    const allPassed = kpiResults.typescript.passed && 
                      kpiResults.lint.passed && 
                      kpiResults.build.passed && 
                      kpiResults.tests.passed &&
                      kpiResults.goBuild.passed &&
                      kpiResults.goTest.passed;
    
    if (allPassed) {
        log(`✅ ALL KPIs passed on loop ${kpiLoopCount}!`);
        break;
    }
    
    // Not all passed - try to fix if not last attempt
    if (kpiLoopCount < MAX_KPI_LOOPS) {
        log("🔧 KPI Fix Loop...");
        telegramKeepAlive("FIXING KPIs");
        
        // Collect all errors with categorization
        const errors = [];
        const errorTypes = [];
        
        if (!kpiResults.typescript.passed && !kpiResults.typescript.skipped) {
            const tsErrors = kpiResults.typescript.output.match(/error TS\d+:.*$/gm) || [];
            errors.push(`TYPESCRIPT:\n${tsErrors.slice(0, 3).join('\n')}`);
            errorTypes.push('typescript');
        }
        if (!kpiResults.lint.passed && !kpiResults.lint.skipped) {
            const lintOutput = kpiResults.lint.output;
            if (lintOutput.includes('ESLint couldn\'t find') || 
                lintOutput.includes('Cannot find module') ||
                lintOutput.includes('Config Error')) {
                errors.push(`LINT CONFIG ERROR:\n${lintOutput.substring(0, 400)}\n\nYou may need to create or fix eslint.config.js`);
                errorTypes.push('lint-config');
            } else {
                const lintErrors = lintOutput.match(/\d+:\d+\s+error\s+.*/gm) || [];
                errors.push(`LINT ERRORS:\n${lintErrors.slice(0, 5).join('\n') || lintOutput.substring(0, 300)}`);
                errorTypes.push('lint-code');
            }
        }
        if (!kpiResults.build.passed && !kpiResults.build.skipped) {
            errors.push(`FRONTEND BUILD:\n${kpiResults.build.output.substring(0, 300)}`);
            errorTypes.push('build');
        }
        if (!kpiResults.tests.passed && !kpiResults.tests.skipped) {
            errors.push(`FRONTEND TESTS:\n${kpiResults.tests.output.substring(0, 300)}`);
            errorTypes.push('tests');
        }
        if (!kpiResults.goBuild.passed && !kpiResults.goBuild.skipped) {
            errors.push(`GO BUILD:\n${kpiResults.goBuild.output.substring(0, 300)}`);
            errorTypes.push('go-build');
        }
        if (!kpiResults.goTest.passed && !kpiResults.goTest.skipped) {
            errors.push(`GO TESTS:\n${kpiResults.goTest.output.substring(0, 300)}`);
            errorTypes.push('go-tests');
        }
        
        const kpiFixPrompt = `
[KPI FAILURE - RESPONSIBILITY LOOP]
Your code failed quality checks. YOU ARE RESPONSIBLE FOR FIXING THIS.

[FAILED KPIs]
${errors.join('\n\n')}

[ERROR TYPES DETECTED: ${errorTypes.join(', ')}]

[PROJECT CONTEXT]
Type: ${projectContext.type}
${projectContext.framework ? `Framework: ${projectContext.framework} ${projectContext.frameworkVersion || ''}` : ''}
${projectContext.mockLibrary ? `Mock Library: ${projectContext.mockLibrary}` : ''}

[YOUR RESPONSIBILITIES]
- TypeScript: Fix type errors, add missing types
- Lint Config: Fix ESLint config file (eslint.config.js) if needed
- Lint Code: Fix linting errors in source files
- Build: Fix build failures, resolve imports
- Tests: Fix failing tests, use the project's mock library (${projectContext.mockLibrary || 'unknown'})
- Go Build: Fix Go compilation errors
- Go Tests: Fix Go test failures

[RULES]
- DO NOT add new features
- ONLY fix what's broken
- Output a summary of fixes made

[WORKSPACE]
${workspace}

FIX NOW.
`;
        
        const fixResult = runOpencode(kpiFixPrompt);
        log(`KPI Fix applied: ${fixResult.stdout.substring(0, 200)}...`);
        fsLog(`KPI Fix loop ${kpiLoopCount}: ${fixResult.stdout.substring(0, 500)}`);
    }
}

// Final KPI status
const finalKpiStatus = {
    typescript: kpiResults.typescript.passed,
    lint: kpiResults.lint.passed,
    build: kpiResults.build.passed,
    tests: kpiResults.tests.passed,
    goBuild: kpiResults.goBuild.passed,
    goTest: kpiResults.goTest.passed
};
const totalKpis = Object.values(finalKpiStatus).filter(v => v === true).length;
const totalPossible = Object.values(finalKpiStatus).length;
log(`📊 Final KPI Score: ${totalKpis}/${totalPossible}`);
fsLog(`KPI Final: TypeScript=${kpiResults.typescript.passed}, Lint=${kpiResults.lint.passed}, Build=${kpiResults.build.passed}, Tests=${kpiResults.tests.passed}, GoBuild=${kpiResults.goBuild.passed}, GoTest=${kpiResults.goTest.passed}`);

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
const deletedSummary = fileDiff.deleted.length > 0
    ? `🗑️ FILES DELETED:\n${fileDiff.deleted.map(f => `  - ${f}`).join('\n')}\n`
    : '';
const hasAnyChangesForVerify = fileDiff.created.length > 0 || fileDiff.modified.length > 0 || fileDiff.deleted.length > 0;
const noChangesWarning = !hasAnyChangesForVerify
    ? `⚠️ WARNING: No file changes detected! The plan may not have been executed.\n`
    : '';

const verifyPrompt = `
[GHOST-PAD - THE PLAN]
${plan}

[FILE CHANGE DETECTION]
${fileChangeSummary}${modifiedSummary}${deletedSummary}${noChangesWarning}

[AGENT'S CLAIMED CHANGES]
${stage2.stdout}

[INSTRUCTION]
1. Check if files were created, modified, or deleted (see above).
2. If changes exist and match the plan, output: VERDICT: APPROVED
3. If NO changes were detected but plan was valid, output: VERDICT: REJECTED - No files modified
4. If changes don't match plan, output: VERDICT: REJECTED with explanation.

You MUST provide a final verdict.
`;

const stage3 = runOpencode(verifyPrompt);

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

=== KPI RESULTS ===
TypeScript: ${finalKpiStatus.typescript ? '✅' : '❌'}
Lint: ${finalKpiStatus.lint ? '✅' : '❌'}
Build: ${finalKpiStatus.build ? '✅' : '❌'}
Tests: ${finalKpiStatus.tests ? '✅' : '❌'}
Score: ${kpiScore}/4
`;

console.log(finalOutput);

// Check for verdict
const hasApproved = stage3.stdout.toUpperCase().includes('VERDICT: APPROVED') || 
                    stage3.stdout.includes('✅ APPROVED') ||
                    stage3.stdout.includes('APPROVED');

const hasRejected = stage3.stdout.toUpperCase().includes('VERDICT: REJECTED') ||
                    stage3.stdout.includes('❌ REJECTED') ||
                    stage3.stdout.includes('REJECTED');

// KPI failure overrides approval (use totalPossible dynamically)
const requiredKpiScore = totalPossible; // All applicable KPIs must pass
if (kpiScore < requiredKpiScore) {
    log(`❌ Task rejected - KPI score ${kpiScore}/${totalPossible}`);
    const failedKpis = Object.entries(finalKpiStatus)
        .filter(([k, v]) => !v)
        .map(([k]) => k)
        .join(', ');
    notifyTelegram(`❌ *KPI Failed (${kpiScore}/${totalPossible})*\n\nTask: ${taskId}\nFailed: ${failedKpis}`);
    trackGhostpadFailure();
    if (snapshotPath) rollbackWorkspace(snapshotPath);
    process.exit(1);
}

// Note: No-changes check already done before KPIs
// If we reach here, changes were made and KPIs passed

if (hasApproved) {
    log("✅ Task verified and approved locally.");
    
    // AUTO-COMMIT: Commit changes to target repo
    try {
        const gitStatus = execSync(`git status --porcelain`, { 
            cwd: workspace, 
            encoding: 'utf8' 
        });
        
        if (gitStatus.trim()) {
            log("📦 Auto-committing changes to target repo...");
            
            // Stage all changes
            execSync('git add .', { cwd: workspace });
            
            // Commit with task info
            const commitMsg = `feat: Agency task ${taskId}\n\n${taskDesc.substring(0, 100)}`;
            execSync(`git commit -m "${commitMsg}"`, { cwd: workspace });
            
            // Push
            execSync('git push origin main', { cwd: workspace, timeout: 30000 });
            
            log("✅ Changes committed and pushed!");
        }
    } catch (e) {
        log(`⚠️ Auto-commit skipped: ${e.message}`);
    }
    
    notifyTelegram(`✅ *Task Complete*\n\nTask: ${taskId}\nBuild: ✅ Passed\nCommit: Auto-pushed`);
    // Clear failure tracker on success
    try { fs.unlinkSync(FAILURE_TRACKER_PATH); } catch (e) {}
    process.exit(0);
} else if (hasRejected) {
    log("❌ Task rejected by verification.");
    trackGhostpadFailure();
    if (snapshotPath) rollbackWorkspace(snapshotPath);
    process.exit(1);
} else {
    // FALLBACK: No clear verdict - send to code-reviewer
    log("⚠️ No clear verdict. Handing to code-reviewer for external review.");
    console.log("NO_VERDICT:SEND_TO_REVIEWER");
    
    // This is not a failure - let the orchestrator's code-reviewer handle it
    process.exit(0);
}
