#!/usr/bin/env node
/**
 * Hyper-Explorer CLI
 * 
 * Usage:
 *   ./explore.js <url> <goal>
 *   ./explore.js http://localhost:5173 register_new_user_complete_flow
 *   ./explore.js http://localhost:5173 login_existing_user_successful_login
 *   ./explore.js http://localhost:5173 start_and_complete_match
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Hyper-Explorer CLI

Usage:
  ./explore.js <url> <goal>

Goals:
  register_new_user_complete_flow    Register new user
  login_existing_user_successful_login  Login with saved credentials
  create_fighter_squad               Create a squad
  start_and_complete_match           Play a match

Examples:
  ./explore.js http://localhost:5173 register_new_user_complete_flow
  ./explore.js http://localhost:5173 login_existing_user_successful_login
  ./explore.js http://localhost:5173 start_and_complete_match
  `);
  process.exit(1);
}

const [url, goal] = args;
const explorerPath = path.join(__dirname, 'src', 'hyper-explorer.mjs');

console.log(`🚀 Starting Hyper-Explorer...`);
console.log(`   URL: ${url}`);
console.log(`   Goal: ${goal}\n`);

const proc = spawn('node', [explorerPath, url, goal], {
  stdio: 'inherit',
  cwd: __dirname
});

proc.on('close', (code) => {
  process.exit(code);
});
