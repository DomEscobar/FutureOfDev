#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

/**
 * ADVANCED DEV-UNIT WRAPPER V1.0 (The Ghost-Pad)
 * 
 * Features:
 * 1. Multi-Stage Cognition (Plan -> Execute -> Verify)
 * 2. Context Sterilization between stages
 * 3. Local Loop Prevention (Max 3 self-corrections)
 * 4. Alignment Enforcement
 */

const [,, taskId, taskDesc, workspace] = process.argv;
const AGENCY_ROOT = __dirname;
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
const GHOSTPAD_PATH = path.join(RUN_DIR, `ghostpad_${taskId}.md`);
const ALIGNMENT_PATH = path.join(AGENCY_ROOT, 'ALIGNMENT.md');
const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';

if (!taskId || !taskDesc || !workspace) {
    console.error('Usage: node dev-unit.cjs <task-id> "<task-desc>" <workspace>');
    process.exit(1);
}

function log(msg) {
    console.log(`[DEV-UNIT][${taskId}] ${msg}`);
}

function runOpencode(prompt, agent = 'dev-unit') {
    const result = spawnSync(opencodeBin, ['run', prompt, '--agent', agent, '--dir', workspace], {
        cwd: AGENCY_ROOT,
        env: { ...process.env, PROJECT_ID: taskId },
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        status: result.status
    };
}

function telegramKeepAlive(stage) {
    const talk = [
        "Strategizing on the board... ♟️",
        "Writing the final plan into the Ghost-Pad. 📝",
        "Sterilizing context for Stage 2. Clean room engaged. 🧪",
        "Executing the plan. High-precision mode active. 🛠️",
        "Self-auditing the changes. No slump allowed. ⚖️",
        "Comparing workspace vs. Ghost-Pad alignment. 🔍"
    ];
    const phrase = talk[Math.floor(Math.random() * talk.length)];
    notifyTelegram(`💭 *Team Sync: [${stage}]*\n"${phrase}"`);
}

function notifyTelegram(text) {
    const config = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'config.json'), 'utf8'));
    if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) return;
    spawn('curl', ['-s', '-o', '/dev/null', '-X', 'POST', `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, '-d', `chat_id=${config.TELEGRAM_CHAT_ID}`, '--data-urlencode', `text=${text}`], { stdio: 'ignore' });
}

log("🚀 Starting Stage 1: Strategic Planning...");
telegramKeepAlive("PLANNING");

// STAGE 1: PLANNING
const planPrompt = `
[GOAL] Analyze the following task and create a detailed implementation plan.
TASK: ${taskDesc}

[CONTEXT] Read ${ALIGNMENT_PATH} and follow all standards.

[INSTRUCTION] 
1. Identify all files that need modification.
2. Outline specific logic changes and edge cases.
3. Explicitly state how you will verify the fix.
4. Output your plan clearly. End your response with '### PLAN_LOCKED ###'.
`;

const stage1 = runOpencode(planPrompt);
const planMatch = stage1.stdout.match(/([\s\S]*?)### PLAN_LOCKED ###/);
const plan = planMatch ? planMatch[1].trim() : stage1.stdout.trim();

fs.writeFileSync(GHOSTPAD_PATH, plan);
log("📝 Plan locked in Ghost-Pad.");
telegramKeepAlive("LOCKED & LOADED");

// STAGE 2: EXECUTION
log("🛠️ Starting Stage 2: Clean-Room Execution...");
telegramKeepAlive("EXECUTING");

const execPrompt = `
[GHOST-PAD / MANDATORY PLAN]
${plan}

[INSTRUCTION]
Perform the changes exactly as planned above. 
Read ${ALIGNMENT_PATH} again to ensure compliance during coding.
When finished, provide a 'Summary:' of actions taken.
`;

const stage2 = runOpencode(execPrompt);

// STAGE 3: LOCAL VERIFICATION
log("⚖️ Starting Stage 3: Self-Verification...");
telegramKeepAlive("AUDITING");

const verifyPrompt = `
[GHOST-PAD]
${plan}

[SUMMARY OF CHANGES]
${stage2.stdout}

[INSTRUCTION]
Verify that the workspace matches the Ghost-Pad. 
Run tests or 'ls' to confirm.
Provide a final verdict. If successful, end with 'VERDICT: APPROVED'.
`;

const stage3 = runOpencode(verifyPrompt);

// FINAL AGGREGATION
const finalOutput = `
=== STAGE 1: PLAN ===
${plan}

=== STAGE 2: EXECUTION ===
${stage2.stdout}

=== STAGE 3: VERDICT ===
${stage3.stdout}
`;

console.log(finalOutput);

if (stage3.stdout.includes('VERDICT: APPROVED')) {
    log("✅ Task verified and approved locally.");
    process.exit(0);
} else {
    log("⚠️ Verification failed or partial success.");
    process.exit(1);
}
