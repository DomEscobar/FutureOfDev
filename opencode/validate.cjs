#!/usr/bin/env node
/**
 * Agency Validation Script
 * Tests syntax, file structure, and basic functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;

console.log('🧪 Agency Validation Suite\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

// ============================================
// SYNTAX TESTS
// ============================================
console.log('--- SYNTAX ---');

test('All .cjs files have valid syntax', () => {
    const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.cjs'));
    if (files.length === 0) throw new Error('No .cjs files found');
    
    for (const file of files) {
        execSync(`node --check ${path.join(ROOT, file)}`, { stdio: 'pipe' });
    }
});

// ============================================
// STRUCTURE TESTS
// ============================================
console.log('\n--- STRUCTURE ---');

test('Required files exist', () => {
    const required = [
        'orchestrator.cjs',
        'dev-unit.cjs',
        'telegram-control.cjs',
        'ALIGNMENT.md',
        'DEV_UNIT.md',
        'tasks.json',
        'config.json'
    ];
    
    for (const file of required) {
        if (!fs.existsSync(path.join(ROOT, file))) {
            throw new Error(`Missing: ${file}`);
        }
    }
});

test('tasks.json is valid JSON', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'tasks.json'), 'utf8'));
    if (!Array.isArray(data.tasks)) throw new Error('tasks.json must have tasks array');
});

test('config.json has required fields', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
    if (!config.TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');
    if (!config.TELEGRAM_CHAT_ID) throw new Error('Missing TELEGRAM_CHAT_ID');
    if (!config.OPENCODE_BIN) throw new Error('Missing OPENCODE_BIN');
});

// ============================================
// DEV-UNIT TESTS
// ============================================
console.log('\n--- DEV-UNIT FUNCTIONS ---');

test('dev-unit.cjs has required functions', () => {
    const code = fs.readFileSync(path.join(ROOT, 'dev-unit.cjs'), 'utf8');
    const requiredFunctions = [
        'validatePlan',
        'checkInfrastructure',
        'detectTaskComplexity',
        'getFilesSnapshot',
        'computeFileDiff',
        'runOpencode'
    ];
    
    for (const fn of requiredFunctions) {
        if (!code.includes(`function ${fn}`)) {
            throw new Error(`Missing function: ${fn}`);
        }
    }
});

test('dev-unit.cjs has complexity detection', () => {
    const code = fs.readFileSync(path.join(ROOT, 'dev-unit.cjs'), 'utf8');
    if (!code.includes('needsEnhancedPlanning')) {
        throw new Error('Missing needsEnhancedPlanning flag');
    }
});

// ============================================
// ORCHESTRATOR TESTS
// ============================================
console.log('\n--- ORCHESTRATOR ---');

test('orchestrator.cjs has state machine', () => {
    const code = fs.readFileSync(path.join(ROOT, 'orchestrator.cjs'), 'utf8');
    const states = ['pending', 'in_progress', 'review', 'completed'];
    
    for (const state of states) {
        if (!code.includes(state)) {
            throw new Error(`Missing state: ${state}`);
        }
    }
});

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
    console.log('\n✅ Agency validation complete. All systems operational.');
    process.exit(0);
} else {
    console.log('\n❌ Agency has issues. Fix before deployment.');
    process.exit(1);
}
