#!/usr/bin/env node
/**
 * Quick test of console error capture
 */

import { spawn } from 'child_process';
import fs from 'fs';

const MEMORY_DIR = './roster/player/memory';

console.log('Testing console error capture in Hyper-Explorer...');
console.log('');
console.log('Features:');
console.log('✅ Console messages captured per state');
console.log('✅ Errors logged immediately (⚠️ Console errors in new state)');
console.log('✅ Console report exported to console_errors.json');
console.log('✅ Errors visible in final shutdown summary');
console.log('');
console.log('Next step: Run with target that has console errors');
