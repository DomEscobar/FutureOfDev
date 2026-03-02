const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const core = require('../lib/orchestrator-core.cjs');

const FIXTURES = path.join(__dirname, 'fixtures');
const WORKSPACE_WITH_DOD = path.join(FIXTURES, 'workspace-with-dod');
const WORKSPACE_NO_DOD = path.join(FIXTURES, 'workspace-no-dod');
const WORKSPACE_INVALID_DOD = path.join(FIXTURES, 'workspace-invalid-dod');
const WORKSPACE_WITH_RESULTS = path.join(FIXTURES, 'workspace-with-results');
const WORKSPACE_MALFORMED_DOD = path.join(FIXTURES, 'workspace-malformed-dod');
const WORKSPACE_GATE_ANY = path.join(FIXTURES, 'workspace-gate-any');
const WORKSPACE_GATE_NONE = path.join(FIXTURES, 'workspace-gate-none');
const WORKSPACE_MALFORMED_RESULT = path.join(FIXTURES, 'workspace-malformed-result');
const WORKSPACE_UNKNOWN_OUTCOME = path.join(FIXTURES, 'workspace-unknown-outcome');

describe('loadProjectConfig', () => {
    it('returns config when .opencode/agency.json exists with valid definitionOfDone', () => {
        const config = core.loadProjectConfig(WORKSPACE_WITH_DOD);
        assert.ok(config);
        assert.ok(config.definitionOfDone);
        assert.strictEqual(config.definitionOfDone.checks.length, 1);
        assert.strictEqual(config.definitionOfDone.checks[0].id, 'lint');
        assert.strictEqual(config.definitionOfDone.gate, 'all');
        assert.ok(config.taskPolicies);
        assert.ok(config.taskPolicies.EXPLORE);
    });

    it('returns null when .opencode does not exist', () => {
        const config = core.loadProjectConfig(WORKSPACE_NO_DOD);
        assert.strictEqual(config, null);
    });

    it('returns null when definitionOfDone.checks is missing', () => {
        const config = core.loadProjectConfig(WORKSPACE_INVALID_DOD);
        assert.strictEqual(config, null);
    });

    it('returns null when agency.json is malformed JSON', () => {
        const config = core.loadProjectConfig(WORKSPACE_MALFORMED_DOD);
        assert.strictEqual(config, null);
    });

    it('returns config with gate "any" when definitionOfDone.gate is any', () => {
        const config = core.loadProjectConfig(WORKSPACE_GATE_ANY);
        assert.ok(config);
        assert.strictEqual(config.definitionOfDone.gate, 'any');
    });

    it('returns config with gate "none" when definitionOfDone.gate is none', () => {
        const config = core.loadProjectConfig(WORKSPACE_GATE_NONE);
        assert.ok(config);
        assert.strictEqual(config.definitionOfDone.gate, 'none');
    });
});

describe('filterChecksByScope', () => {
    const checks = [
        { id: 'lint', cwd: 'backend', scope: 'backend' },
        { id: 'frontend-lint', cwd: 'frontend', scope: 'frontend' },
        { id: 'doc-check', scope: 'doc' }
    ];

    it('returns all checks for full or unknown scope', () => {
        assert.strictEqual(core.filterChecksByScope(checks, 'full').length, 3);
        assert.strictEqual(core.filterChecksByScope(checks, 'unknown').length, 3);
        assert.strictEqual(core.filterChecksByScope(checks, null).length, 3);
    });

    it('returns only backend checks for backend_only', () => {
        const out = core.filterChecksByScope(checks, 'backend_only');
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].id, 'lint');
    });

    it('returns only frontend checks for frontend_only', () => {
        const out = core.filterChecksByScope(checks, 'frontend_only');
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].id, 'frontend-lint');
    });

    it('returns only doc checks for doc_only', () => {
        const out = core.filterChecksByScope(checks, 'doc_only');
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].id, 'doc-check');
    });

    it('returns empty array for empty checks', () => {
        assert.deepStrictEqual(core.filterChecksByScope([], 'backend_only'), []);
    });

    it('handles checks with missing id or scope without throwing', () => {
        const sparse = [{ cwd: 'backend' }, { id: 'frontend-lint' }];
        const out = core.filterChecksByScope(sparse, 'frontend_only');
        assert.strictEqual(out.length, 1);
        assert.strictEqual(out[0].id, 'frontend-lint');
    });
});

