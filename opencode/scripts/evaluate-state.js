const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AGENCY_ROOT = path.join(__dirname, '..');
const TASKS_FILE = path.join(AGENCY_ROOT, 'tasks.json');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');

function getWorkspace() {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return config.AGENCY_WORKSPACE || '.';
    } catch (e) {
        return '.';
    }
}

function runAgent(agent, prompt) {
    console.log(`[evaluate-state] Triggering ${agent}`);
    try {
        execSync(
            `/usr/bin/opencode run "${prompt}" --agent ${agent} --format json`,
            { stdio: 'inherit', cwd: AGENCY_ROOT }
        );
    } catch (e) {
        console.error(`Failed to run agent ${agent}:`, e.message);
    }
}

function evaluateState() {
    if (!fs.existsSync(TASKS_FILE)) return;

    let data;
    try {
        data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } catch (e) {
        console.error('Malformed tasks.json, skipping evaluation:', e.message);
        return;
    }

    const workspace = getWorkspace();
    let stateChanged = false;

    for (const task of data.tasks) {
        if (task.status === 'pending') {
            task.status = 'assigned_to_dev';
            stateChanged = true;
            runAgent('project-manager',
                `Review task "${task.title}". Update tasks.json: set status to "in_progress" and add implementation details to the description. Target workspace: ${workspace}`
            );
            break;
        }

        if (task.status === 'in_progress') {
            task.status = 'in_dev';
            stateChanged = true;
            runAgent('dev-unit',
                `Implement task "${task.title}". Details: ${task.description}. Target workspace: ${workspace}. When done, update tasks.json status to "ready_for_test".`
            );
            break;
        }

        if (task.status === 'ready_for_test') {
            task.status = 'testing';
            stateChanged = true;
            runAgent('test-unit',
                `Verify task "${task.title}". Run scripts/gatekeeper.sh and scripts/test-harness.js against workspace ${workspace}. If pass, update tasks.json status to "completed". If fail, set status to "in_progress" and append failure reasons.`
            );
            break;
        }
    }

    if (stateChanged) {
        fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
    }
}

evaluateState();
