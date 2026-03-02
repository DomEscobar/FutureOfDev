const { describe, it } = require('node:test');
const assert = require('node:assert');

const buttons = require('../telegram/buttons');

describe('telegram buttons', () => {
    describe('reRunExplorer', () => {
        it('returns array of rows with explorer_run callback', () => {
            const out = buttons.reRunExplorer();
            assert.ok(Array.isArray(out));
            assert.strictEqual(out.length, 1);
            assert.strictEqual(out[0][0].callback_data, 'explorer_run');
        });
    });

    describe('verifyFix', () => {
        it('includes findingId in callback_data', () => {
            const out = buttons.verifyFix('FND-123');
            assert.strictEqual(out[0][0].callback_data, 'verify_fix:FND-123');
        });
    });

    describe('muteFor', () => {
        it('includes minutes in label and callback', () => {
            const out = buttons.muteFor(30);
            assert.ok(out[0][0].text.includes('30'));
            assert.strictEqual(out[0][0].callback_data, 'mute:30');
        });
    });

    describe('viewLog', () => {
        it('includes type in callback_data', () => {
            assert.strictEqual(buttons.viewLog('telemetry')[0][0].callback_data, 'view_log:telemetry');
            assert.strictEqual(buttons.viewLog('journal')[0][0].callback_data, 'view_log:journal');
        });
    });

    describe('combine', () => {
        it('returns inline_keyboard with flattened rows', () => {
            const out = buttons.combine(buttons.reRunExplorer(), buttons.muteFor(30));
            assert.ok(out.inline_keyboard);
            assert.ok(Array.isArray(out.inline_keyboard));
            assert.ok(out.inline_keyboard.length >= 2);
        });
        it('filters out non-arrays and empty rows', () => {
            const out = buttons.combine([], buttons.reRunExplorer());
            assert.ok(out.inline_keyboard);
            assert.strictEqual(out.inline_keyboard.length, 1);
        });
        it('returns null when no valid rows', () => {
            const out = buttons.combine([], []);
            assert.strictEqual(out, null);
        });
    });

    describe('actionPanel', () => {
        it('includes verify button when findingId provided', () => {
            const out = buttons.actionPanel('FND-X');
            const cbData = out.inline_keyboard.flat().map(b => b.callback_data);
            assert.ok(cbData.some(c => c && c.startsWith('verify_fix:')));
        });
        it('omits verify when findingId null', () => {
            const out = buttons.actionPanel(null);
            const cbData = out.inline_keyboard.flat().map(b => b.callback_data);
            assert.ok(!cbData.some(c => c && c.startsWith('verify_fix:')));
        });
    });

    describe('confirm', () => {
        it('returns Yes/No rows with action in callback', () => {
            const out = buttons.confirm('delete');
            assert.strictEqual(out.length, 1);
            assert.strictEqual(out[0].length, 2);
            assert.strictEqual(out[0][0].callback_data, 'confirm:delete');
            assert.strictEqual(out[0][1].callback_data, 'confirm:cancel');
        });
    });
});
