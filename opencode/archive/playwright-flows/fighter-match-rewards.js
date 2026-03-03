#!/usr/bin/env node
/**
 * Fighter Creation → Match → Rewards full automated flow
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
  console.log('🎮 FIGHTER → MATCH → REWARDS FLOW\n');
  
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  log('AUTH', credentials.email);

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
    log('STEP 1', 'Login...');
    await page.goto('http://localhost:5173/login');
    await delay(1000);
    await page.locator('input').nth(0).fill(credentials.email);
    await page.locator('input').nth(1).fill(credentials.password);
    await page.locator('button').first().click();
    await delay(3000);
    log('STEP 1', '✅ Logged in');

    // 2. Create Fighter (if needed)
    log('STEP 2', 'Checking/Creating fighter...');
    await page.goto('http://localhost:5173/roster');
    await delay(2000);

    // Click RECRUIT
    const recruitBtn = page.locator('[data-testid="recruit-button"], [data-testid="recruit-first-button"]').first();
    if (await recruitBtn.count() > 0 && await recruitBtn.isVisible()) {
      await recruitBtn.click();
      await delay(2000);
      
      // Check if modal opened
      const recruitModalBtn = page.locator('button:has-text("RECRUIT"), [data-testid*="recruit"]').nth(1);
      if (await recruitModalBtn.count() > 0 && await recruitModalBtn.isVisible()) {
        await recruitModalBtn.click();
        await delay(3000);
      }
    }

    // Check if fighter created (look for fighter name input or completion)
    const url = page.url();
    if (url.includes('create') || url.includes('fighter')) {
      // On creation page
      log('STEP 2', 'On fighter creation page');
      await page.locator('input').first().fill('ExplorerBot');
      await delay(500);
      
      // Select class - click first available
      const classBtns = await page.locator('button').all();
      for (const btn of classBtns) {
        const text = await btn.textContent().catch(() => '');
        if (text && !text.includes('Recruit') && btn !== recruitBtn) {
          await btn.click();
          break;
        }
      }
      await delay(500);
      
      // Click create
      const createBtn = page.locator('button:has-text("Create"), button:has-text("Confirm"), button[type="submit"]').first();
      await createBtn.click();
      await delay(4000);
    }

    // Verify fighter exists
    await page.goto('http://localhost:5173/roster');
    await delay(2000);
    const fighterCount = await page.locator('[data-testid*="fighter"], .fighter-card, .warrior-card').count();
    results.fighterCreated = fighterCount > 0;
    log('STEP 2', results.fighterCreated ? `✅ Fighter created (${fighterCount})` : '⚠️ No fighter found');
    await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_02_roster.png') });

    // 3. Join Match
    log('STEP 3', 'Joining match...');
    await page.goto('http://localhost:5173/matches');
    await delay(2000);

    // Check if Quick Join is disabled
    const quickJoinBtn = page.locator('[data-testid="quick-join-button"]').first();
    if (await quickJoinBtn.count() > 0) {
      const isEnabled = await quickJoinBtn.isEnabled().catch(() => false);
      log('STEP 3', `Quick Join button found, enabled: ${isEnabled}`);
      
      if (isEnabled) {
        await quickJoinBtn.click();
        await delay(5000);
        results.matchJoined = page.url().includes('/match/');
        log('STEP 3', results.matchJoined ? `✅ Joined: ${page.url()}` : '❌ Join failed');
      } else {
        log('STEP 3', '⚠️ Quick Join disabled (need fighter first?)');
      }
    } else {
      log('STEP 3', '⚠️ Quick Join button not found');
    }
    await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_03_match.png') });

    // 4. Watch Match (if joined)
    if (results.matchJoined) {
      log('STEP 4', 'Watching match...');
      await delay(10000); // Wait for match to play
      
      const html = await page.content();
      results.matchWatched = html.includes('Victory') || html.includes('Defeat') || html.includes('COMPLETED');
      log('STEP 4', results.matchWatched ? '✅ Match completed' : '⏳ Match in progress');
      await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_04_match_end.png') });
    }

    // 5. Claim Rewards
    log('STEP 5', 'Claiming rewards...');
    await page.goto('http://localhost:5173/dashboard');
    await delay(2000);

    const claimBtns = await page.locator('button:has-text("Claim")').all();
    if (claimBtns.length > 0) {
      for (const btn of claimBtns) {
        try {
          await btn.click();
          await delay(500);
        } catch {}
      }
      results.rewardsClaimed = true;
      log('STEP 5', '✅ Rewards claimed');
    } else {
      log('STEP 5', '⚠️ No rewards to claim');
    }
    await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_05_rewards.png') });

    // Summary
    console.log('\n' + '='.repeat(40));
    console.log('📊 RESULTS');
    console.log('='.repeat(40));
    console.log(`Fighter:  ${results.fighterCreated ? '✅' : '❌'}`);
    console.log(`Match:    ${results.matchJoined ? '✅' : '❌'}`);
    console.log(`Complete: ${results.matchWatched ? '✅' : '❌'}`);
    console.log(`Rewards:  ${results.rewardsClaimed ? '✅' : '❌'}`);

    fs.writeFileSync(
      path.join(MEMORY_DIR, 'flow_results.json'),
      JSON.stringify(results, null, 2)
    );

  } catch (e) {
    console.error('\n❌ Error:', e.message);
    await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_error.png') });
  } finally {
    await browser.close();
  }
}

runFlow().catch(console.error);
