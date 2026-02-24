const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

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

function notifyTelegram(text) {
    if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;
    try {
        execSync(`curl -s -o /dev/null -X POST https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage -d chat_id=${CONFIG.TELEGRAM_CHAT_ID} --data-urlencode text="${text}"`);
    } catch(e) {}
}

async function runAgent(prompt, agent = 'build') {
    const startMili = Date.now();
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
        }, 10 * 60 * 1000); // 10 min timeout per run

        child.on('close', code => {
            clearTimeout(timeout);
            const duration = Date.now() - startMili;
            log(`<<< AGENT EXITED: ${code}`);

            // PERSONA TELEMETRY (Live LLM Output)
            if (stdout) {
                let persona = "🤖 [AGENT]";
                let icon = "💭";
                const upperPrompt = prompt.toUpperCase();
                if (upperPrompt.includes('CONTRACT')) { persona = "📐 [ARCHITECT]"; icon = "📏"; }
                else if (upperPrompt.includes('BACKEND')) { persona = "🐹 [BACKEND]"; icon = "⚙️"; }
                else if (upperPrompt.includes('FRONTEND')) { persona = "🖼️ [FRONTEND]"; icon = "🎨"; }
                else if (upperPrompt.includes('REPAIR') || upperPrompt.includes('ITERATION')) { persona = "🩺 [MEDIC]"; icon = "🩹"; }
                else if (upperPrompt.includes('SKEPTIC')) { persona = "🧐 [SKEPTIC]"; icon = "🔒"; }

                const clean = stdout.replace(/```[\s\S]*?```/g, '').trim(); 
                const sentences = clean.split(/[.!?]\s+/);
                
                // Signal: Try to find a sentence that looks like a conclusive action
                let liveThought = sentences.find(s => s.length > 40 && s.length < 300) || sentences[sentences.length - 1] || "Turn complete.";
                
                notifyTelegram(`${icon} *${persona}*\n"${liveThought.trim()}"\n_⏱️ Took ${Math.round(duration/1000)}s_`);
            }

            resolve({ stdout, stderr, code });
        });
    });
}

function classifyError(output) {
    const lower = output.toLowerCase();
    if (lower.includes('undefined: models')) return 'Missing Model Import';
    if (lower.includes('cannot convert')) return 'Type Conversion Error';
    if (lower.includes('not in goroot')) return 'Import Path Error';
    if (lower.includes('error: undefined variable')) return 'SCSS Undefined Variable';
    if (lower.includes('error ts')) return 'TypeScript Type Error';
    if (lower.includes('failed to load config') || lower.includes('cannot find module')) return 'Config/Module Error';
    return 'General Error';
}

function verifyWorkspace(expectedFiles) {
    const results = { passed: true, errors: [], patterns: [] };
    
    // 1. Go Build
    const backendPath = path.join(WORKSPACE, 'backend');
    if (fs.existsSync(backendPath)) {
        try {
            execSync('go mod tidy', { cwd: backendPath, stdio: 'ignore' });
            execSync('go build ./...', { cwd: backendPath, stdio: 'pipe' });
        } catch(e) {
            results.passed = false;
            const err = ((e.stdout || '') + (e.stderr || '')).toString();
            results.errors.push(`[GO BUILD] ${err.slice(-1000)}`);
            results.patterns.push(classifyError(err));
        }
    }

    // 2. Frontend Check
    const frontendPath = path.join(WORKSPACE, 'frontend');
    if (fs.existsSync(frontendPath)) {
        try { execSync('npm run type-check', { cwd: frontendPath, stdio: 'pipe' }); }
        catch(e) {
            results.passed = false;
            const err = ((e.stdout || '') + (e.stderr || '')).toString();
            results.errors.push(`[TS CHECK] ${err.slice(-1000)}`);
            results.patterns.push(classifyError(err));
        }
        
        try { execSync('npm run lint', { cwd: frontendPath, stdio: 'pipe' }); }
        catch(e) {
            results.passed = false;
            const err = ((e.stdout || '') + (e.stderr || '')).toString();
            results.errors.push(`[LINT] ${err.slice(-1000)}`);
            results.patterns.push(classifyError(err));
        }
        
        try { execSync('npm run build-only', { cwd: frontendPath, stdio: 'pipe' }); }
        catch(e) {
            results.passed = false;
            const err = ((e.stdout || '') + (e.stderr || '')).toString();
            results.errors.push(`[BUILD] ${err.slice(-1000)}`);
            results.patterns.push(classifyError(err));
        }
        
        const pkg = JSON.parse(fs.readFileSync(path.join(frontendPath, 'package.json'), 'utf8'));
        if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo') {
            try { execSync('npm run test:unit -- --run', { cwd: frontendPath, stdio: 'pipe' }); }
            catch(e) {
                results.passed = false;
                const err = ((e.stdout || '') + (e.stderr || '')).toString();
                results.errors.push(`[TESTS] ${err.slice(-1000)}`);
                results.patterns.push(classifyError(err));
            }
        }
    }
    
    // 3. Expected Files
    if (expectedFiles && expectedFiles.length > 0) {
        const missing = expectedFiles.filter(f => !fs.existsSync(path.join(WORKSPACE, f)));
        if (missing.length > 0) {
            results.passed = false;
            results.errors.push(`[MISSING FILES] ${missing.join(', ')}`);
            results.patterns.push('Missing Expected Files');
        }
    }
    
    return results;
}

