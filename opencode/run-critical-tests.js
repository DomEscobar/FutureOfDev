#!/usr/bin/env node

/**
 * EmpoweredPixels Critical Test Suite Runner
 * Runs 7 critical flows via Hyper-Explorer
 * 
 * Usage: node run-critical-tests.js
 */

const { spawn } = require('child_process');
const path = require('path');

const HYPER_EXPLORER = path.join(__dirname, 'hyper-explorer.mjs');
const FRONTEND_URL = 'http://localhost:5173';

// Critical flows from TEST_FLOWS.md (7 tests)
const CRITICAL_GOALS = [
  {
    id: 'TF-001',
    name: 'Complete Registration Flow',
    goal: 'register_new_user_complete_flow',
    description: 'Navigate to /register, fill form, submit, verify redirect to /dashboard'
  },
  {
    id: 'TF-002',
    name: 'Existing User Login',
    goal: 'login_existing_user_successful_login',
    description: 'Navigate to /login, enter credentials, submit, verify redirect to /dashboard'
  },
  {
    id: 'TF-004',
    name: 'Full Site Navigation',
    goal: 'navigate_all_authenticated_pages',
    description: 'Click through: dashboard → roster → matches → inventory → leagues → squads → home'
  },
  {
    id: 'TF-006',
    name: 'Protected Route Redirect',
    goal: 'verify_auth_guard_redirects',
    description: 'Directly access protected routes while not logged in → expect redirect to /login'
  },
  {
    id: 'TF-007',
    name: 'Dashboard Data Load',
    goal: 'dashboard_displays_user_data_correctly',
    description: 'Verify fighter stats, recent matches, league standings, inventory summary load'
  },
  {
    id: 'TF-009',
    name: 'View Fighter Roster',
    goal: 'view_full_fighter_roster',
    description: 'Navigate to /roster, verify all fighter cards, stats, levels, equipment'
  },
  {
    id: 'TF-013',
    name: 'Start New Match',
    goal: 'initiate_and_start_combat_match',
    description: 'Navigate to /matches, click new match, select fighter & opponent, start match'
  }
];

async function runTestSuite() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('EMPOWEREDPIXELS CRITICAL TEST SUITE');
  console.log(`Hyper-Explorer: ${HYPER_EXPLORER}`);
  console.log(`Target: ${FRONTEND_URL}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`📋 Test Plan: ${CRITICAL_GOALS.length} critical flows\n`);

  for (let i = 0; i < CRITICAL_GOALS.length; i++) {
    const test = CRITICAL_GOALS[i];
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`TEST ${i + 1}/${CRITICAL_GOALS.length}: ${test.id} - ${test.name}`);
    console.log(`Goal: ${test.goal}`);
    console.log(`─`.repeat(60));

    // Run hyper-explorer for this single goal
    // hyper-explorer.mjs expects: <URL> <goal>
    // Default config: maxSubtaskSteps=8, maxReplans=3
    const args = [
      FRONTEND_URL,
      test.goal
    ];

    console.log(`\n▶️  Running: node hyper-explorer.mjs ${args[0]} ${args[1]}\n`);

    const proc = spawn('node', [HYPER_EXPLORER, ...args], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    proc.on('close', (code) => {
      console.log(`\n✅ Test ${test.id} completed with exit code: ${code}`);
      
      // Check for bugs filed
      const playerBugs = path.join(__dirname, 'roster/player/memory/player_bugs.jsonl');
      // Could analyze results here...
      
      // Continue to next test
      if (i < CRITICAL_GOALS.length - 1) {
        console.log(`\n⏳ Waiting 3s before next test...`);
        setTimeout(() => {}, 3000);
      } else {
        console.log(`\n${'='.repeat(60)}`);
        console.log('ALL CRITICAL TESTS COMPLETE');
        console.log(`${'='.repeat(60)}\n`);
      }
    });

    proc.on('error', (err) => {
      console.error(`❌ Failed to start test ${test.id}:`, err.message);
      process.exit(1);
    });

    // Wait for this test to finish before starting next
    await new Promise((resolve) => {
      proc.on('close', resolve);
    });
  }
}

// Run sequentially
runTestSuite().catch(console.error);
