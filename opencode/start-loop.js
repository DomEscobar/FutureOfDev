#!/usr/bin/env node
/**
 * START-LOOP — One‑Command Launcher
 * 
 * Usage:
 *   node start-loop.js [explorer_url] [steps]
 * 
 * Does:
 *   1. Kill stale processes (orchestrator, watcher, explorer)
 *   2. Clear state files (watcher_state.json)
 *   3. Start telegram-control bot (background)
 *   4. Start player-finding-watcher with health server (background)
 *   5. Run MCP explorer (foreground)
 *   6. On completion, summary
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function killIfRunning(pattern) {
    try {
        execSync(`pkill -f "${pattern}"`, { stdio: 'ignore' });
    } catch (e) {
        // ignore
    }
}

function clearFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Removed state: ${filePath}`);
    }
}

function runCommand(cmd, background = false) {
    console.log(`▶️  ${cmd}`);
    if (background) {
        const parts = cmd.split(' ');
        const proc = spawn(parts[0], parts.slice(1), { 
            detached: true, 
            stdio: 'ignore',
            cwd: __dirname
        });
        proc.unref();
        return proc.pid;
    } else {
        execSync(cmd, { cwd: __dirname, stdio: 'inherit' });
    }
}

// Main
const args = process.argv.slice(2);
const url = args[0] || 'http://localhost:5173';
const steps = args[1] || '10';

console.log(`
╔════════════════════════════════════════╗
║   START‑LOOP v1.0 — Clean Orchestration ║
╚════════════════════════════════════════╝
Target: ${url}
Steps:  ${steps}
`);

// 1. Clean up old processes
console.log('🧹 Cleaning stale processes...');
killIfRunning('orchestrator.cjs');
killIfRunning('player-finding-watcher');
killIfRunning('mcp-explorer.mjs');
killIfRunning('telegram-control.cjs');

// 2. Clear state files
console.log('🧹 Clearing state...');
clearFile(path.join(__dirname, 'roster/player/memory/watcher_state.json'));
// Keep other state for visibility but we start fresh

// 3. Start Telegram Control Bot (background)
console.log('🤖 Starting Telegram bot...');
const botPid = runCommand('node /root/FutureOfDev/opencode/telegram-control.cjs', true);
console.log(`   Bot PID: ${botPid}`);

// 4. Start Watcher with health server (background)
console.log('👁️  Starting Watcher + Health...');
const watcherPid = runCommand('node /root/FutureOfDev/opencode/player-finding-watcher.cjs --watch --health-port 9999', true);
console.log(`   Watcher PID: ${watcherPid}`);

// Wait for watcher to initialize
console.log('⏳ Waiting 3s for watcher to settle...');
await new Promise(r => setTimeout(r, 3000));

// 5. Run Explorer (foreground)
console.log('🚀 Starting MCP Explorer...');
try {
    runCommand(`node /root/FutureOfDev/opencode/mcp-explorer.mjs ${url} ${steps}`);
} catch (e) {
    console.error('❌ Explorer failed:', e.message);
}

// 6. Summary
console.log(`
✅ Loop run complete.

Watcher is still running in background (PID ${watcherPid}).
You can check status:
  • Health: curl http://localhost:9999/health
  • Stop: pkill -f "player-finding-watcher"; pkill -f "telegram-control.cjs"

Next: Check Telegram for 🕹️ Player pulses and 📐 Agency pulses.
`);
