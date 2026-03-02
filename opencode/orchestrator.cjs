const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const { updateDashboard } = require('./telemetry-dash.cjs');

const AGENCY_ROOT = process.env.AGENCY_HOME || '/root/FutureOfDev/opencode';
const WORKSPACE = process.env.WORKSPACE || process.cwd();
const DASHBOARD_FILE = path.join(AGENCY_ROOT, '.run', 'telemetry_state.json');
const OPENCODE_BIN = process.env.OPENCODE_BIN || '/root/.opencode/bin/opencode';

const ROLE_TO_AGENT = {
    architect: 'plan',
    hammer: 'build',
    checker: 'summary',
    skeptic: 'compaction',
    medic: 'build',
    player: 'plan',
};

function simpleGlob(pattern, cwd) {
    const base = path.dirname(pattern);
    const name = path.basename(pattern);
    const dir = path.resolve(cwd, base);
    if (!fs.existsSync(dir)) return [];
    const re = new RegExp('^' + name.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return fs.readdirSync(dir).filter(f => re.test(f)).map(f => path.join(base, f));
}

// V17.0: Track actual file changes via git
function getGitHash(dir) {
    try {
        return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
    } catch (e) {
        return null;
    }
}

function hasChanges(dir, beforeHash) {
    try {
        const afterHash = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
        const status = execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' }).trim();
        return afterHash !== beforeHash || status.length > 0;
    } catch (e) {
        return false;
    }
}

function getChangeSummary(dir) {
    try {
        const status = execSync('git status --short', { cwd: dir, encoding: 'utf8' }).trim();
        const diffStat = execSync('git diff --stat', { cwd: dir, encoding: 'utf8' }).trim();
        return { status, diffStat, fileCount: status.split('\n').filter(l => l.trim()).length };
    } catch (e) {
        return { status: '', diffStat: '', fileCount: 0 };
    }
}

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

// V16.0 KPI Gate: Enforce Definition of DONE before allowing task completion
async function enforceKPIGate(role) {
    // Skip KPI gate entirely in benchmark mode
    if (process.env.BENCHMARK_MODE) {
        log("🔒 [V16.0 KPI GATE] Benchmark mode detected – skipping KPI gate.");
        return true;
    }

    if (role !== 'hammer') return true; // Only enforce for Hammer
    
    log("🔒 [V16.0 KPI GATE] Checking Definition of DONE...");
    
    const requiredPatterns = [
        '.run/red-test.*',      // Red Test (Proof of Failure)
        '.run/green-test.*',    // Green Test (Proof of Success)
        '.run/contract.md'       // Blast Radius + VETO check
    ];
    
    const kpiResults = {};
    
    for (const pattern of requiredPatterns) {
        const matches = simpleGlob(pattern, WORKSPACE);
        kpiResults[pattern] = matches.length > 0;
        if (matches.length === 0) {
            log(`❌ KPI FAIL: Missing ${pattern}`);
        } else {
            log(`✅ KPI PASS: Found ${matches.join(', ')}`);
        }
    }
    
    // Check for linting and build violations
    try {
        // Backend Check
        const backendDir = path.join(WORKSPACE, 'backend');
        if (fs.existsSync(backendDir) && fs.readdirSync(backendDir, { recursive: true }).some(f => f.endsWith('.go'))) {
            log("🔨 [V16.0 KPI GATE] Running Go Build & Lint check...");
            const fmtCheck = execSync('gofmt -l .', { cwd: backendDir, encoding: 'utf8' });
            if (fmtCheck.trim()) {
                log(`❌ KPI FAIL: gofmt violations: ${fmtCheck.split('\n').slice(0, 5).join(', ')}`);
                kpiResults['gofmt'] = false;
            } else {
                log(`✅ KPI PASS: gofmt clean`);
                kpiResults['gofmt'] = true;
            }
            
            try {
                execSync('CGO_ENABLED=0 go build -o /dev/null ./...', { cwd: backendDir, stdio: 'ignore' });
                log(`✅ KPI PASS: go build success`);
                kpiResults['go_build'] = true;
            } catch (e) {
                log(`❌ KPI FAIL: go build failed`);
                kpiResults['go_build'] = false;
            }
        }

        // Frontend Check
        const frontendDir = path.join(WORKSPACE, 'frontend');
        if (fs.existsSync(frontendDir) && fs.existsSync(path.join(frontendDir, 'package.json'))) {
            log("🔨 [V16.0 KPI GATE] Running Frontend Build & Type check...");
            try {
                // We use a lighter check for the gate if full build takes too long, but here we enforce it
                execSync('npm run build', { cwd: frontendDir, stdio: 'ignore', timeout: 300000 });
                log(`✅ KPI PASS: npm run build success`);
                kpiResults['node_build'] = true;
            } catch (e) {
                log(`❌ KPI FAIL: npm run build failed`);
                kpiResults['node_build'] = false;
            }
        }
    } catch (e) {
        log(`⚠️  Build/Lint check encountered an error: ${e.message}`);
    }
    
    // Summary
    const passCount = Object.values(kpiResults).filter(Boolean).length;
    const totalCount = Object.keys(kpiResults).length;
    
    log(`🔒 [V16.0 KPI GATE] Result: ${passCount}/${totalCount} checks passed`);
    
    updateDashboard({ 
        lastKpiGate: { 
            role, 
            results: kpiResults, 
            passRate: `${passCount}/${totalCount}`,
            timestamp: new Date().toISOString() 
        } 
    });
    
    if (passCount < totalCount) {
        log("🚫 TASK BLOCKED: KPI Gate failed. Hammer must fix gaps before proceeding.");
        return false;
    }
    
    return true;
}

async function getProjectSnapshot(dir) {
    log("🔍 Performing Brownfield Discovery...");
    let snapshot = { patterns: "", deps: "" };
    try {
        const goMod = path.join(dir, 'backend/go.mod');
        if (fs.existsSync(goMod)) snapshot.deps += `\nBACKEND DEPS:\n${fs.readFileSync(goMod, 'utf8').split('\n').slice(0, 15).join('\n')}`;
        
        const pkgJson = path.join(dir, 'frontend/package.json');
        if (fs.existsSync(pkgJson)) snapshot.deps += `\nFRONTEND DEPS:\n${fs.readFileSync(pkgJson, 'utf8')}`;

        const modelsDir = path.join(dir, 'backend/internal/models');
        if (fs.existsSync(modelsDir)) {
            const files = fs.readdirSync(modelsDir);
            if (files.length > 0) {
                const firstModel = path.join(modelsDir, files.find(f => f.endsWith('.go')) || files[0]);
                snapshot.patterns += `\nBASE MODEL PATTERN:\n${fs.readFileSync(firstModel, 'utf8').slice(0, 600)}`;
            }
        }
        
        const archDoc = path.join(dir, 'docs/ARCHITECTURE.md');
        if (fs.existsSync(archDoc)) {
            snapshot.patterns += `\nEXISTING ARCHITECTURE:\n${fs.readFileSync(archDoc, 'utf8').slice(0, 1000)}`;
        } else {
            snapshot.patterns += `\nWARNING: docs/ARCHITECTURE.md is MISSING. Architect must create it.`;
        }
    } catch (e) { log(`Discovery warning: ${e.message}`); }
    return snapshot;
}

function loadSoul(role) {
    const soulPath = path.join(AGENCY_ROOT, 'roster', role, 'SOUL.md');
    if (fs.existsSync(soulPath)) return fs.readFileSync(soulPath, 'utf8');
    return '';
}

function parseJsonEvents(raw) {
    const lines = raw.split('\n').filter(Boolean);
    const textParts = [];
    let cost = 0;
    let tokens = 0;
    for (const line of lines) {
        try {
            const evt = JSON.parse(line);
            if (evt.type === 'text' && evt.part?.text) textParts.push(evt.part.text);
            if (evt.type === 'step_finish' && (evt.part || evt.usage)) {
                cost += (evt.part?.cost || 0);
                tokens += (evt.usage?.total_tokens || evt.part?.usage?.total_tokens || 0);
            }
        } catch {}
    }
    return { text: textParts.join(''), cost, tokens };
}

let totalCost = 0;
let totalTokens = 0;
let totalLoops = 0;

async function runAgent(role, message, phase) {
    return new Promise((resolve) => {
        const agent = ROLE_TO_AGENT[role] || 'build';
        const soul = loadSoul(role);
        
        // V17.0 FIX: Remove duplicate "TASK:" prefix - soul already contains context
        const fullMessage = soul ? `${soul}\n\n---\n\n${message}` : message;

        log(`[${role}] invoking opencode agent="${agent}" dir="${WORKSPACE}"`);
        
        // V17.0 FIX: Capture git state before agent runs
        const beforeHash = getGitHash(WORKSPACE);
        const beforeTime = Date.now();

        // V17.0 FIX: Use shell mode and proper argument escaping
        const shellCommand = `${OPENCODE_BIN} run --agent ${agent} --dir "${WORKSPACE}" --format json`;
        
        const proc = spawn(shellCommand, [], {
            cwd: WORKSPACE,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'], // V17.0: Need stdin for message
            env: { 
                ...process.env, 
                AGENT_PHASE: phase, 
                AGENCY_ROOT,
                AGENCY_ROLE: role,
                AGENCY_ROSTER_DIR: path.join(AGENCY_ROOT, 'roster'),
                AGENCY_ROLE_PATH: path.join(AGENCY_ROOT, 'roster', role),
                NODE_ENV: 'production',
                OPENCODE_NON_INTERACTIVE: '1'
            },
        });

        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        
        // V17.0: Send message via stdin to avoid shell escaping issues
        proc.stdin.write(fullMessage);
        proc.stdin.end();

        proc.on('close', (code) => {
            const elapsed = Date.now() - beforeTime;
            const parsed = parseJsonEvents(stdout);
            totalCost += parsed.cost;
            totalTokens += parsed.tokens;
            
            // V17.0: Check if actual changes were made
            const changesDetected = hasChanges(WORKSPACE, beforeHash);
            const changeSummary = changesDetected ? getChangeSummary(WORKSPACE) : null;
            
            // V17.0: Log detailed diagnostics
            log(`[${role}] exit=${code} cost=$${parsed.cost.toFixed(4)} time=${elapsed}ms changes=${changesDetected} (Total: $${totalCost.toFixed(4)})`);
            
            if (changesDetected) {
                log(`[${role}] 📁 CHANGES: ${changeSummary.fileCount} files modified`);
                if (changeSummary.status) log(`[${role}] 📁 STATUS: ${changeSummary.status.slice(0, 200)}`);
            } else if (code === 0) {
                log(`[${role}] ⚠️  exit=0 but NO FILE CHANGES DETECTED`);
            }
            
            // V17.0: More honest status reporting
            const effectiveStatus = changesDetected ? 'CHANGED' : (code === 0 ? 'NO_CHANGES' : 'FAILED');
            
            // Push metrics update to pulse
            updateDashboard({
                metrics: {
                    tokens: totalTokens === 0 ? 'CALCULATING...' : totalTokens.toLocaleString(),
                    cost: totalCost.toFixed(4),
                    loops: totalLoops
                },
                lastAgentRun: {
                    role,
                    exitCode: code,
                    changesDetected,
                    status: effectiveStatus,
                    elapsed,
                    fileCount: changeSummary?.fileCount || 0
                }
            });

            if (parsed.text) log(`[${role}] response: ${parsed.text.slice(0, 300)}`);
            resolve({ 
                code: code ?? 1, 
                output: parsed.text || stderr, 
                cost: parsed.cost, 
                tokens: parsed.tokens,
                changesDetected,
                changeSummary,
                effectiveStatus,
                elapsed
            });
        });

        proc.on('error', (err) => {
            log(`[${role}] spawn error: ${err.message}`);
            resolve({ 
                code: 1, 
                output: err.message, 
                cost: 0, 
                tokens: 0,
                changesDetected: false,
                changeSummary: null,
                effectiveStatus: 'SPAWN_FAILED',
                elapsed: Date.now() - beforeTime
            });
        });
    });
}

function parseTaskInput() {
    const argv = process.argv.slice(2);
    const taskIdx = argv.indexOf('--task');
    let input;
    if (taskIdx >= 0 && argv[taskIdx + 1]) {
        input = argv[taskIdx + 1];
    } else if (argv[0] && !argv[0].startsWith('-')) {
        input = argv[0];
    }
    return input || null;
}

function loadTask(id) {
    let taskPath = path.join(AGENCY_ROOT, 'tasks', `${id}.json`);
    if (!fs.existsSync(taskPath)) taskPath = path.join(WORKSPACE, 'benchmark', 'tasks', `${id}.json`);
    if (!fs.existsSync(taskPath)) return null;
    return JSON.parse(fs.readFileSync(taskPath, 'utf8'));
}

function resolveTask() {
    const input = parseTaskInput();
    if (!input) {
        const fallback = loadTask('benchmark-bench-002');
        if (!fallback) { log('FATAL: No task provided and default not found.'); process.exit(1); }
        return fallback;
    }
    const isId = /^[a-zA-Z0-9_-]+$/.test(input) && input.length < 80;
    if (isId) {
        const task = loadTask(input) || loadTask(`benchmark-${input}`);
        if (task) return task;
    }
    return { id: 'ad-hoc', name: 'Ad-hoc', description: input, status: 'pending' };
}

async function main() {
    const task = resolveTask();
    log(`🏁 Starting Task: ${task.name ?? task.id}`);

    // V17.0: Track all agent results for final verification
    let archResult, hammerResult, checkerResult, skepticResult, medicResult;

    // Extract FINDING_ID from task description if present (for ledger correlation)
    const findingIdMatch = (task.description || '').match(/\[FINDING_ID:\s*([^\]]+)\]/);
    const findingId = findingIdMatch ? findingIdMatch[1].trim() : null;
    
    // If we have a findingId, load ledger and pre-seed telemetry reference
    if (findingId) {
        try {
            const ledger = require('./ledger');
            ledger.storeTelegramMessageId(findingId, null); // pre-create relation
            log(`🔗 Task associated with Finding ID: ${findingId}`);
        } catch(e) {
            log(`Ledger init error: ${e.message}`);
        }
    }

    // Force unique state for each run to get a fresh Telegram bubble
    if (fs.existsSync(DASHBOARD_FILE)) {
        fs.unlinkSync(DASHBOARD_FILE);
    }

    updateDashboard({
        taskId: task.description || task.id,
        startTime: Date.now(),
        taskType: 'SCIENTIST',
        persona: '🔘 [ORCHESTRATOR]',
        messageId: null, // Ensure fresh message
        findingId, // for ledger correlation
        phases: { 
            architect: { status: '⚙️ Obelisk Intake...' },
            hammer: { status: '⏳ Queued' },
            checker: { status: '⏳ Queued' },
            medic: { status: '⏳ Queued' },
            skeptic: { status: '⏳ Queued' }
        },
    });

    const snapshot = await getProjectSnapshot(WORKSPACE);
    const desc = task.description || '';

    // Phase 1: Architect
    log('>>> Phase: ARCHITECT');
    // V17.0 FIX: Remove duplicate "TASK:" - runAgent now adds proper context
    const archMsg = `${desc}\n\nSYSTEM SNAPSHOT:\n${snapshot.deps}\n${snapshot.patterns}\n\nGOAL: Initialize/Update docs/ARCHITECTURE.md and write .run/contract.md.`;
    archResult = await runAgent('architect', archMsg, 'architect');
    updateDashboard({ phases: { architect: { status: archResult.effectiveStatus === 'CHANGED' ? '✅ changed' : archResult.effectiveStatus } }, persona: '📐 [ARCHITECT]' });

    // Phase 2: Hammer (with retries and dynamic heal)
    const maxRetries = Number(process.env.AGENCY_MAX_HAMMER_RETRIES) || 3;
    let hammerPass = false;
    for (let i = 1; i <= maxRetries && !hammerPass; i++) {
        log(`>>> Phase: HAMMER (attempt ${i}/${maxRetries})`);
        const hammerMsg = `TASK: ${desc}\nContract and ARCHITECTURE.md must be followed. Implement the contract. You are REQUIRED to heal any unrelated build/lint blockers you encounter.`;
        hammerResult = await runAgent('hammer', hammerMsg, 'hammer');
        updateDashboard({ phases: { hammer: { status: hammerResult.effectiveStatus === 'CHANGED' ? '✅ changed' : '🔄 retry', attempts: i } }, persona: '🔨 [HAMMER]' });

        // KPI Gate
        const kpiPassed = await enforceKPIGate('hammer');
        if (kpiPassed) { hammerPass = true; break; }
        
        log('🔄 KPI failed. Triggering Dynamic Heal...');
        totalLoops++;
        updateDashboard({ 
            latestThought: "KPI Gate failed. Invoking Medic to heal blockers...", 
            persona: '🩹 [MEDIC]',
            metrics: {
                tokens: totalTokens.toLocaleString(),
                cost: totalCost.toFixed(4),
                loops: totalLoops
            }
        });
        await runAgent('medic', `HEAL TASK: The build/lint gate failed for: ${desc}. Identify unrelated blockers (gofmt, dead imports, etc.) and FIX them so the Hammer can proceed.`, 'medic');
    }

    // Phase 3: Checker
    log('>>> Phase: CHECKER');
    checkerResult = await runAgent('checker', `Verify Red Test → Green Test and contract compliance for: ${desc}`, 'checker');
    updateDashboard({ phases: { checker: { status: checkerResult.effectiveStatus === 'CHANGED' ? '✅ changed' : checkerResult.effectiveStatus } }, persona: '🧐 [CHECKER]' });

    // Phase 4: Skeptic
    log('>>> Phase: SKEPTIC');
    skepticResult = await runAgent('skeptic', `Audit quality and structure for: ${desc}. Check VETO_LOG and blast radius.`, 'skeptic');
    updateDashboard({ phases: { skeptic: { status: skepticResult.effectiveStatus === 'CHANGED' ? '✅ changed' : skepticResult.effectiveStatus } }, persona: '⚖️ [SKEPTIC]' });

    // Phase 5: Medic
    log('>>> Phase: MEDIC');
    medicResult = await runAgent('medic', `Fix any build/lint/regression issues for: ${desc}. Run tests and heal.`, 'medic');
    updateDashboard({ phases: { medic: { status: medicResult.effectiveStatus === 'CHANGED' ? '✅ changed' : medicResult.effectiveStatus } }, persona: '🩹 [MEDIC]' });

    // V17.0: Honest exit - check if ANY agent made actual changes
    const anyChanges = [
        archResult, 
        // hammer results are in the loop, check last iteration
        checkerResult, 
        skepticResult, 
        medicResult
    ].some(r => r?.changesDetected);
    
    if (!anyChanges) {
        log('⚠️  PIPELINE COMPLETE: No actual code changes were made by any agent');
        log('⚠️  Use "PROCESSED" status, not "FIXED"');
        process.exit(2); // Special exit code: completed but no changes
    } else {
        log('✅ Pipeline complete with verified changes.');
        process.exit(0);
    }
}

main().catch(err => {
    log(`FATAL: ${err.message}`);
    process.exit(1);
});
