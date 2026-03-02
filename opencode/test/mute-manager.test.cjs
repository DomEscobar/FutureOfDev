const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_ROOT = path.join(__dirname, 'fixtures', 'telemetry-test-run');
fs.mkdirSync(path.join(TEST_ROOT, '.run'), { recursive: true });
process.env.AGENCY_HOME = TEST_ROOT;

const muteManager = require('../mute-manager');

const MUTE_PATH = path.join(TEST_ROOT, '.run', 'mute_state.json');

function cleanMute() {
    if (fs.existsSync(MUTE_PATH)) fs.unlinkSync(MUTE_PATH);
}

describe('mute-manager', () => {
    afterEach(() => {
        cleanMute();
    });

    describe('isGloballyMuted', () => {
        it('returns false when no mute file', () => {
            assert.strictEqual(muteManager.isGloballyMuted(), false);
        });
        it('returns true when global mute set and until in future', () => {
            muteManager.setGlobalMute(30);
            assert.strictEqual(muteManager.isGloballyMuted(), true);
        });
        it('returns false after clearAllMutes', () => {
            muteManager.setGlobalMute(30);
            muteManager.clearAllMutes();
            assert.strictEqual(muteManager.isGloballyMuted(), false);
        });
    });

    describe('setGlobalMute', () => {
        it('sets mute with until timestamp when minutes > 0', () => {
            const out = muteManager.setGlobalMute(15);
            assert.strictEqual(out.muted, true);
            assert.ok(out.until);
        });
        it('clears mute when minutes null or <= 0', () => {
            muteManager.setGlobalMute(30);
            muteManager.setGlobalMute(null);
            assert.strictEqual(muteManager.isGloballyMuted(), false);
            muteManager.setGlobalMute(5);
            muteManager.setGlobalMute(0);
            assert.strictEqual(muteManager.isGloballyMuted(), false);
        });
    });

    describe('isFindingMuted and setFindingMute', () => {
        it('returns false for unknown finding', () => {
            assert.strictEqual(muteManager.isFindingMuted('FND-X'), false);
        });
        it('returns true when finding muted and until in future', () => {
            muteManager.setFindingMute('FND-1', 10);
            assert.strictEqual(muteManager.isFindingMuted('FND-1'), true);
        });
        it('clears finding mute when minutes null', () => {
            muteManager.setFindingMute('FND-2', 10);
            muteManager.setFindingMute('FND-2', null);
            assert.strictEqual(muteManager.isFindingMuted('FND-2'), false);
        });
    });

    describe('clearAllMutes', () => {
        it('clears global and findings', () => {
            muteManager.setGlobalMute(30);
            muteManager.setFindingMute('FND-A', 5);
            muteManager.clearAllMutes();
            assert.strictEqual(muteManager.isGloballyMuted(), false);
            assert.strictEqual(muteManager.isFindingMuted('FND-A'), false);
        });
    });
});
