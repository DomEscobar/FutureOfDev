const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const { updateDashboard } = require('./telemetry-dash.cjs');
const { classifyTask } = require('./classifier.cjs');
const core = require('./lib/orchestrator-core.cjs');

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

// KPI Gate and runCheck use core.loadProjectConfig, core.filterChecksByScope

function runCheck(check, workspaceDir) {
    return new Promise((resolve) => {
        const cwd = check.cwd ? path.join(workspaceDir, check.cwd) : workspaceDir;
        const proc = spawn(check.command, [], { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            const passed = code === 0;
            if (!passed) log(`❌ KPI FAIL: ${check.id} (exit ${code}): ${stderr.slice(0, 200)}`);
            else log(`✅ KPI PASS: ${check.id}`);
            resolve({ id: check.id, passed, stderr: stderr.slice(0, 500) });
        });
        proc.on('error', e => {
            log(`❌ KPI FAIL: ${check.id} (spawn error): ${e.message}`);
            resolve({ id: check.id, passed: false, stderr: (e.message || '').slice(0, 500) });
        });
    });
}

// KPI Gate: project config or skip (no hardcoded Go/Vue)
async function enforceKPIGate(role, scope) {
    if (process.env.BENCHMARK_MODE) {
        log("🔒 [KPI GATE] Benchmark mode – skipping.");
        return true;
    }
    if (role !== 'hammer') return true;

    const config = core.loadProjectConfig(WORKSPACE);
    if (!config) {
        log("🔒 [KPI GATE] No project config; gate skipped.");
        updateDashboard({ lastKpiGate: { role, results: {}, passRate: '0/0', skipped: true, timestamp: new Date().toISOString() } });
        return true;
    }

    log("🔒 [KPI GATE] Checking project Definition of Done...");
    const { definitionOfDone } = config;
    const checks = core.filterChecksByScope(definitionOfDone.checks, scope);

    const checkResults = checks.length > 0
        ? await Promise.all(checks.map(c => runCheck(c, WORKSPACE)))
        : [];

    const kpiResults = {};
    checkResults.forEach(r => { kpiResults[r.id] = r.passed; });

    const requiredArtifacts = (definitionOfDone.artifacts || []).filter(a => !a.optional);
    const optionalArtifacts = (definitionOfDone.artifacts || []).filter(a => a.optional);
    for (const a of requiredArtifacts) {
        const matches = simpleGlob(a.path, WORKSPACE);
        kpiResults[`artifact:${a.path}`] = matches.length > 0;
        if (matches.length === 0) log(`❌ KPI FAIL: Missing artifact ${a.path}`);
        else log(`✅ KPI PASS: Found ${a.path}`);
    }
    for (const a of optionalArtifacts) {
        kpiResults[`artifact:${a.path}`] = true;
    }

    const checkPassCount = checkResults.filter(r => r.passed).length;
    const allChecksPass = checkResults.length === 0 || checkPassCount === checkResults.length;
    const allRequiredArtifactsPass = requiredArtifacts.every(ar => kpiResults[`artifact:${ar.path}`] !== false);

    let passed = false;
    if (definitionOfDone.gate === 'all') {
        passed = allChecksPass && allRequiredArtifactsPass;
    } else if (definitionOfDone.gate === 'any') {
        passed = checkPassCount >= 1 && allRequiredArtifactsPass;
    } else {
        passed = allRequiredArtifactsPass;
    }

    const totalCount = Object.keys(kpiResults).length;
    const passCount = Object.values(kpiResults).filter(Boolean).length;
    log(`🔒 [KPI GATE] Result: ${passCount}/${totalCount} (gate=${definitionOfDone.gate})`);

    updateDashboard({
        lastKpiGate: {
            role,
            results: kpiResults,
            passRate: `${passCount}/${totalCount}`,
            timestamp: new Date().toISOString()
        }
    });

    if (!passed) {
        log("🚫 TASK BLOCKED: KPI Gate failed.");
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

async function runAgent(role, message, phase, options = {}) {
    return new Promise((resolve) => {
        const agent = ROLE_TO_AGENT[role] || 'build';
        const soul = loadSoul(role);

        const projectConfigPath = options.projectConfigPath || '';
        let fullMessage = soul ? `${soul}\n\n---\n\n${message}` : message;
        if (projectConfigPath) {
            fullMessage += `\n\nSatisfy project DOD; see AGENCY_PROJECT_DOD_PATH.`;
        }

        log(`[${role}] invoking opencode agent="${agent}" dir="${WORKSPACE}"`);

        const beforeHash = getGitHash(WORKSPACE);
        const beforeTime = Date.now();

        const shellCommand = `${OPENCODE_BIN} run --agent ${agent} --dir "${WORKSPACE}" --format json`;

        const proc = spawn(shellCommand, [], {
            cwd: WORKSPACE,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                AGENT_PHASE: phase,
                AGENCY_ROOT,
                AGENCY_ROLE: role,
                AGENCY_ROSTER_DIR: path.join(AGENCY_ROOT, 'roster'),
                AGENCY_ROLE_PATH: path.join(AGENCY_ROOT, 'roster', role),
                AGENCY_PROJECT_DOD_PATH: projectConfigPath,
                AGENT_TASK_TYPE: options.taskType || '',
                AGENT_SCOPE: options.scope || '',
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

function loadTask(id) {
    let taskPath = path.join(AGENCY_ROOT, 'tasks', `${id}.json`);
    if (!fs.existsSync(taskPath)) taskPath = path.join(WORKSPACE, 'benchmark', 'tasks', `${id}.json`);
    if (!fs.existsSync(taskPath)) return null;
    return JSON.parse(fs.readFileSync(taskPath, 'utf8'));
}

function resolveTask() {
    const task = core.resolveTask(process.argv.slice(2), process.env, loadTask);
    if (!task) {
        log('FATAL: No task provided and default not found.');
        process.exit(1);
    }
    return task;
}

async function main() {
    const task = resolveTask();
    log(`🏁 Starting Task: ${task.name ?? task.id}`);

    let archResult, hammerResult, checkerResult, skepticResult, medicResult;

    const findingIdMatch = (task.description || '').match(/\[FINDING_ID:\s*([^\]]+)\]/);
    const findingId = findingIdMatch ? findingIdMatch[1].trim() : null;

    if (findingId) {
        try {
            const ledger = require('./ledger');
            ledger.storeTelegramMessageId(findingId, null);
            log(`🔗 Task associated with Finding ID: ${findingId}`);
        } catch (e) {
            log(`Ledger init error: ${e.message}`);
        }
    }

    const config = core.loadProjectConfig(WORKSPACE);
    let taskType = task.taskType;
    let scope = task.scope;
    if (taskType == null || scope == null) {
        const classified = await classifyTask(task);
        taskType = task.taskType = classified.taskType;
        scope = task.scope = classified.scope;
        log(`Classified: ${taskType} | ${scope}`);
    }

    const projectConfigPath = config && fs.existsSync(path.join(WORKSPACE, '.opencode', 'agency.json'))
        ? path.join(WORKSPACE, '.opencode', 'agency.json')
        : '';
    const agentOpts = { taskType, scope, projectConfigPath };

    if (fs.existsSync(DASHBOARD_FILE)) {
        fs.unlinkSync(DASHBOARD_FILE);
    }

    updateDashboard({
        taskId: task.description || task.id,
        startTime: Date.now(),
        taskType,
        scope,
        persona: '🔘 [ORCHESTRATOR]',
        messageId: null,
        findingId,
        phases: {
            architect: { status: '⚙️ Obelisk Intake...' },
            hammer: { status: '⏳ Queued' },
            checker: { status: '⏳ Queued' },
            medic: { status: '⏳ Queued' },
            skeptic: { status: '⏳ Queued' }
        },
    });

    const desc = task.description || '';

    if (taskType === 'EXPLORE' && (config?.taskPolicies?.EXPLORE?.skipAgencyByDefault || process.env.AGENCY_SKIP_EXPLORE === '1')) {
        log('Not routed to agency (EXPLORE).');
        updateDashboard({ latestThought: 'Skipped: EXPLORE (skipAgencyByDefault)' });
        process.exit(2);
    }

    if (taskType === 'VERIFY') {
        const snapshot = await getProjectSnapshot(WORKSPACE);
        log('>>> Phase: CHECKER (VERIFY path)');
        checkerResult = await runAgent('checker', `VERIFY (no code changes): ${desc}\n\nVerify the requirement is met. Do not make edits.`, 'checker', agentOpts);
        updateDashboard({ phases: { checker: { status: checkerResult.effectiveStatus === 'CHANGED' ? '✅ changed' : checkerResult.effectiveStatus } }, persona: '🧐 [CHECKER]' });
        log('>>> Phase: SKEPTIC (VERIFY path)');
        skepticResult = await runAgent('skeptic', `VERIFY (audit only): ${desc}. Confirm requirement without making changes.`, 'skeptic', agentOpts);
        updateDashboard({ phases: { skeptic: { status: skepticResult.effectiveStatus === 'CHANGED' ? '✅ changed' : skepticResult.effectiveStatus } }, persona: '⚖️ [SKEPTIC]' });
        const checkRes = core.readAgentResult(WORKSPACE, 'checker');
        const skeptRes = core.readAgentResult(WORKSPACE, 'skeptic');
        if (checkRes && checkRes.outcome === 'BLOCKED') {
            updateDashboard({ blockedReason: checkRes.reason || 'Checker BLOCKED' });
            process.exit(3);
        }
        if (skeptRes && skeptRes.outcome === 'BLOCKED') {
            updateDashboard({ blockedReason: skeptRes.reason || 'Skeptic BLOCKED' });
            process.exit(3);
        }
        log('✅ VERIFY path complete.');
        process.exit(0);
    }

    const snapshot = await getProjectSnapshot(WORKSPACE);

    if (taskType === 'DOC') {
        log('>>> Phase: ARCHITECT (DOC path)');
        archResult = await runAgent('architect', `${desc}\n\nSYSTEM SNAPSHOT:\n${snapshot.deps}\n${snapshot.patterns}\n\nGOAL: Update docs only if needed. Write .run/contract.md if relevant.`, 'architect', agentOpts);
        updateDashboard({ phases: { architect: { status: archResult.effectiveStatus === 'CHANGED' ? '✅ changed' : archResult.effectiveStatus } }, persona: '📐 [ARCHITECT]' });
        log('>>> Phase: HAMMER (doc-only)');
        hammerResult = await runAgent('hammer', `DOC-ONLY: ${desc}\n\nOnly update documentation. Do not change code. Contract and ARCHITECTURE.md apply.`, 'hammer', agentOpts);
        updateDashboard({ phases: { hammer: { status: hammerResult.effectiveStatus === 'CHANGED' ? '✅ changed' : hammerResult.effectiveStatus } }, persona: '🔨 [HAMMER]' });
        const kpiPassed = await enforceKPIGate('hammer', 'doc_only');
        if (!kpiPassed) {
            log('🔄 KPI failed on DOC path.');
        }
        log('>>> Phase: CHECKER + SKEPTIC');
        checkerResult = await runAgent('checker', `Verify doc and contract for: ${desc}`, 'checker', agentOpts);
        skepticResult = await runAgent('skeptic', `Audit doc quality for: ${desc}`, 'skeptic', agentOpts);
        updateDashboard({ phases: { checker: { status: checkerResult.effectiveStatus === 'CHANGED' ? '✅ changed' : checkerResult.effectiveStatus } }, persona: '🧐 [CHECKER]' });
        updateDashboard({ phases: { skeptic: { status: skepticResult.effectiveStatus === 'CHANGED' ? '✅ changed' : skepticResult.effectiveStatus } }, persona: '⚖️ [SKEPTIC]' });
        const docCheckRes = core.readAgentResult(WORKSPACE, 'checker');
        const docSkeptRes = core.readAgentResult(WORKSPACE, 'skeptic');
        if (docCheckRes && docCheckRes.outcome === 'BLOCKED') {
            updateDashboard({ blockedReason: docCheckRes.reason || 'Checker BLOCKED' });
            process.exit(3);
        }
        if (docSkeptRes && docSkeptRes.outcome === 'BLOCKED') {
            updateDashboard({ blockedReason: docSkeptRes.reason || 'Skeptic BLOCKED' });
            process.exit(3);
        }
        log('>>> Phase: MEDIC');
        medicResult = await runAgent('medic', `Fix any doc/lint issues for: ${desc}`, 'medic', agentOpts);
        updateDashboard({ phases: { medic: { status: medicResult.effectiveStatus === 'CHANGED' ? '✅ changed' : medicResult.effectiveStatus } }, persona: '🩹 [MEDIC]' });
        const docMedicRes = core.readAgentResult(WORKSPACE, 'medic');
        if (docMedicRes && docMedicRes.outcome === 'BLOCKED') {
            updateDashboard({ blockedReason: docMedicRes.reason || 'Medic BLOCKED' });
            process.exit(3);
        }
        const anyChanges = [archResult, hammerResult, checkerResult, skepticResult, medicResult].some(r => r?.changesDetected);
        process.exit(anyChanges ? 0 : 2);
    }

    log('>>> Phase: ARCHITECT');
    const archMsg = `${desc}\n\nSYSTEM SNAPSHOT:\n${snapshot.deps}\n${snapshot.patterns}\n\nGOAL: Initialize/Update docs/ARCHITECTURE.md and write .run/contract.md.`;
    archResult = await runAgent('architect', archMsg, 'architect', agentOpts);
    updateDashboard({ phases: { architect: { status: archResult.effectiveStatus === 'CHANGED' ? '✅ changed' : archResult.effectiveStatus } }, persona: '📐 [ARCHITECT]' });

    const scientistLine = taskType === 'FIX' ? '\n\nYou are in SCIENTIST MODE: produce DEBUG_HYPOTHESIS and Red Test before any fix.' : '';
    const maxRetries = Number(process.env.AGENCY_MAX_HAMMER_RETRIES) || 3;
    let hammerPass = false;
    let noProgressCount = 0;
    for (let i = 1; i <= maxRetries && !hammerPass; i++) {
        const beforeHash = getGitHash(WORKSPACE);
        log(`>>> Phase: HAMMER (attempt ${i}/${maxRetries})`);
        const hammerMsg = `TASK: ${desc}\nContract and ARCHITECTURE.md must be followed. Implement the contract. You are REQUIRED to heal any unrelated build/lint blockers you encounter.${scientistLine}`;
        hammerResult = await runAgent('hammer', hammerMsg, 'hammer', agentOpts);
        updateDashboard({ phases: { hammer: { status: hammerResult.effectiveStatus === 'CHANGED' ? '✅ changed' : '🔄 retry', attempts: i } }, persona: '🔨 [HAMMER]' });

        const kpiPassed = await enforceKPIGate('hammer', scope);
        if (kpiPassed) { hammerPass = true; break; }

        log('🔄 KPI failed. Triggering Dynamic Heal...');
        totalLoops++;
        updateDashboard({
            latestThought: "KPI Gate failed. Invoking Medic to heal blockers...",
            persona: '🩹 [MEDIC]',
            metrics: { tokens: totalTokens.toLocaleString(), cost: totalCost.toFixed(4), loops: totalLoops }
        });
        await runAgent('medic', `HEAL TASK: The build/lint gate failed for: ${desc}. Identify unrelated blockers and FIX them so the Hammer can proceed.`, 'medic', agentOpts);
        if (!hasChanges(WORKSPACE, beforeHash)) {
            noProgressCount++;
            if (noProgressCount > 2) {
                const blockedReason = 'No progress after retries';
                updateDashboard({ blockedReason, latestThought: blockedReason });
                log(`🚫 BLOCKED: ${blockedReason}`);
                process.exit(3);
            }
        } else {
            noProgressCount = 0;
        }
    }

    log('>>> Phase: CHECKER + SKEPTIC (parallel)');
    const [checkerOut, skepticOut] = await Promise.all([
        runAgent('checker', `Verify Red Test → Green Test and contract compliance for: ${desc}`, 'checker', agentOpts),
        runAgent('skeptic', `Audit quality and structure for: ${desc}. Check VETO_LOG and blast radius.`, 'skeptic', agentOpts)
    ]);
    checkerResult = checkerOut;
    skepticResult = skepticOut;
    updateDashboard({ phases: { checker: { status: checkerResult.effectiveStatus === 'CHANGED' ? '✅ changed' : checkerResult.effectiveStatus } }, persona: '🧐 [CHECKER]' });
    updateDashboard({ phases: { skeptic: { status: skepticResult.effectiveStatus === 'CHANGED' ? '✅ changed' : skepticResult.effectiveStatus } }, persona: '⚖️ [SKEPTIC]' });

    let checkerRes = core.readAgentResult(WORKSPACE, 'checker');
    let skepticRes = core.readAgentResult(WORKSPACE, 'skeptic');
    if (checkerRes && checkerRes.outcome === 'BLOCKED') {
        const blockedReason = checkerRes.reason || 'Checker BLOCKED';
        updateDashboard({ blockedReason, latestThought: blockedReason });
        log(`🚫 BLOCKED: ${blockedReason}`);
        process.exit(3);
    }
    if (skepticRes && skepticRes.outcome === 'BLOCKED') {
        const blockedReason = skepticRes.reason || 'Skeptic BLOCKED';
        updateDashboard({ blockedReason, latestThought: blockedReason });
        log(`🚫 BLOCKED: ${blockedReason}`);
        process.exit(3);
    }
    if (skepticRes && skepticRes.outcome === 'REJECT') {
        log('>>> Skeptic REJECT: one Hammer retry with feedback');
        const retryMsg = `TASK: ${desc}\nSkeptic REJECTED previous implementation. Reason: ${skepticRes.reason || 'See skeptic feedback'}\n\nAddress the feedback and ensure contract and quality.${scientistLine}`;
        hammerResult = await runAgent('hammer', retryMsg, 'hammer', agentOpts);
        updateDashboard({ phases: { hammer: { status: hammerResult.effectiveStatus === 'CHANGED' ? '✅ retry done' : '🔄 retry' } }, persona: '🔨 [HAMMER]' });
        const kpiRetryPassed = await enforceKPIGate('hammer', scope);
        if (!kpiRetryPassed) {
            const blockedReason = skepticRes.reason ? `KPI still failing after Skeptic retry: ${skepticRes.reason}` : 'KPI still failing after Skeptic retry';
            updateDashboard({ blockedReason });
            process.exit(3);
        }
        const [checkerOut2, skepticOut2] = await Promise.all([
            runAgent('checker', `Verify Red Test → Green Test and contract compliance for: ${desc}`, 'checker', agentOpts),
            runAgent('skeptic', `Audit quality and structure for: ${desc}. Check VETO_LOG and blast radius.`, 'skeptic', agentOpts)
        ]);
        checkerResult = checkerOut2;
        skepticResult = skepticOut2;
        checkerRes = core.readAgentResult(WORKSPACE, 'checker');
        skepticRes = core.readAgentResult(WORKSPACE, 'skeptic');
        if ((checkerRes && checkerRes.outcome === 'BLOCKED') || (skepticRes && (skepticRes.outcome === 'BLOCKED' || skepticRes.outcome === 'REJECT'))) {
            const blockedReason = (checkerRes && checkerRes.outcome === 'BLOCKED' ? checkerRes.reason : skepticRes?.reason) || 'Checker/Skeptic still BLOCKED or REJECT after retry';
            updateDashboard({ blockedReason });
            process.exit(3);
        }
    }

    log('>>> Phase: MEDIC');
    medicResult = await runAgent('medic', `Fix any build/lint/regression issues for: ${desc}. Run tests and heal.`, 'medic', agentOpts);
    updateDashboard({ phases: { medic: { status: medicResult.effectiveStatus === 'CHANGED' ? '✅ changed' : medicResult.effectiveStatus } }, persona: '🩹 [MEDIC]' });

    const medicRes = core.readAgentResult(WORKSPACE, 'medic');
    if (medicRes && medicRes.outcome === 'BLOCKED') {
        const blockedReason = medicRes.reason || 'Medic BLOCKED';
        updateDashboard({ blockedReason, latestThought: blockedReason });
        log(`🚫 BLOCKED: ${blockedReason}`);
        process.exit(3);
    }

    const anyChanges = [archResult, hammerResult, checkerResult, skepticResult, medicResult].some(r => r?.changesDetected);
    if (!anyChanges) {
        log('⚠️  PIPELINE COMPLETE: No actual code changes were made by any agent');
        process.exit(2);
    }
    log('✅ Pipeline complete with verified changes.');
    process.exit(0);
}

main().catch(err => {
    log(`FATAL: ${err.message}`);
    process.exit(1);
});
