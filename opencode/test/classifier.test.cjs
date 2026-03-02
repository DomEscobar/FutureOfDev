const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const { classifyTask, parseResult, TASK_TYPES, SCOPES } = require('../classifier.cjs');

describe('parseResult', () => {
    it('parses valid JSON and returns taskType and scope', () => {
        const out = parseResult('{"taskType":"FIX","scope":"backend_only"}');
        assert.strictEqual(out.taskType, 'FIX');
        assert.strictEqual(out.scope, 'backend_only');
    });

    it('falls back to UNKNOWN for invalid taskType', () => {
        const out = parseResult('{"taskType":"INVALID","scope":"full"}');
        assert.strictEqual(out.taskType, 'UNKNOWN');
        assert.strictEqual(out.scope, 'full');
    });

    it('falls back to full for invalid scope', () => {
        const out = parseResult('{"taskType":"DOC","scope":"invalid_scope"}');
        assert.strictEqual(out.taskType, 'DOC');
        assert.strictEqual(out.scope, 'full');
    });

    it('strips code fence and parses', () => {
        const out = parseResult('```json\n{"taskType":"DOC","scope":"doc_only"}\n```');
        assert.strictEqual(out.taskType, 'DOC');
        assert.strictEqual(out.scope, 'doc_only');
    });

    it('throws on invalid JSON', () => {
        assert.throws(() => parseResult('not json'), SyntaxError);
    });
});

describe('TASK_TYPES and SCOPES', () => {
    it('TASK_TYPES includes expected values', () => {
        assert.ok(TASK_TYPES.includes('FEATURE'));
        assert.ok(TASK_TYPES.includes('FIX'));
        assert.ok(TASK_TYPES.includes('EXPLORE'));
        assert.ok(TASK_TYPES.includes('UNKNOWN'));
    });

    it('SCOPES includes expected values', () => {
        assert.ok(SCOPES.includes('full'));
        assert.ok(SCOPES.includes('backend_only'));
        assert.ok(SCOPES.includes('doc_only'));
    });
});

describe('classifyTask', () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENROUTER_API_KEY;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        if (originalApiKey !== undefined) process.env.OPENROUTER_API_KEY = originalApiKey;
        else delete process.env.OPENROUTER_API_KEY;
    });

    it('returns UNKNOWN and full when LLM call throws', async () => {
        process.env.OPENROUTER_API_KEY = 'test';
        globalThis.fetch = () => Promise.reject(new Error('network'));
        const out = await classifyTask({ description: 'fix bug' });
        assert.strictEqual(out.taskType, 'UNKNOWN');
        assert.strictEqual(out.scope, 'full');
    });

    it('returns parsed taskType and scope when LLM returns valid JSON', async () => {
        process.env.OPENROUTER_API_KEY = 'test';
        globalThis.fetch = async () => ({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: '{"taskType":"FIX","scope":"backend_only"}' } }]
            })
        });
        const out = await classifyTask({ description: 'fix the login bug' });
        assert.strictEqual(out.taskType, 'FIX');
        assert.strictEqual(out.scope, 'backend_only');
    });
});
