#!/usr/bin/env node
/**
 * Working Flow: Fighter → Match → Rewards
 * Handles modal overlays properly
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, 'memory');
const CREDENTIALS_FILE = path.join(MEMORY_DIR, 'credentials.json');

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function log(step, msg) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${step} ${msg}`);
}

async function runFlow() {
  console.log('🎮 COMPLETE FLOW: Fighter → Match → Rewards\n');
  
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const results = {
    fighterCreated: false,
    matchJoined: false,
    matchWatched: false,
    rewardsClaimed: false
  };

  try {
    // 1. Login
    log('STEP 1', 'Logging in...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await delay(1000);
    
    const inputs = await page.locator('input').all();
    await inputs[0].fill(credentials.email);
    await inputs[1].fill(credentials.password);
    await page.locator('button').first().click();
    await delay(3000);
    log('STEP 1', '✅ Logged in');

    // 2. Create Fighter (fill form directly)
    log('STEP 2', 'Creating fighter...');
    await page.goto('http://localhost:5173/roster');
    await delay(2000);

    // Check if fighter already exists
    const existingFighter = await page.locator('[data-testid*="fighter"], .fighter-card').count();
    if (existingFighter > 0) {
      results.fighterCreated = true;
      log('STEP 2', '✅ Fighter already exists');
    } else {
      // Click RECRUIT to open modal
      const recruitBtn = page.locator('[data-testid="recruit-button"], [data-testid="recruit-first-button"]').first();
      await recruitBtn.click();
      await delay(2000);
      
      // Fill the form directly
      const nameInput = page.locator('[data-testid="new-fighter-name-input"]');
      await nameInput.fill('ExplorerBot');
      await delay(500);
      
      // Click RECRUIT button (the one that submits the form)
      const submitRecruitBtn = page.locator('button:has-text("RECRUIT")').last();
      await submitRecruitBtn.click();
      await delay(4000);
      
      results.fighterCreated = true;
      log('STEP 2', '✅ Fighter created');
    }
    
    await page.goto('http://localhost:5173/roster');
    await delay(2000);
    await page.screenshot({ path: path.join(MEMORY_DIR, 'complete_02_roster.png') });

    // 3. Join Match
    log('STEP 3', 'Joining match...');
    await page.goto('http://localhost:5173/matches');
    await delay(2000);

    const quickJoinBtn = page.locator('[data-testid="quick-join-button"]');
    const isEnabled = await quickJoinBtn.isEnabled().catch(() => false);
    
    if (isEnabled) {
      await quickJoinBtn.click();
      await delay(5000);
      results.matchJoined = page.url().includes('/match/');
      log('STEP 3', results.matchJoined ? `✅ Joined: ${page.url()}` : '❌ Failed');
      await page.screenshot({ path: path.join(MEMORY_DIR, 'complete_03_match.png') });
    } else {
      log('STEP 3', '⚠️ Quick Join disabled');
    }

    // 4. Watch Match
    if (results.matchJoined) {
      log('STEP 4', 'Watching match...');
      await delay(10000);
      const html = await page.content();
      results.matchWatched = html.includes('Victory') || html.includes('Defeat') || html.includes('COMPLETED');
      log('STEP 4', results.matchWatched ? '✅ Match completed' : '⏳ In progress');
      await page.screenshot({ path: path.join(MEMORY_DIR, 'complete_04_match_end.png') });
    }

    // 5. Rewards
    log('STEP 5', 'Checking rewards...');
    await page.goto('http://localhost:5173/dashboard');
    await delay(2000);

    const claimBtns = await page.locator('button:has-text("Claim")').all();
    if (claimBtns.length > 0) {
      await claimBtns[0].click();
      await delay(1000);
      results.rewardsClaimed = true;
      log('STEP 5', '✅ Rewards claimed');
    } else {
      log('STEP 5', '⚠️ No rewards to claim');
    }
    await page.screenshot({ path: path.join(MEMORY_DIR, 'complete_05_rewards.png') });

    // Summary
    console.log('\n' + '='.repeat(40));
    console.log('📊 FLOW COMPLETE');
    console.log('='.repeat(40));
    console.log(`Fighter:  ${results.fighterCreated ? '✅' : '❌'}`);
    console.log(`Match:    ${results.matchJoined ? '✅' : '❌'}`);
    console.log(`Complete: ${results.matchWatched ? '✅' : '❌'}`);
    console.log(`Rewards:  ${results.rewardsClaimed ? '✅' : '❌'}`);

    fs.writeFileSync(
      path.join(MEMORY_DIR, 'complete_results.json'),
      JSON.stringify(results, null, 2)
    );

  } catch (e) {
    console.error('\n❌ Error:', e.message);
    await page.screenshot({ path: path.join(MEMORY_DIR, 'complete_error.png') });
  } finally {
    await browser.close();
  }
}

runFlow().catch(console.error);
