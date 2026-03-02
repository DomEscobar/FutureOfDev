/**
 * FINDINGS LEDGER V2.0 — With Telegram message tracking
 * Extends basic ledger to store per‑finding message IDs for editing
 */

const fs = require('fs');
const path = require('path');

const AGENCY_ROOT = process.env.AGENCY_HOME || '/root/FutureOfDev/opencode';
const LEDGER_PATH = path.join(AGENCY_ROOT, '.run', 'findings.json');

function load() {
    if (!fs.existsSync(LEDGER_PATH)) {
        return { findings: {}, meta: { version: 2, created: new Date().toISOString() } };
    }
    try {
        return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    } catch(e) {
        return { findings: {}, meta: { version: 2, recovered: true } };
    }
}

function save(ledger) {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

function generateId() {
    return `FND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function addFinding(playerFinding, source = 'universal-explorer') {
    const ledger = load();
    const id = generateId();
    
    ledger.findings[id] = {
        id,
        created: new Date().toISOString(),
        source,
        player: {
            title: playerFinding.title,
            severity: playerFinding.severity,
            description: playerFinding.description,
            screenshot: playerFinding.screenshot,
            url: playerFinding.url,
            raw: playerFinding
        },
        agency: {
            taskIds: [], // could be multiple tasks per finding
            status: 'pending', // pending, in_progress, fixed, verified
            fixCommit: null,
            prNumber: null,
            prUrl: null
        },
        verification: {
            lastChecked: null,
            status: 'pending', // pending, verified, failed
            notes: null,
            verifiedBy: null
        },
        telegram: {
            dashboardMessageId: null,
            cardMessageId: null,
            mutedUntil: null
        }
    };
    
    save(ledger);
    return id;
}

function linkAgencyTask(findingId, taskId) {
    const ledger = load();
    if (ledger.findings[findingId]) {
        if (!ledger.findings[findingId].agency.taskIds.includes(taskId)) {
            ledger.findings[findingId].agency.taskIds.push(taskId);
        }
        ledger.findings[findingId].agency.status = 'in_progress';
        save(ledger);
        return true;
    }
    return false;
}

function markFixed(findingId, commitHash, prNumber = null, prUrl = null) {
    const ledger = load();
    if (ledger.findings[findingId]) {
        ledger.findings[findingId].agency.fixCommit = commitHash;
        ledger.findings[findingId].agency.prNumber = prNumber;
        ledger.findings[findingId].agency.prUrl = prUrl;
        ledger.findings[findingId].agency.status = 'fixed';
        save(ledger);
        return true;
    }
    return false;
}

function verifyFinding(findingId, status, notes = null, verifiedBy = 'manual') {
    const ledger = load();
    if (ledger.findings[findingId]) {
        ledger.findings[findingId].verification.lastChecked = new Date().toISOString();
        ledger.findings[findingId].verification.status = status;
        ledger.findings[findingId].verification.notes = notes;
        ledger.findings[findingId].verification.verifiedBy = verifiedBy;
        ledger.findings[findingId].agency.status = status === 'verified' ? 'verified' : ledger.findings[findingId].agency.status;
        save(ledger);
        return true;
    }
    return false;
}

function storeTelegramMessageId(findingId, messageId, type = 'dashboard') {
    const ledger = load();
    if (ledger.findings[findingId]) {
        if (type === 'dashboard') {
            ledger.findings[findingId].telegram.dashboardMessageId = messageId;
        } else if (type === 'card') {
            ledger.findings[findingId].telegram.cardMessageId = messageId;
        }
        save(ledger);
    }
}

function getFinding(findingId) {
    const ledger = load();
    return ledger.findings[findingId] || null;
}

function listAll() {
    const ledger = load();
    return Object.values(ledger.findings);
}

function getOpenFindings() {
    return listAll().filter(f => f.agency.status !== 'verified');
}

function getFindingByTaskId(taskId) {
    const all = listAll();
    for (const f of all) {
        if (f.agency.taskIds && f.agency.taskIds.includes(taskId)) {
            return f;
        }
    }
    return null;
}

// Get message ID for editing (dashboard or card)
function getTelegramMessageId(findingId, type = 'dashboard') {
    const f = getFinding(findingId);
    if (!f) return null;
    return type === 'card' ? f.telegram.cardMessageId : f.telegram.dashboardMessageId;
}

module.exports = {
    addFinding,
    linkAgencyTask,
    markFixed,
    verifyFinding,
    storeTelegramMessageId,
    getFinding,
    listAll,
    getOpenFindings,
    getFindingByTaskId,
    getTelegramMessageId
};
