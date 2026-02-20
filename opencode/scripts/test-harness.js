/**
 * EXECUTIVE-SWARM: Automated Test Harness
 * 
 * This harness is used by the Test-Unit and Gatekeeper.
 * Performance: High-reasoning validation.
 * Target: /root/FutureOfDev
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    workspace: process.env.AGENCY_WORKSPACE || '/root/FutureOfDev',
    reportPath: path.join(__dirname, '../docs/test_results.json')
};

async function runTests() {
    console.log('🚀 Initializing Neural Test Harness...');
    const results = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: { total: 0, passed: 0, failed: 0 }
    };

    try {
        // 1. Check for existing test suites (Jest/Vitest/Mocha)
        const hasPackage = fs.existsSync(path.join(CONFIG.workspace, 'package.json'));
        if (hasPackage) {
            console.log('📦 Node.js environment detected. Looking for test scripts...');
            const pkg = JSON.parse(fs.readFileSync(path.join(CONFIG.workspace, 'package.json')));
            
            if (pkg.scripts && pkg.scripts.test) {
                console.log('🏃 Executing: npm test');
                try {
                    execSync('npm test', { stdio: 'inherit', cwd: CONFIG.workspace });
                    results.tests.push({ name: 'NPM Test Suite', status: 'passed' });
                } catch (e) {
                    results.tests.push({ name: 'NPM Test Suite', status: 'failed', error: e.message });
                }
            }
        }

        // 2. Structural Integrity Check
        console.log('🏗️ Checking Project Structure...');
        const essentialFiles = ['README.md', '.gitignore'];
        essentialFiles.forEach(file => {
            const exists = fs.existsSync(path.join(CONFIG.workspace, file));
            results.tests.push({ name: `File check: ${file}`, status: exists ? 'passed' : 'failed' });
        });

        // Final Synthesis
        results.summary.total = results.tests.length;
        results.summary.passed = results.tests.filter(t => t.status === 'passed').length;
        results.summary.failed = results.summary.total - results.summary.passed;

        fs.writeFileSync(CONFIG.reportPath, JSON.stringify(results, null, 2));
        
        if (results.summary.failed > 0) {
            console.error(`❌ Harness failed: ${results.summary.failed} tests failed.`);
            process.exit(1);
        }

        console.log('✅ Harness passed: System state is consistent.');
        process.exit(0);

    } catch (criticalError) {
        console.error('💥 Critical failure in Harness:', criticalError.message);
        process.exit(1);
    }
}

runTests();
