#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const HYPER = path.join(__dirname, 'hyper-explorer.mjs');
const URL = 'http://localhost:5173';

const STEPS = [
  { id: 'REG', goal: 'register_new_user_complete_flow' },
  { id: 'LOG', goal: 'login_existing_user_successful_login' },
  { id: 'SQUAD', goal: 'create_fighter_squad' },
  { id: 'MATCH1', goal: 'start_and_complete_match' },
  { id: 'MATCH2', goal: 'start_and_complete_match' },
  { id: 'MATCH3', goal: 'start_and_complete_match' }
];

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('FULL FLOW TEST');
  console.log('='.repeat(60) + '\n');

  const memDir = path.join(__dirname, 'roster/player/memory');
  try {
    require('fs').unlinkSync(path.join(memDir, 'knowledge_graph.json'));
    console.log('Cleared old graph\n');
  } catch (e) {}

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    console.log(`\nSTEP ${i+1}/${STEPS.length}: ${step.id} - ${step.goal}\n`);
    
    const proc = spawn('node', [HYPER, URL, step.goal], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    await new Promise(resolve => {
      proc.on('close', resolve);
    });

    if (i < STEPS.length - 1) {
      await new Promise(r => setTimeout(r, 8000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('ALL STEPS COMPLETE');
  console.log('='.repeat(60) + '\n');
}

run().catch(console.error);