async function runBenchmarkTask(taskId) {
    const taskPath = path.join(WORKSPACE, 'benchmark', 'tasks', `${taskId}.json`);
    if (!fs.existsSync(taskPath)) throw new Error(`Task ${taskId} not found`);
    const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
    
    log(`\n=== STARTING BENCHMARK: ${taskId} ===`);
    notifyTelegram(`🚀 *Starting Benchmark*\nTask: ${taskId}\nDesc: ${task.description}`);
    
    // Reset Workspace
    log(`🔄 Resetting workspace...`);
    try {
        execSync('git reset --hard benchmark-baseline', { cwd: WORKSPACE, stdio: 'pipe' });
        execSync('git clean -fd', { cwd: WORKSPACE, stdio: 'pipe' });
    } catch(e) {
        log(`⚠️ Baseline reset failed: ${e.message.slice(0, 100)}`);
    }
    
    // Restore node_modules if needed
    const frontendPath = path.join(WORKSPACE, 'frontend');
    if (fs.existsSync(frontendPath) && !fs.existsSync(path.join(frontendPath, 'node_modules', '.bin', 'vite'))) {
        log(`📦 Restoring node_modules...`);
        try { execSync('npm install', { cwd: frontendPath, stdio: 'ignore' }); } catch(e){}
    }
    
    // Phase 1: Contract Agent
    log(`\n📝 PHASE 1: CONTRACT AGENT`);
    const contractPath = path.join(WORKSPACE, '.run/contract.md');
    // Ensure dir exists
    if (!fs.existsSync(path.dirname(contractPath))) fs.mkdirSync(path.dirname(contractPath), { recursive: true });
    
    const contractPrompt = `You are the Contract Agent. Your job is to define the interface between backend and frontend BEFORE implementation begins.
TASK: ${task.description}
REQUIREMENTS: ${JSON.stringify(task.requirements, null, 2)}

Create a file at \`${contractPath}\` that contains:
1. The Go struct definitions (with JSON tags)
2. The TypeScript interfaces
3. The API endpoint routes, methods, and payload structures

Make sure the Go structs and TypeScript interfaces match EXACTLY.
Use the write tool to save the file.`;

    await runAgent(contractPrompt, 'build');
    
    let contractContent = '';
    if (fs.existsSync(contractPath)) {
        contractContent = fs.readFileSync(contractPath, 'utf8');
        log(`Contract generated: ${contractContent.slice(0, 200).replace(/\n/g, ' ')}...`);
    } else {
        log(`⚠️ Contract not generated, proceeding without it.`);
    }

    // Phase 2: Backend Agent
    if (task.requirements?.backend) {
        log(`\n🐹 PHASE 2: BACKEND AGENT`);
        const backendPrompt = `You are the Backend Engineer. Implement the Go backend according to the contract.
CONTRACT:
${contractContent}

REQUIREMENTS: ${JSON.stringify(task.requirements.backend, null, 2)}

Instructions:
1. Use the 'write' tool to create the Go models and handlers in ${WORKSPACE}/backend.
2. Read go.mod to check the module path before writing imports.
3. Use exact models and routes defined in the CONTRACT.`;
        await runAgent(backendPrompt, 'build');
    }

    // Phase 3: Frontend Agent
    if (task.requirements?.frontend) {
        log(`\n🖼️ PHASE 3: FRONTEND AGENT`);
        const frontendPrompt = `You are the Frontend Engineer. Implement the Vue frontend according to the contract.
CONTRACT:
${contractContent}

REQUIREMENTS: ${JSON.stringify(task.requirements.frontend, null, 2)}

Instructions:
1. Use the 'write' tool to create the Vue pages, components, and Pinia stores in ${WORKSPACE}/frontend/src.
2. Use the exact types and API routes defined in the CONTRACT.`;
        await runAgent(frontendPrompt, 'build');
    }

    // Phase 4: Graduated Persistence Loop
    log(`\n🔄 PHASE 4: GRADUATED PERSISTENCE LOOP`);
    let iteration = 0;
    const MAX_ITERATIONS = 5;
    const expectedFiles = task.groundTruth?.expectedFiles || [];
    const patternHistory = {}; 
    
    let finalResults = { passed: false };
    
    while (iteration < MAX_ITERATIONS) {
        iteration++;
        log(`\nVerification Loop ${iteration}/${MAX_ITERATIONS}...`);
        
        const results = verifyWorkspace(expectedFiles);
        finalResults = results;
        if (results.passed) {
            log(`✅ All checks passed!`);
            break;
        }
        
        log(`❌ Checks failed: ${results.errors.length} errors`);
        
        // Track patterns
        let loopEscalation = false;
        for (const pattern of results.patterns) {
            patternHistory[pattern] = (patternHistory[pattern] || 0) + 1;
            if (patternHistory[pattern] >= 3) {
                loopEscalation = true;
                log(`🚨 Repeated pattern detected: ${pattern} (3x)`);
            }
        }
        
        let fixPrompt = `[VERIFICATION FAILED - ITERATION ${iteration}]
The following errors occurred:
${results.errors.join('\n\n')}

EXPECTED FILES (Must exist): ${expectedFiles.join(', ')}

`;
        if (loopEscalation) {
            fixPrompt += `🚨 CRITICAL STRATEGY ESCALATION: You are stuck in a loop! You have failed with the same error pattern 3 times.
DO NOT repeat the same fix. Step back, re-read the code structure, check your imports and directory layout. The current approach is fundamentally flawed.`;
            // Reset counts to give it another chance without constant escalation panic
            for(let p in patternHistory) patternHistory[p] = 0;
        } else {
            fixPrompt += `Please fix these errors. Use the read tool to inspect files and the write/edit tools to fix them. Make sure to fix the root cause.`;
        }

        await runAgent(fixPrompt, 'build');
    }

    // Phase 5: Skeptic Agent
    if (finalResults.passed) {
        log(`\n🧐 PHASE 5: SKEPTIC AGENT`);
        const skepticPrompt = `You are the Skeptic Agent. The engineers have successfully implemented the task and tests pass.
TASK: ${task.description}
Read the modified files in ${WORKSPACE}. Generate a list of questions a senior engineer would ask during code review. Focus on architecture, edge cases, and maintainability.
Output 'APPROVED' if it's acceptable (even with minor concerns), or 'REJECTED' if there is a critical, project-breaking flaw.`;
        
        const skepticResult = await runAgent(skepticPrompt, 'build');
        const skepticUpper = skepticResult.stdout.toUpperCase();
        const isRejected = skepticUpper.includes('REJECTED') || skepticUpper.includes('❌');
        const isApproved = !isRejected && (skepticUpper.includes('APPROVED') || skepticUpper.includes('✅'));
        log(`Skeptic Verdict: ${isApproved ? 'APPROVED' : 'REJECTED'}`);
        
        if (isApproved) {
            log(`\n✅ Task Complete and Approved!`);
            notifyTelegram(`✅ *Benchmark ${taskId} Complete*\nAll KPIs passed and Skeptic approved.`);
            return true;
        } else {
            log(`\n❌ Task complete but rejected by Skeptic.`);
            notifyTelegram(`⚠️ *Benchmark ${taskId} Completed but Skeptic Rejected*\nCheck logs for details.`);
            return false;
        }
    } else {
        log(`\n❌ Failed to pass verification after ${MAX_ITERATIONS} iterations.`);
        notifyTelegram(`❌ *Benchmark ${taskId} Failed*\nMax iterations reached.\nErrors: ${finalResults.errors.slice(0,2).join('; ').slice(0, 100)}`);
        return false;
    }
}

// Argument parsing
const args = process.argv.slice(2);
const taskArgIndex = args.indexOf('--task');
if (taskArgIndex !== -1 && taskArgIndex < args.length - 1) {
    runBenchmarkTask(args[taskArgIndex + 1])
        .then(success => process.exit(success ? 0 : 1))
        .catch(e => {
            console.error(e);
            process.exit(1);
        });
} else {
    console.log("Orchestrator V10.0 (Contract & Skeptic Edition) - Only one-shot mode supported currently.");
    console.log("Usage: node orchestrator.cjs --task <task_id>");
}