const path = require('path');
const fs = require('fs');

const CONFIG = JSON.parse(fs.readFileSync('/root/FutureOfDev/opencode/config.json', 'utf8'));
const workspace = CONFIG.PROJECT_WORKSPACE;
const BENCHMARK_TASKS_PATH = path.join(workspace, 'benchmark', 'tasks');

console.log('Workspace:', workspace);
console.log('BENCHMARK_TASKS_PATH:', BENCHMARK_TASKS_PATH);
console.log('Exists:', fs.existsSync(BENCHMARK_TASKS_PATH));

if (fs.existsSync(BENCHMARK_TASKS_PATH)) {
    console.log('Files:', fs.readdirSync(BENCHMARK_TASKS_PATH));
    
    const taskId = 'bench-001';
    const possibleNames = [
        path.join(BENCHMARK_TASKS_PATH, `${taskId}.json`),
        path.join(BENCHMARK_TASKS_PATH, `benchmark-${taskId}.json`)
    ];
    
    console.log('\nLooking for:', possibleNames);
    for (const p of possibleNames) {
        console.log(`  ${p}: ${fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND'}`);
    }
}
