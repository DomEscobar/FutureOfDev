#!/usr/bin/env node
/**
 * PROTOCOL BRIDGE V1.0
 * Translates opencode agent output to orchestrator context.json format.
 * 
 * Usage: node protocol-bridge.cjs <task-id> <agent-name> "<task-description>"
 * 
 * This script:
 * 1. Runs opencode with the specified agent
 * 2. Parses output for @@@WRITE_CONTEXT:type@@@ ... @@@END_WRITE@@@ tags
 * 3. Writes parsed context to .run/context/<task-id>-context.json
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const AGENCY_ROOT = '/root/FutureOfDev/opencode';
const CONTEXT_DIR = path.join(AGENCY_ROOT, '.run', 'context');

const [,, taskId, agentName, taskDesc] = process.argv;

if (!taskId || !agentName || !taskDesc) {
    console.error('Usage: node protocol-bridge.cjs <task-id> <agent-name> "<task-description>"');
    process.exit(1);
}

const workspace = process.env.PROJECT_WORKSPACE || '/root/Playground_AI_Dev';
const opencodeBin = fs.existsSync('/usr/bin/opencode') ? '/usr/bin/opencode' : '/root/.opencode/bin/opencode';

const contextFile = path.join(CONTEXT_DIR, `${taskId}-context.json`);
let output = '';
let contextFound = false;

console.log(`[BRIDGE] Starting ${agentName} for task ${taskId}`);

const child = spawn(opencodeBin, [
    'run', taskDesc,
    '--agent', agentName,
    '--dir', workspace
], {
    cwd: AGENCY_ROOT,
    env: { ...process.env, PROJECT_ID: taskId }
});

child.stdout.on('data', (data) => {
    output += data.toString();
    process.stdout.write(data);
});

child.stderr.on('data', (data) => {
    process.stderr.write(data);
});

child.on('close', (code) => {
    console.log(`\n[BRIDGE] Agent exited with code ${code}`);
    
    // Parse output for context tags
    const contextMatch = output.match(/@@@WRITE_CONTEXT:(\w+)@@@\n?([\s\S]*?)\n?@@@END_WRITE@@@/);
    
    if (contextMatch) {
        const [, contextType, jsonContent] = contextMatch;
        try {
            const parsed = JSON.parse(jsonContent);
            fs.writeFileSync(contextFile, JSON.stringify({
                ...parsed,
                context_type: contextType,
                agent: agentName,
                task_id: taskId,
                timestamp: new Date().toISOString()
            }, null, 2));
            console.log(`[BRIDGE] Context written to ${contextFile}`);
            contextFound = true;
        } catch (e) {
            console.error('[BRIDGE] Failed to parse context JSON:', e.message);
        }
    }
    
    // If no context tag found but agent succeeded, create default context
    if (!contextFound && code === 0) {
        fs.writeFileSync(contextFile, JSON.stringify({
            verdict: 'completed',
            summary: 'Agent completed without explicit verdict',
            agent: agentName,
            task_id: taskId,
            timestamp: new Date().toISOString()
        }, null, 2));
        console.log('[BRIDGE] Created default context (agent succeeded)');
    }
    
    // If agent failed
    if (!contextFound && code !== 0) {
        fs.writeFileSync(contextFile, JSON.stringify({
            verdict: 'failed',
            summary: `Agent exited with code ${code}`,
            agent: agentName,
            task_id: taskId,
            timestamp: new Date().toISOString()
        }, null, 2));
        console.log('[BRIDGE] Created failure context');
    }
    
    process.exit(code);
});