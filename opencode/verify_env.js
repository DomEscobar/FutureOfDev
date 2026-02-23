const path = require('path');
const fs = require('fs');
const agencyRoot = __dirname;
const config = JSON.parse(fs.readFileSync(path.join(agencyRoot, 'config.json'), 'utf8'));
console.log('--- AGENCY ENV VERIFICATION ---');
console.log('Agency Root:', agencyRoot);
console.log('Project Workspace:', config.PROJECT_WORKSPACE);
const benchmarkTasks = path.join(config.PROJECT_WORKSPACE, 'benchmark', 'tasks');
console.log('Expected Benchmark Path:', benchmarkTasks);
if (fs.existsSync(benchmarkTasks)) {
    console.log('Benchmark Files:', fs.readdirSync(benchmarkTasks));
} else {
    console.log('ERROR: Benchmark Tasks folder not found!');
}
