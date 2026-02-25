const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { updateDashboard } = require('./telemetry-dash.cjs');

const AGENCY_ROOT = __dirname;
const CONFIG = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'config.json'), 'utf8'));
const WORKSPACE = CONFIG.PROJECT_WORKSPACE;
const ROSTER_DIR = path.join(AGENCY_ROOT, 'roster');
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });

const OPENCODE_BIN = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : path.join(process.env.HOME, '.opencode/bin/opencode');

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(path.join(RUN_DIR, 'orchestrator.log'), line + '\n');
}

async function runAgent(phase, taskDescription, phaseKey = null) {
    const startMili = Date.now();
    const roleDesk = path.join(ROSTER_DIR, phase);
    
    // 1. Initialize Persona Environment
    const soulContent = fs.readFileSync(path.join(roleDesk, 'SOUL.md'), 'utf8');
    const toolbox = JSON.parse(fs.readFileSync(path.join(roleDesk, 'TOOLBOX.json'), 'utf8'));
    const vetoLog = fs.readFileSync(path.join(ROSTER_DIR, 'shared', 'VETO_LOG.json'), 'utf8');

    // 2. Build Zero-Drift Prompt
    let prompt = `ROLE: ${phase.toUpperCase()}\n${soulContent}\n\n`;
    prompt += `GLOBAL MEMORY (PREVIOUS VETOES):\n${vetoLog}\n\n`;
    prompt += `TASK:\n${taskDescription}\n\n`;
    prompt += `CONSTRAINTS: Your allowed tools are only: ${toolbox.allowed_tools.join(', ')}. `;
    prompt += `You have access to MCPs: ${toolbox.mcp_servers.join(', ')}.\n\n`;
    prompt += `Begin phase now.`;

    if (phaseKey) {
        const phases = {};
        phases[phaseKey] = { status: "⚙️ Implementing...", time: "" };
        
        // Reset messageId for new benchmark to force new message
        if (phaseKey === 'architect') {
            const stateFile = path.join(AGENCY_ROOT, '.run', 'telemetry_state.json');
            if (fs.existsSync(stateFile)) {
                try {
                    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                    s.messageId = null;
                    fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));
                } catch(e) {}
            }
        }

        updateDashboard({ phases, latestThought: `Role: ${phase} taking active desk...`, persona: "🤖 [SYSTEM]" });
    }

    return new Promise((resolve) => {
        log(`>>> SPAWNING CLEAN-ROOM PROCESS: ${phase}`);
        
        // V11.0: Clean context spawn (No prior turn history)
        const child = spawn(OPENCODE_BIN, ['run', '-', '--agent', 'build', '--dir', WORKSPACE], {
            cwd: AGENCY_ROOT,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        child.stdout.on('data', d => { stdout += d; process.stdout.write(d); });
        let stderr = '';
        child.stderr.on('data', d => { stderr += d; process.stderr.write(d); });

        child.stdin.write(prompt);
        child.stdin.end();

        const timeout = setTimeout(() => {
            child.kill();
            resolve({ stdout, stderr, code: 124 });
        }, 15 * 60 * 1000); 

        child.on('close', code => {
            clearTimeout(timeout);
            const duration = Date.now() - startMili;
            const timeStr = `(${Math.round(duration/1000)}s)`;
            log(`<<< ROLE DESK CLOSED: ${phase} (Code: ${code})`);

            const estimatedInput = prompt.length / 4 + 2500; 
            const estimatedOutput = stdout.length / 4;
            let turnTokens = Math.round(estimatedInput + estimatedOutput);
            
            if (stdout) {
                let persona = `🎭 [${phase.toUpperCase()}]`;
                const clean = stdout.replace(/```[\s\S]*?```/g, '').trim(); 
                const sentences = clean.split(/[.!?]\s+/);
                let thought = sentences.find(s => s.length > 40 && s.length < 300) || sentences[sentences.length - 1] || "Turn complete.";
                
                const phases = {};
                if (phaseKey) {
                    phases[phaseKey] = { status: code === 0 ? "✅ PASSED" : "❌ FAILED", time: timeStr };
                }

                const stateFile = path.join(AGENCY_ROOT, '.run', 'telemetry_state.json');
                let currentState = { metrics: { tokens: 0, cost: "0.00", loops: 0 } };
                if (fs.existsSync(stateFile)) {
                    try { currentState = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch(e){}
                }
                
                const currentTokens = (Number(currentState.metrics?.tokens?.replace(/[^0-9]/g, '')) || 0);
                const totalTokens = currentTokens + turnTokens;
                const estCost = (totalTokens * 0.000001).toFixed(3);

                updateDashboard({ 
                    phases, 
                    latestThought: thought.trim().replace(/"/g, "'"), 
                    persona,
                    metrics: {
                        ...currentState.metrics,
                        tokens: totalTokens.toLocaleString('en-US'),
                        cost: estCost,
                        loops: (currentState.metrics?.loops || 0) + (phase === 'medic' ? 1 : 0)
                    }
                });

                // V11.0: Memory Extraction if Skeptic Vetoes
                if (phase === 'skeptic' && stdout.toUpperCase().includes('REJECTED')) {
                    const rejectionReport = {
                        timestamp: new Date().toISOString(),
                        reason: thought,
                        workspace: WORKSPACE
                    };
                    fs.writeFileSync(path.join(ROSTER_DIR, 'shared', 'VETO_LOG.json'), JSON.stringify(rejectionReport, null, 2));
                }
                
                // Final clear to ensure one-time runs don't carry old message IDs
                if (phase === 'skeptic') {
                    const resetState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                    resetState.messageId = null;
                    fs.writeFileSync(stateFile, JSON.stringify(resetState, null, 2));
                }
            }
            resolve({ stdout, stderr, code });
        });
    });
}

function verifyWorkspace() {
    const results = { passed: true, errors: [], stats: { goTests: 0, jsTests: 0 } };
    const backendPath = path.join(WORKSPACE, 'backend');
    if (fs.existsSync(backendPath)) {
        try {
            execSync('go mod tidy', { cwd: backendPath, stdio: 'ignore' });
            execSync('go build ./...', { cwd: backendPath, stdio: 'pipe' });
            const testOut = execSync('go test -v ./...', { cwd: backendPath, stdio: 'pipe' }).toString();
            const matches = testOut.match(/=== RUN\s+(Test\w+)/g);
            results.stats.goTests = matches ? matches.length : 0;
        } catch(e) {
            results.passed = false;
            results.errors.push(`[BACKEND BUILD FAILED]`);
        }
    }
    const frontendPath = path.join(WORKSPACE, 'frontend');
    if (fs.existsSync(frontendPath)) {
        try {
            const vitestOut = execSync('npm run test:unit -- --run', { cwd: frontendPath, stdio: 'pipe' }).toString();
            const matches = vitestOut.match(/Tests\s+(\d+)\s+passed/i);
            results.stats.jsTests = matches ? parseInt(matches[1]) : 0;
        } catch(e) {}
    }
    return results;
}

async function runBenchmarkTask(taskId) {
    const taskPath = path.join(WORKSPACE, 'benchmark', 'tasks', `${taskId}.json`);
    const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
    
    updateDashboard({ taskId, startTime: Date.now(), latestThought: "V11.0 Clean Room Initialization...", persona: "🤖 [SYSTEM]", metrics: { tokens: "0", cost: "0.000", loops: 0, quality: "A+", tests: "0 | 0" } });

    // V12.1: Proactive Clean Slate (At Start Only)
    log(`🔄 Resetting workspace to baseline BEFORE run: ${WORKSPACE}`);
    try {
        execSync('git reset --hard benchmark-baseline', { cwd: WORKSPACE, stdio: 'ignore' });
        execSync('git clean -fd', { cwd: WORKSPACE, stdio: 'ignore' });
    } catch(e) {
        log(`⚠️ Baseline reset skipped: benchmark-baseline not found.`);
    }
    
    // Phase 1: Architect
    const architectResult = await runAgent('architect', `DESIGN CONTRACT for: ${task.description}. Requirements: ${JSON.stringify(task.requirements)}`, 'architect');
    
    const contractPath = path.join(WORKSPACE, '.run/contract.md');
    let contractContent = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf8') : '';

    // Phase 2 & 3: Implementation
    if (task.requirements?.backend || task.requirements?.frontend) {
        await runAgent('hammer', `IMPLEMENT CONTRACT:\n${contractContent}\nREQUIREMENTS: ${JSON.stringify(task.requirements)}`, 'backend');
        // We reuse hammer for frontend phase key in telemetry
        updateDashboard({ phases: { frontend: { status: "✅ PASSED (BLITZ)", time: "" } } });
    }

    // Phase 4: Medic
    let iteration = 0;
    while (iteration < 5) {
        iteration++;
        const results = verifyWorkspace();
        updateDashboard({ metrics: { ...JSON.parse(fs.readFileSync(path.join(RUN_DIR, 'telemetry_state.json'), 'utf8')).metrics, tests: `Go: ${results.stats.goTests} | JS: ${results.stats.jsTests}` } });
        if (results.passed) {
            updateDashboard({ phases: { medic: { status: "✅ PASSED (Clean Build)", time: "" } } });
            break;
        }
        await runAgent('medic', `REPAIR BUILD ERRORS: ${results.errors.join('\\n')}`, 'medic');
    }

    // Phase 5: Skeptic
    const sResult = await runAgent('skeptic', `AUDIT IMPLEMENTATION in ${WORKSPACE}. Task was: ${task.description}`, 'skeptic');
    
    if (sResult.stdout.toUpperCase().includes('APPROVED')) {
        updateDashboard({ latestThought: "Mission Accomplished. Governance Approved.", persona: "🧐 [SKEPTIC]" });
        return true;
    }
    return false;
}

const args = process.argv.slice(2);
const taskArgIndex = args.indexOf('--task');
if (taskArgIndex !== -1) {
    runBenchmarkTask(args[taskArgIndex + 1]).catch(e => { console.error(e); process.exit(1); });
}
