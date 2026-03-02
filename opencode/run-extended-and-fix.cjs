#!/usr/bin/env node
/**
 * Run explorer in extended mode, then proactively process new findings
 * and trigger the Agency to fix them (single watcher pass).
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname);
const MEMORY_DIR = path.join(ROOT, 'roster', 'player', 'memory');
const FINDINGS_FILE = path.join(MEMORY_DIR, 'ux_findings.md');
const STATE_FILE = path.join(MEMORY_DIR, 'watcher_state.json');

const DEFAULT_URL = process.env.EXPLORER_URL || 'http://localhost:5173';
const EXTENDED_STEPS = Number(process.env.EXTENDED_STEPS) || 150;

function run(cmd, args, env = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, {
            cwd: ROOT,
            stdio: 'inherit',
            env: { ...process.env, AGENCY_HOME: ROOT, ...env }
        });
        proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
        proc.on('error', reject);
    });
}

function primeWatcherState() {
    const size = fs.existsSync(FINDINGS_FILE) ? fs.statSync(FINDINGS_FILE).size : 0;
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({
        lastProcessedByte: size,
        processedFingerprints: []
    }, null, 2));
    console.log(`[run-extended-and-fix] Primed watcher: lastProcessedByte=${size}`);
}

async function main() {
    const url = process.argv[2] || DEFAULT_URL;
    const steps = Number(process.argv[3]) || EXTENDED_STEPS;
    const workspace = process.env.WORKSPACE || process.cwd();

    console.log(`[run-extended-and-fix] Explorer: ${url} × ${steps} steps. Workspace: ${workspace}`);

    primeWatcherState();

    console.log('[run-extended-and-fix] Running explorer...');
    await run('node', ['universal-explorer.mjs', url, String(steps)]);

    console.log('[run-extended-and-fix] Running watcher --once to fix findings...');
    await run('node', ['player-finding-watcher.cjs', '--once'], { WORKSPACE: workspace });

    console.log('[run-extended-and-fix] Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
