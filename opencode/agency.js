#!/usr/bin/env node

/**
 * AGENCY CLI (V12.2) - Universal Infrastructure Edition
 * The Universal Deployment Interface for the Governed Roster.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// --- PATH RESOLUTION ENGINE ---
// Order: Env Var -> Script Directory -> Global Standard
const AGENCY_HOME = process.env.AGENCY_HOME || __dirname;
const ROSTER_DIR = path.join(AGENCY_HOME, 'roster');
const ORCHESTRATOR = path.join(AGENCY_HOME, 'orchestrator.cjs');

const args = process.argv.slice(2);
const command = args[0];

// Help Menu
if (!command || command === 'help') {
    console.log(`
🏛️  AGENCY CLI (V12.2) - Universal Master Spec Engine

Home Dir: ${AGENCY_HOME}

Usage:
  agency run <task_id>        - Run a formal benchmark task (e.g. bench-001)
  agency run "<prompt>"       - Run an ad-hoc implementation turn
  agency status               - Show last telemetry / pulse
  agency roster               - List active agent souls and desks
  agency init                 - Initialize project for agency governance

Global Environment:
  AGENCY_HOME                 - Path to roster/ and orchestrator (Current: ${AGENCY_HOME})

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

if (command === 'init') {
    console.log(`🧬 Initializing Agency Governance in: ${targetWorkspace}`);
    
    const configPath = path.join(targetWorkspace, 'agency.json');
    if (fs.existsSync(configPath)) {
        console.log("⚠️  Project already initialized (agency.json exists).");
    } else {
        const initialConfig = {
            project: path.basename(targetWorkspace),
            agency_home: AGENCY_HOME,
            governance: "V12.2-Universal",
            roster_source: ROSTER_DIR
        };
        fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
        
        // Setup local runtime folder
        const localRun = path.join(targetWorkspace, '.run');
        if (!fs.existsSync(localRun)) fs.mkdirSync(localRun);
        
        console.log("✅ Initialization complete. Project is now Governed.");
    }
    process.exit(0);
}

if (command === 'run') {
    const input = args[1];
    if (!input) {
        console.error("❌ Error: Missing task ID or prompt string.");
        process.exit(1);
    }

    const isTaskId = /^[a-zA-Z0-9_-]+$/.test(input) && !input.includes(' ');

    if (isTaskId) {
        console.log(`🏁 Starting Benchmark Mode: ${input}`);
        const op = spawn('node', [ORCHESTRATOR, '--task', input], { 
            cwd: AGENCY_HOME, 
            stdio: 'inherit',
            env: { ...process.env, AGENCY_HOME }
        });
        op.on('close', code => process.exit(code));
    } else {
        console.log(`🛠️  Starting Ad-Hoc Mode: "${input}"`);
        const tempTask = {
            id: "ad-hoc-task",
            description: input,
            requirements: { backend: true, frontend: true }
        };
        const tasksDir = path.join(AGENCY_HOME, 'tasks');
        if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir);
        
        const tempPath = path.join(tasksDir, 'prompt-task.json');
        fs.writeFileSync(tempPath, JSON.stringify(tempTask, null, 2));
        
        const op = spawn('node', [ORCHESTRATOR, '--task', 'prompt-task'], { 
            cwd: AGENCY_HOME, 
            stdio: 'inherit',
            env: { ...process.env, AGENCY_HOME }
        });
        op.on('close', code => {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            process.exit(code);
        });
    }
} else if (command === 'roster') {
    if (!fs.existsSync(ROSTER_DIR)) {
        console.error(`❌ Error: Roster directory not found at ${ROSTER_DIR}`);
        process.exit(1);
    }
    const roles = fs.readdirSync(ROSTER_DIR).filter(f => fs.statSync(path.join(ROSTER_DIR, f)).isDirectory() && f !== 'shared');
    console.log(`\n🎭 ACTIVE ROSTER DESKS (@ ${ROSTER_DIR}):`);
    roles.forEach(role => {
        const soulPath = path.join(ROSTER_DIR, role, 'SOUL.md');
        if (fs.existsSync(soulPath)) {
            const soul = fs.readFileSync(soulPath, 'utf8');
            const identity = soul.split('\n').find(l => l.startsWith('## Identity'))?.replace('## Identity', '').trim() || "Active Agent";
            console.log(` - [${role.toUpperCase()}]: ${identity}`);
        }
    });
} else if (command === 'status') {
    const statePath = path.join(AGENCY_HOME, '.run', 'telemetry_state.json');
    if (fs.existsSync(statePath)) {
        console.log(JSON.parse(fs.readFileSync(statePath, 'utf8')));
    } else {
        console.log("No active telemetry found.");
    }
}
