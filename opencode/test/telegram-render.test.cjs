const { describe, it } = require('node:test');
const assert = require('node:assert');

const tg = require('../telegram/index.js');

describe('telegram render', () => {
    describe('renderAgency', () => {
        it('returns text, parse_mode, and reply_markup', () => {
            const state = {
                taskId: 'task-1',
                startTime: Date.now() - 60000,
                phases: { architect: { status: 'Done' }, hammer: { status: '⏳ Queued' }, checker: { status: '⏳' }, medic: { status: '⏳' }, skeptic: { status: '⏳' } },
                latestThought: 'Running',
                metrics: { cost: '0.01' }
            };
            const out = tg.renderAgency(state);
            assert.strictEqual(typeof out.text, 'string');
            assert.ok(out.text.length > 0);
            assert.strictEqual(out.parse_mode, 'MarkdownV2');
            assert.ok(out.reply_markup && out.reply_markup.inline_keyboard);
        });
        it('includes verify button when state.findingId is set', () => {
            const state = { taskId: 'x', startTime: Date.now(), phases: {}, latestThought: '', findingId: 'FND-123' };
            const out = tg.renderAgency(state);
            const cbData = out.reply_markup.inline_keyboard.flat().map(b => b.callback_data);
            assert.ok(cbData.some(c => c === 'verify_fix:FND-123'));
        });
    });

    describe('renderPlayer', () => {
        it('returns text and reply_markup for player session', () => {
            const state = {
                taskId: 'Player run',
                startTime: Date.now(),
                phases: { hammer: { status: 'Analyzing' } },
                metrics: { cost: '0', loops: 0, quality: 'OK' },
                latestThought: 'Hello'
            };
            const out = tg.renderPlayer(state);
            assert.strictEqual(typeof out.text, 'string');
            assert.ok(out.text.includes('PLAYER'));
            assert.strictEqual(out.parse_mode, 'MarkdownV2');
            assert.ok(out.reply_markup && out.reply_markup.inline_keyboard);
        });
    });

    describe('renderFinding', () => {
        it('returns finding card text and verify/re-run buttons', () => {
            const finding = {
                id: 'FND-1',
                title: 'Button contrast',
                severity: 'MEDIUM',
                page: '/login',
                element: 'button.submit',
                recommendation: 'Increase contrast',
                timestamp: new Date().toISOString()
            };
            const out = tg.renderFinding(finding, 'NEW');
            assert.strictEqual(typeof out.text, 'string');
            assert.ok(out.text.includes('MEDIUM') || out.text.includes('contrast'));
            assert.strictEqual(out.parse_mode, 'MarkdownV2');
            assert.ok(out.reply_markup && out.reply_markup.inline_keyboard);
            const cbData = out.reply_markup.inline_keyboard.flat().map(b => b.callback_data);
            assert.ok(cbData.some(c => c === 'verify_fix:FND-1'));
        });
        it('includes RESOLVED line when status is RESOLVED', () => {
            const finding = { id: 'F', title: 'T', severity: 'LOW', page: '/', element: 'x', recommendation: 'r', timestamp: new Date() };
            const out = tg.renderFinding(finding, 'RESOLVED');
            assert.ok(out.text.includes('RESOLVED'));
        });
    });

    describe('renderKpi', () => {
        it('returns daily report text and null reply_markup', () => {
            const stats = {
                date: 'Mar 2',
                playerRuns: 5,
                newFindings: 2,
                fixed: 1,
                pending: 3,
                totalSpend: 0.5,
                budget: 10,
                hotFinding: null
            };
            const out = tg.renderKpi(stats);
            assert.strictEqual(typeof out.text, 'string');
            assert.ok(out.text.includes('DAILY REPORT') || out.text.includes('Mar 2'));
            assert.strictEqual(out.reply_markup, null);
        });
    });
});
