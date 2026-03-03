#!/usr/bin/env node

/**
 * AGENCY CLI (V12.2) - Universal Infrastructure Edition
 * The Universal Deployment Interface for the Governed Roster.
 *
 * Synergistic flow with Hyper Explorer:
 *   Explorer (hyper-explorer-mcp.mjs) → writes to roster/player/memory/findings.md
 *   Watcher (player-finding-watcher.cjs) → spawns agency with AGENCY_TASK_JSON + WORKSPACE
 *   Agency (here) → passes task payload to orchestrator; WORKSPACE is used as target repo.
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

// Target Workspace: --dir overrides; else WORKSPACE env (watcher/scripts); else cwd
let targetWorkspace = process.cwd();
if (command === 'run' && process.env.WORKSPACE) {
    targetWorkspace = process.env.WORKSPACE;
}
const dirIndex = args.indexOf('--dir');
if (dirIndex !== -1 && args[dirIndex + 1]) {
    targetWorkspace = path.resolve(args[dirIndex + 1]);
}

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
  WORKSPACE                    - Target repo for "agency run" (when set by watcher/scripts)

Options:
  --interactive               - Pause for approval between agent handovers
  --dir <path>                - Set target workspace (default: current dir)
    `);
    process.exit(0);
}

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

    const agencyEnv = { ...process.env, AGENCY_HOME, WORKSPACE: targetWorkspace };

    if (isTaskId) {
        console.log(`🏁 Starting Benchmark Mode: ${input} (workspace: ${targetWorkspace})`);
        const op = spawn('node', [ORCHESTRATOR, '--task', input], { 
            cwd: targetWorkspace, 
            stdio: 'inherit',
            env: agencyEnv,
        });
        op.on('close', code => process.exit(code));
    } else {
        console.log(`🛠️  Starting Ad-Hoc Mode: "${input}" (workspace: ${targetWorkspace})`);
        const findingIdMatch = input.match(/\[FINDING_ID:\s*([^\]]+)\]/);
        const findingId = findingIdMatch ? findingIdMatch[1].trim() : null;
        let taskPayload;
        const existingJson = process.env.AGENCY_TASK_JSON;
        if (findingId && existingJson) {
            try {
                const parsed = JSON.parse(existingJson);
                if (parsed && (parsed.taskType != null || parsed.scope != null || parsed.name != null || parsed.expected_behavior != null)) {
                    taskPayload = { ...parsed, description: parsed.description || input, findingId };
                } else {
                    taskPayload = { id: 'finding', description: input, findingId };
                }
            } catch (_) {
                taskPayload = { id: 'finding', description: input, findingId };
            }
        } else if (findingId) {
            taskPayload = { id: 'finding', description: input, findingId };
        } else {
            taskPayload = { id: 'ad-hoc', description: input };
        }
        const agencyEnvWithTask = { ...agencyEnv, AGENCY_TASK_JSON: JSON.stringify(taskPayload) };
        const op = spawn('node', [ORCHESTRATOR, input], {
            cwd: targetWorkspace,
            stdio: 'inherit',
            env: agencyEnvWithTask,
        });
        op.on('close', code => process.exit(code));
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
