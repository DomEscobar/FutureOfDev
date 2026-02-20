const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AGENCY_ROOT = path.join(__dirname, '..');
const CONFIG_FILE = path.join(AGENCY_ROOT, 'config.json');

function getWorkspace() {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return config.AGENCY_WORKSPACE || '.';
    } catch (e) {
        return '.';
    }
}

function runTests() {
    const workspace = getWorkspace();
    console.log(`Test harness: validating ${workspace}`);

    const results = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: { total: 0, passed: 0, failed: 0 }
    };

    // 1. Run workspace's own test suite if it exists
    const pkgPath = path.join(workspace, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.scripts && pkg.scripts.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
                console.log('Running npm test...');
                try {
                    execSync('npm test', { stdio: 'inherit', cwd: workspace });
                    results.tests.push({ name: 'npm test', status: 'passed' });
                } catch (e) {
                    results.tests.push({ name: 'npm test', status: 'failed', error: e.message });
                }
            }
        } catch (e) {
            results.tests.push({ name: 'package.json parse', status: 'failed', error: e.message });
        }
    }

    // 2. Structural integrity
    const essentialFiles = ['README.md', '.gitignore'];
    essentialFiles.forEach(file => {
        const exists = fs.existsSync(path.join(workspace, file));
        results.tests.push({ name: `File exists: ${file}`, status: exists ? 'passed' : 'failed' });
    });

    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter(t => t.status === 'passed').length;
    results.summary.failed = results.summary.total - results.summary.passed;

    console.log(JSON.stringify(results.summary));

    if (results.summary.failed > 0) {
        console.error(`FAIL: ${results.summary.failed} tests failed.`);
        process.exit(1);
    }

    console.log('PASS: all tests passed.');
    process.exit(0);
}

runTests();
