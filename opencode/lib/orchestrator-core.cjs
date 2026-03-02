/**
 * Orchestrator core — pure/sync logic for config, task resolution, result files.
 * Used by orchestrator.cjs and by test/orchestrator-core.test.cjs.
 */

const fs = require('fs');
const path = require('path');

function loadProjectConfig(workspaceDir) {
    const configPath = path.join(workspaceDir, '.opencode', 'agency.json');
    if (!fs.existsSync(configPath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const dod = raw.definitionOfDone;
        if (!dod || !Array.isArray(dod.checks)) return null;
        const gate = dod.gate === 'any' || dod.gate === 'none' ? dod.gate : 'all';
        return {
            definitionOfDone: {
                artifacts: Array.isArray(dod.artifacts) ? dod.artifacts : [],
                checks: dod.checks,
                gate
            },
            taskPolicies: raw.taskPolicies || {}
        };
    } catch (_) {
        return null;
    }
}

function filterChecksByScope(checks, scope) {
    if (!scope || scope === 'full' || scope === 'unknown') return checks;
    return checks.filter(c => {
        const cwd = (c.cwd || '').toLowerCase();
        const id = (c.id || '').toLowerCase();
        const checkScope = (c.scope || '').toLowerCase();
        if (scope === 'frontend_only') return cwd.includes('frontend') || id.includes('frontend') || checkScope === 'frontend';
        if (scope === 'backend_only') return cwd.includes('backend') || id.includes('backend') || checkScope === 'backend';
        if (scope === 'doc_only') return checkScope === 'doc' || id.includes('doc');
        return true;
    });
}

function readAgentResult(workspaceDir, role) {
    const resultPath = path.join(workspaceDir, '.run', `${role}_result.json`);
    if (!fs.existsSync(resultPath)) return null;
    try {
        const raw = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        const outcome = raw.outcome;
        if (outcome === 'APPROVE' || outcome === 'REJECT' || outcome === 'BLOCKED') {
            return { outcome, reason: raw.reason || '', nextStep: raw.nextStep || '' };
        }
        return null;
    } catch (_) {
        return null;
    }
}

function parseTaskInput(argv) {
    const taskIdx = argv.indexOf('--task');
    let input;
    if (taskIdx >= 0 && argv[taskIdx + 1]) {
        input = argv[taskIdx + 1];
    } else if (argv[0] && !argv[0].startsWith('-')) {
        input = argv[0];
    }
    return input || null;
}

function resolveTask(argv, env, loadTask) {
    const taskJson = env.AGENCY_TASK_JSON;
    if (taskJson) {
        try {
            const task = JSON.parse(taskJson);
            if (task && (task.description != null || task.id != null)) return task;
        } catch (_) {}
    }
    const input = parseTaskInput(argv);
    if (!input) {
        const fallback = loadTask('benchmark-bench-002');
        return fallback;
    }
    const isId = /^[a-zA-Z0-9_-]+$/.test(input) && input.length < 80;
    if (isId) {
        const task = loadTask(input) || loadTask(`benchmark-${input}`);
        if (task) return task;
    }
    return { id: 'ad-hoc', name: 'Ad-hoc', description: input, status: 'pending' };
}

module.exports = {
    loadProjectConfig,
    filterChecksByScope,
    readAgentResult,
    parseTaskInput,
    resolveTask
};