describe('readAgentResult', () => {
    it('returns APPROVE for checker when file exists', () => {
        const res = core.readAgentResult(WORKSPACE_WITH_RESULTS, 'checker');
        assert.ok(res);
        assert.strictEqual(res.outcome, 'APPROVE');
    });

    it('returns BLOCKED with reason for skeptic', () => {
        const res = core.readAgentResult(WORKSPACE_WITH_RESULTS, 'skeptic');
        assert.ok(res);
        assert.strictEqual(res.outcome, 'BLOCKED');
        assert.strictEqual(res.reason, 'test');
    });

    it('returns null when file does not exist', () => {
        const res = core.readAgentResult(WORKSPACE_WITH_RESULTS, 'medic');
        assert.strictEqual(res, null);
    });

    it('returns null when result file exists but JSON is malformed', () => {
        const res = core.readAgentResult(WORKSPACE_MALFORMED_RESULT, 'checker');
        assert.strictEqual(res, null);
    });

    it('returns null when outcome is not APPROVE, REJECT, or BLOCKED', () => {
        const res = core.readAgentResult(WORKSPACE_UNKNOWN_OUTCOME, 'checker');
        assert.strictEqual(res, null);
    });
});

describe('parseTaskInput', () => {
    it('returns task id when --task <id>', () => {
        assert.strictEqual(core.parseTaskInput(['--task', 'bench-001']), 'bench-001');
    });

    it('returns first arg when non-flag', () => {
        assert.strictEqual(core.parseTaskInput(['some description']), 'some description');
    });

    it('returns null when empty argv', () => {
        assert.strictEqual(core.parseTaskInput([]), null);
    });

    it('returns null when only flags', () => {
        assert.strictEqual(core.parseTaskInput(['--task']), null);
    });

    it('returns null when first arg starts with -', () => {
        assert.strictEqual(core.parseTaskInput(['-x']), null);
        assert.strictEqual(core.parseTaskInput(['--unknown-flag', 'value']), null);
    });
});

describe('resolveTask', () => {
    it('returns parsed task when AGENCY_TASK_JSON is valid', () => {
        const env = { AGENCY_TASK_JSON: JSON.stringify({ id: 'finding', description: 'fix bug', taskType: 'FIX', scope: 'full' }) };
        const loadTask = () => null;
        const task = core.resolveTask([], env, loadTask);
        assert.ok(task);
        assert.strictEqual(task.description, 'fix bug');
        assert.strictEqual(task.taskType, 'FIX');
        assert.strictEqual(task.scope, 'full');
    });

    it('falls back to parseTaskInput when AGENCY_TASK_JSON is invalid', () => {
        const env = { AGENCY_TASK_JSON: 'not json' };
        const loadTask = (id) => (id === 'benchmark-bench-002' ? { id: 'benchmark-bench-002', name: 'Fallback' } : null);
        const task = core.resolveTask([], env, loadTask);
        assert.ok(task);
        assert.strictEqual(task.id, 'benchmark-bench-002');
    });

    it('returns loadTask result when argv is --task id and loadTask returns task', () => {
        const env = {};
        const loadTask = (id) => (id === 'x' ? { id: 'x', name: 'Task X', description: 'Do X' } : null);
        const task = core.resolveTask(['--task', 'x'], env, loadTask);
        assert.ok(task);
        assert.strictEqual(task.id, 'x');
    });

    it('returns ad-hoc task when argv is non-id string and loadTask returns null', () => {
        const env = {};
        const loadTask = () => null;
        const task = core.resolveTask(['ad-hoc string'], env, loadTask);
        assert.ok(task);
        assert.strictEqual(task.id, 'ad-hoc');
        assert.strictEqual(task.description, 'ad-hoc string');
    });

    it('returns task when AGENCY_TASK_JSON has only id (no description)', () => {
        const env = { AGENCY_TASK_JSON: JSON.stringify({ id: 'id-only' }) };
        const loadTask = () => null;
        const task = core.resolveTask([], env, loadTask);
        assert.ok(task);
        assert.strictEqual(task.id, 'id-only');
        assert.strictEqual(task.description, undefined);
    });

    it('returns loadTask(benchmark-<id>) when --task id and loadTask(id) is null', () => {
        const env = {};
        const benchTask = { id: 'benchmark-bench-001', name: 'Bench 001', description: 'Run bench 001' };
        const loadTask = (id) => (id === 'benchmark-bench-001' ? benchTask : null);
        const task = core.resolveTask(['--task', 'bench-001'], env, loadTask);
        assert.ok(task);
        assert.strictEqual(task.id, 'benchmark-bench-001');
    });
});
