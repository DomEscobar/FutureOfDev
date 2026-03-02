const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_ROOT = path.join(__dirname, 'fixtures', 'telemetry-test-run');
fs.mkdirSync(path.join(TEST_ROOT, '.run'), { recursive: true });
process.env.AGENCY_HOME = TEST_ROOT;

const ledger = require('../ledger');

const LEDGER_PATH = path.join(TEST_ROOT, '.run', 'findings.json');

function cleanLedger() {
    if (fs.existsSync(LEDGER_PATH)) fs.unlinkSync(LEDGER_PATH);
}

describe('ledger', () => {
    afterEach(() => {
        cleanLedger();
    });

    describe('addFinding', () => {
        it('returns a new finding id and persists', () => {
            const id = ledger.addFinding({
                title: 'Test finding',
                severity: 'HIGH',
                description: 'Desc',
                url: '/page',
                raw: {}
            });
            assert.ok(id.startsWith('FND-'));
            const found = ledger.getFinding(id);
            assert.ok(found);
            assert.strictEqual(found.player.title, 'Test finding');
            assert.strictEqual(found.player.severity, 'HIGH');
            assert.strictEqual(found.telegram.dashboardMessageId, null);
            assert.strictEqual(found.telegram.cardMessageId, null);
        });
    });

    describe('storeTelegramMessageId and getTelegramMessageId', () => {
        it('stores and retrieves dashboard message id', () => {
            const id = ledger.addFinding({ title: 'T', severity: 'LOW', url: '/', raw: {} });
            assert.strictEqual(ledger.getTelegramMessageId(id, 'dashboard'), null);
            ledger.storeTelegramMessageId(id, 12345, 'dashboard');
            assert.strictEqual(ledger.getTelegramMessageId(id, 'dashboard'), 12345);
        });
        it('stores and retrieves card message id', () => {
            const id = ledger.addFinding({ title: 'T', severity: 'LOW', url: '/', raw: {} });
            ledger.storeTelegramMessageId(id, 999, 'card');
            assert.strictEqual(ledger.getTelegramMessageId(id, 'card'), 999);
        });
        it('getTelegramMessageId returns null for unknown finding', () => {
            assert.strictEqual(ledger.getTelegramMessageId('FND-NONEXISTENT', 'dashboard'), null);
        });
    });

    describe('getFinding', () => {
        it('returns null for unknown id', () => {
            assert.strictEqual(ledger.getFinding('FND-UNKNOWN'), null);
        });
    });

    describe('listAll and getOpenFindings', () => {
        it('listAll returns all findings, getOpenFindings excludes verified', () => {
            const id1 = ledger.addFinding({ title: 'Open', severity: 'MEDIUM', url: '/', raw: {} });
            const id2 = ledger.addFinding({ title: 'Other', severity: 'LOW', url: '/', raw: {} });
            assert.strictEqual(ledger.listAll().length, 2);
            ledger.verifyFinding(id2, 'verified', null, 'test');
            assert.strictEqual(ledger.getOpenFindings().length, 1);
            assert.strictEqual(ledger.getOpenFindings()[0].player.title, 'Open');
        });
    });

    describe('verifyFinding', () => {
        it('updates verification status', () => {
            const id = ledger.addFinding({ title: 'T', severity: 'HIGH', url: '/', raw: {} });
            const ok = ledger.verifyFinding(id, 'verified', 'Looks good', 'bot');
            assert.strictEqual(ok, true);
            const f = ledger.getFinding(id);
            assert.strictEqual(f.verification.status, 'verified');
            assert.strictEqual(f.verification.notes, 'Looks good');
        });
        it('returns false for unknown finding', () => {
            assert.strictEqual(ledger.verifyFinding('FND-BAD', 'verified'), false);
        });
    });
});
