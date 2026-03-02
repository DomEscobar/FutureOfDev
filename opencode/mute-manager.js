/**
 * MUTE MANAGER V1.0
 * Global and per‑finding mute state for Telegram updates
 */

const fs = require('fs');
const path = require('path');

const AGENCY_ROOT = '/root/FutureOfDev/opencode';
const MUTE_FILE = path.join(AGENCY_ROOT, '.run', 'mute_state.json');

function load() {
    if (!fs.existsSync(MUTE_FILE)) {
        return { global: { muted: false, until: null }, findings: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(MUTE_FILE, 'utf8'));
    } catch(e) {
        return { global: { muted: false, until: null }, findings: {} };
    }
}

function save(state) {
    const dir = path.dirname(MUTE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MUTE_FILE, JSON.stringify(state, null, 2));
}

function isGloballyMuted() {
    const state = load();
    if (!state.global.muted) return false;
    if (!state.global.until) return true; // indefinite
    return new Date() < new Date(state.global.until);
}

function setGlobalMute(minutes) {
    const state = load();
    if (minutes === null || minutes <= 0) {
        state.global = { muted: false, until: null };
    } else {
        state.global = {
            muted: true,
            until: new Date(Date.now() + minutes * 60 * 1000).toISOString()
        };
    }
    save(state);
    return state.global;
}

function isFindingMuted(findingId) {
    const state = load();
    const f = state.findings[findingId];
    if (!f || !f.muted) return false;
    if (!f.until) return true;
    return new Date() < new Date(f.until);
}

function setFindingMute(findingId, minutes) {
    const state = load();
    if (!state.findings) state.findings = {};
    
    if (minutes === null || minutes <= 0) {
        delete state.findings[findingId];
    } else {
        state.findings[findingId] = {
            muted: true,
            until: new Date(Date.now() + minutes * 60 * 1000).toISOString()
        };
    }
    save(state);
    return state.findings[findingId];
}

function clearAllMutes() {
    const state = load();
    state.global = { muted: false, until: null };
    state.findings = {};
    save(state);
}

module.exports = {
    isGloballyMuted,
    setGlobalMute,
    isFindingMuted,
    setFindingMute,
    clearAllMutes,
    load
};
