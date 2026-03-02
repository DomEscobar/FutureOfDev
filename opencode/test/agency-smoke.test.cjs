const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const OPENCODE_DIR = path.join(__dirname, '..');
const WORKSPACE_NO_DOD = path.join(__dirname, 'fixtures', 'workspace-no-dod');

describe('agency smoke', () => {
    it('orchestrator exits 2 when EXPLORE and AGENCY_SKIP_EXPLORE=1', () => {
        const task = {
            id: 'explore-smoke',
            description: 'explore',
            taskType: 'EXPLORE',
            scope: 'full'
        };
        const result = spawnSync('node', ['orchestrator.cjs'], {
            cwd: OPENCODE_DIR,
            env: {
                ...process.env,
                WORKSPACE: WORKSPACE_NO_DOD,
                AGENCY_TASK_JSON: JSON.stringify(task),
                AGENCY_SKIP_EXPLORE: '1'
            },
            encoding: 'utf8',
            timeout: 15000
        });
        assert.strictEqual(result.status, 2, `Expected exit 2, got ${result.status}. stderr: ${result.stderr?.slice(0, 500)}`);
    });

    it('orchestrator exits 1 when no task and no default task found', () => {
        const result = spawnSync('node', ['orchestrator.cjs'], {
            cwd: OPENCODE_DIR,
            env: {
                ...process.env,
                WORKSPACE: WORKSPACE_NO_DOD,
                AGENCY_HOME: WORKSPACE_NO_DOD
            },
            encoding: 'utf8',
            timeout: 10000
        });
        assert.strictEqual(result.status, 1, `Expected exit 1, got ${result.status}. stderr: ${result.stderr?.slice(0, 500)}`);
    });
});
