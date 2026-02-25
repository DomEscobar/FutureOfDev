const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { updateDashboard } = require('./telemetry-dash.cjs');

const AGENCY_ROOT = __dirname;
const CONFIG = JSON.parse(fs.readFileSync(path.join(AGENCY_ROOT, 'config.json'), 'utf8'));
const WORKSPACE = CONFIG.PROJECT_WORKSPACE;
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });

const OPENCODE_BIN = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : path.join(process.env.HOME, '.opencode/bin/opencode');

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(path.join(RUN_DIR, 'orchestrator.log'), line + '\n');
}

async function runAgent(prompt, agent = 'build', phaseKey = null) {
    const startMili = Date.now();
    
    if (phaseKey) {
        const phases = {};
        phases[phaseKey] = { status: "⚙️ Implementing...", time: "" };
        updateDashboard({ phases, latestThought: "Spinning up agent...", persona: "🤖 [SYSTEM]" });
    }

    return new Promise((resolve) => {
        log(`>>> RUNNING AGENT: ${agent}`);
        const child = spawn(OPENCODE_BIN, ['run', '-', '--agent', agent, '--dir', WORKSPACE], {
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
            log(`<<< AGENT EXITED: ${code}`);

            const estimatedInput = prompt.length / 4 + 2000; 
            const estimatedOutput = stdout.length / 4;
            let turnTokens = Math.round(estimatedInput + estimatedOutput);
            
            if (stdout) {
                let persona = "🤖 [AGENT]";
                const upperPrompt = prompt.toUpperCase();
                if (upperPrompt.includes('CONTRACT')) persona = "📐 [ARCHITECT]";
                else if (upperPrompt.includes('BACKEND')) persona = "🐹 [BACKEND]";
                else if (upperPrompt.includes('FRONTEND')) persona = "🖼️ [FRONTEND]";
                else if (upperPrompt.includes('REPAIR') || upperPrompt.includes('ITERATION')) persona = "🩺 [MEDIC]";
                else if (upperPrompt.includes('SKEPTIC')) persona = "🧐 [SKEPTIC]";

                const clean = stdout.replace(/```[\s\S]*?```/g, '').trim(); 
                const sentences = clean.split(/[.!?]\s+/);
                let thought = sentences.find(s => s.length > 40 && s.length < 300) || sentences[sentences.length - 1] || "Step completed.";
                
                const phases = {};
                if (phaseKey) {
                    phases[phaseKey] = { status: code === 0 ? "✅ PASSED" : "❌ FAILED", time: timeStr };
                }

                const stateFile = path.join(AGENCY_ROOT, '.run', 'telemetry_state.json');
                let currentState = { metrics: { tokens: 0, cost: "0.00", loops: 0 } };
                if (fs.existsSync(stateFile)) {
                    try { currentState = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch(e){}
                }
                
                const totalTokens = (Number(currentState.metrics?.tokens?.replace(/[^0-9]/g, '')) || 0) + turnTokens;
                const estCost = (totalTokens * 0.000001).toFixed(3);

                updateDashboard({ 
                    phases, 
                    latestThought: thought.trim().replace(/"/g, "'"), 
                    persona,
                    metrics: {
                        ...currentState.metrics,
                        tokens: totalTokens.toLocaleString('en-US'),
                        cost: estCost,
                        loops: (currentState.metrics?.loops || 0) + (upperPrompt.includes('REPAIR') ? 1 : 0),
                        quality: code === 0 ? "A+" : "B-",
                        tests: currentState.metrics?.tests || "Waiting"
                    }
                });
            }
            resolve({ stdout, stderr, code });
        });
    });
}

function classifyError(output) {
    const lower = output.toLowerCase();
    if (lower.includes('undefined: models')) return 'Missing Model Import';
    if (lower.includes('error ts')) return 'TypeScript Type Error';
    return 'General Error';
}

function verifyWorkspace() {
    const results = { passed: true, errors: [], patterns: [], stats: { goTests: 0, jsTests: 0 } };
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
            results.errors.push(`[BACKEND ERR]`);
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
    
    updateDashboard({ taskId, startTime: Date.now(), latestThought: "Initialization...", persona: "🤖 [SYSTEM]", metrics: { tokens: "0", cost: "0.000", loops: 0, quality: "A+", tests: "0 | 0" } });

    try {
        execSync('git reset --hard benchmark-baseline', { cwd: WORKSPACE, stdio: 'ignore' });
        execSync('git clean -fd', { cwd: WORKSPACE, stdio: 'ignore' });
    } catch(e) {}
    
    const contractPath = path.join(WORKSPACE, '.run/contract.md');
    await runAgent(`CONTRACT: ${task.description}`, 'build', 'architect');
    let contractContent = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf8') : '';

    if (task.requirements?.backend) {
        await runAgent(`BACKEND: ${contractContent}`, 'build', 'backend');
    }

    if (task.requirements?.frontend) {
        await runAgent(`FRONTEND: ${contractContent}`, 'build', 'frontend');
    }

    let iteration = 0;
    while (iteration < 5) {
        iteration++;
        const results = verifyWorkspace();
        
        const stateFile = path.join(AGENCY_ROOT, '.run', 'telemetry_state.json');
        let currentState = { metrics: {} };
        if (fs.existsSync(stateFile)) currentState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        
        updateDashboard({ 
            metrics: { 
                ...currentState.metrics,
                tests: `Go: ${results.stats.goTests} | JS: ${results.stats.jsTests}`
            } 
        });

        if (results.passed) {
            updateDashboard({ phases: { medic: { status: "✅ PASSED (Clean Build)", time: "" } } });
            break;
        }
        await runAgent(`REPAIR: ${results.errors.join('\\n')}`, 'build', 'medic');
    }

    const sResult = await runAgent(`SKEPTIC: Review ${WORKSPACE}`, 'build', 'skeptic');
    if (sResult.stdout.toUpperCase().includes('APPROVED')) {
        updateDashboard({ latestThought: "Mission Accomplished.", persona: "🧐 [SKEPTIC]" });
        return true;
    }
    return false;
}

const args = process.argv.slice(2);
const taskArgIndex = args.indexOf('--task');
if (taskArgIndex !== -1) {
    runBenchmarkTask(args[taskArgIndex + 1]).catch(e => { console.error(e); process.exit(1); });
}
