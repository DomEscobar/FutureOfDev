#!/usr/bin/env node

/**
 * AGENCY CLI (V12.0)
 * The Universal Deployment Interface for the Governed Roster.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// Paths
const AGENCY_LIB = '/root/FutureOfDev/opencode';
const ROSTER_DIR = path.join(AGENCY_LIB, 'roster');
const ORCHESTRATOR = path.join(AGENCY_LIB, 'orchestrator.cjs');

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
    console.log(`
🏛️  AGENCY CLI (V12.0) - Master Spec Governed Roster

Usage:
  agency run <task_id>        - Run a formal benchmark task (e.g. bench-001)
  agency run "<prompt>"       - Run an ad-hoc implementation turn
  agency status               - Show last telemetry / pulse
  agency roster               - List active agent souls and desks
  agency init                 - Initialize project for agency governance

Options:
  --interactive               - Pause for approval between agent handovers
  --dir <path>                - Set target workspace (default: current dir)
    `);
    process.exit(0);
}

// Target Workspace Detection
let targetWorkspace = process.cwd();
const dirIndex = args.indexOf('--dir');
if (dirIndex !== -1) targetWorkspace = path.resolve(args[dirIndex + 1]);

if (command === 'run') {
    const input = args[1];
    if (!input) {
        console.error("❌ Error: Missing task ID or prompt string.");
        process.exit(1);
    }

    // Check if input is a Task ID (looks like bench-xxx) or a Prompt
    const isTaskId = /^[a-zA-Z0-9_-]+$/.test(input) && !input.includes(' ');

    if (isTaskId) {
        console.log(`🏁 Starting Benchmark Mode: ${input}`);
        // Invoke orchestrator with formal task flag
        const op = spawn('node', [ORCHESTRATOR, '--task', input], { 
            cwd: AGENCY_LIB, 
            stdio: 'inherit' 
        });
        op.on('close', code => process.exit(code));
    } else {
        console.log(`🛠️  Starting Ad-Hoc Mode: "${input}"`);
        // Ad-hoc mode logic (placeholder for V12 extended logic)
        // For now, it creates a temporary prompt-task.json
        const tempTask = {
            id: "ad-hoc-task",
            description: input,
            requirements: { backend: true, frontend: true }
        };
        const tempPath = path.join(AGENCY_LIB, 'tasks', 'prompt-task.json');
        fs.writeFileSync(tempPath, JSON.stringify(tempTask, null, 2));
        
        const op = spawn('node', [ORCHESTRATOR, '--task', 'prompt-task'], { 
            cwd: AGENCY_LIB, 
            stdio: 'inherit' 
        });
        op.on('close', code => {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            process.exit(code);
        });
    }
} else if (command === 'roster') {
    const roles = fs.readdirSync(ROSTER_DIR).filter(f => fs.statSync(path.join(ROSTER_DIR, f)).isDirectory() && f !== 'shared');
    console.log(`\n🎭 ACTIVE ROSTER DESKS (@ ${ROSTER_DIR}):`);
    roles.forEach(role => {
        const soul = fs.readFileSync(path.join(ROSTER_DIR, role, 'SOUL.md'), 'utf8');
        const identity = soul.split('\n').find(l => l.startsWith('## Identity'))?.replace('## Identity', '').trim() || "Active Agent";
        console.log(` - [${role.toUpperCase()}]: ${identity}`);
    });
} else if (command === 'status') {
    const statePath = path.join(AGENCY_LIB, '.run', 'telemetry_state.json');
    if (fs.existsSync(statePath)) {
        console.log(JSON.parse(fs.readFileSync(statePath, 'utf8')));
    } else {
        console.log("No active telemetry found.");
    }
}
