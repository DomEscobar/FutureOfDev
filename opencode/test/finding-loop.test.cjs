const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const { parseNewFindings, buildPerfectTask } = require('../player-finding-watcher.cjs');

const OPCODE_ROOT = path.resolve(__dirname, '..');
const STUB_AGENCY_HOME = path.join(__dirname, 'fixtures', 'agency-home-stub');
const RECEIVED_FILE = path.join(__dirname, 'fixtures', 'orchestrator-received.json');

describe('finding loop', () => {
    describe('parseNewFindings', () => {
        it('parses Category and Severity from a block', () => {
            const content = `
## [2025-03-02T12:00:00.000Z] Failed Goal: login

**Category:** GOAL_FAILURE
**Severity:** HIGH
**Page:** http://localhost:5173/login

### Issue
Goal "login" not achieved.

---
`;
            const findings = parseNewFindings(content);
            assert.strictEqual(findings.length, 1);
            assert.strictEqual(findings[0].title, 'Failed Goal: login');
            assert.strictEqual(findings[0].category, 'GOAL_FAILURE');
            assert.strictEqual(findings[0].severity, 'HIGH');
        });

        it('defaults category to UNKNOWN when missing', () => {
            const content = `
## [2025-03-02T12:00:00.000Z] Some finding

**Severity:** MEDIUM

---
`;
            const findings = parseNewFindings(content);
            assert.strictEqual(findings.length, 1);
            assert.strictEqual(findings[0].category, 'UNKNOWN');
        });

        it('parses Type as fallback for Category', () => {
            const content = `
## [2025-03-02T12:00:00.000Z] Console errors

**Type:** CONSOLE_ERROR

---
`;
            const findings = parseNewFindings(content);
            assert.strictEqual(findings.length, 1);
            assert.strictEqual(findings[0].category, 'CONSOLE_ERROR');
        });
    });

    describe('buildPerfectTask', () => {
        it('returns name, description with FINDING_ID, and expected_behavior', () => {
            const block = `## [2025-03-02] Failed Goal: register

**Category:** GOAL_FAILURE
**Severity:** MEDIUM

### Recommendation
Fix the registration flow so the form submits.

---
`;
            const out = buildPerfectTask('FND-ABC', 'Failed Goal: register', 'GOAL_FAILURE', 'MEDIUM', block);
            assert.strictEqual(typeof out.name, 'string');
            assert.ok(out.name.length > 0);
            assert.ok(out.description.includes('[FINDING_ID: FND-ABC]'));
            assert.ok(out.description.includes('Goal failed'));
            assert.ok(out.expected_behavior.includes('registration') || out.expected_behavior.includes('Fix'));
        });

        it('uses Issue when Recommendation is missing', () => {
            const block = `## [2025-03-02] Bug

**Category:** GOAL_FAILURE

### Issue
Stuck on form after 3 replans.

---
`;
            const out = buildPerfectTask('FND-X', 'Bug', 'GOAL_FAILURE', null, block);
            assert.ok(out.expected_behavior.includes('Stuck') || out.expected_behavior.includes('Resolve'));
        });

        it('prefixes description for CONSOLE_ERROR', () => {
            const out = buildPerfectTask('FND-1', 'Console errors', 'CONSOLE_ERROR', 'HIGH', '## block');
            assert.ok(out.description.includes('Console errors detected'));
        });
    });

    describe('handoff agency -> orchestrator', () => {
        it('preserves taskType, scope, name, expected_behavior in AGENCY_TASK_JSON', async () => {
            const taskPayload = {
                id: 'finding',
                findingId: 'FND-HANDOFF',
                name: 'Test task name',
                description: '[FINDING_ID: FND-HANDOFF]\n\nFix the bug',
                expected_behavior: 'Fix the bug and verify',
                taskType: 'FIX',
                scope: 'full'
            };
            const env = {
                ...process.env,
                AGENCY_HOME: STUB_AGENCY_HOME,
                ORCHESTRATOR_RECEIVED_FILE: RECEIVED_FILE,
                AGENCY_TASK_JSON: JSON.stringify(taskPayload)
            };
            const input = '[FINDING_ID: FND-HANDOFF]\n\nFix the bug';
            const child = spawn('node', [path.join(OPCODE_ROOT, 'agency.js'), 'run', input], {
                cwd: OPCODE_ROOT,
                env,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            const exitCode = await new Promise((resolve) => child.on('close', resolve));
            assert.strictEqual(exitCode, 0);
            assert.ok(fs.existsSync(RECEIVED_FILE));
            const received = JSON.parse(fs.readFileSync(RECEIVED_FILE, 'utf8'));
            assert.strictEqual(received.taskType, 'FIX');
            assert.strictEqual(received.scope, 'full');
            assert.strictEqual(received.name, 'Test task name');
            assert.strictEqual(received.expected_behavior, 'Fix the bug and verify');
            assert.strictEqual(received.findingId, 'FND-HANDOFF');
            try { fs.unlinkSync(RECEIVED_FILE); } catch (_) {}
        });
    });
});
