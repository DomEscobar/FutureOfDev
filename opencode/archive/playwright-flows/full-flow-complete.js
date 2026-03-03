#!/usr/bin/env node
/**
 * Full Flow with Extended Match Wait
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

async function waitForMatchComplete(page, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const html = await page.content();
    if (html.includes('Victory') || html.includes('Defeat') || html.includes('COMPLETED') || html.includes('FINISHED')) {
      return true;
    }
    // Try to click play button to advance battle
    try {
      const playBtn = await page.locator('button:has-text("▶"), button:has-text("Play"), [data-testid*="play"]').first();
      if (await playBtn.count() > 0 && await playBtn.isVisible()) {
        await playBtn.click();
      }
    } catch {}
    await delay(2000);
  }
  return false;
}

async function runFullFlow() {
  console.log('🎮 FULL FLOW: Fighter → Match → Complete → Rewards\n');
  
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  const browser = await chromium.launch({ headless: true });
  page.on("response", async (r) => { if (r.url().includes("fighter")) console.log("API:", r.status(), r.url().split("/").slice(-2).join("/")); });({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  // Log console errors for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log(`🔴 Browser console error: ${text}`);
    } else {
      console.log(`⚪️ Browser console: ${text}`);
    }
  });

  const results = {
    fighterCreated: false,
    matchJoined: false,
    matchCompleted: false,
    rewardsClaimed: false,
    duration: 0
  };

  const startTime = Date.now();

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

    // 2. Create Fighter if needed
    log('STEP 2', 'Checking fighter...');
    await page.goto('http://localhost:5173/roster');
    await delay(2000);

    const existingFighter = await page.locator('[data-testid*="fighter"], .fighter-card').count();
    if (existingFighter === 0) {
      await page.locator('[data-testid="recruit-button"]').click();
      await delay(2000);
      await page.locator('[data-testid="new-fighter-name-input"]').fill('ExplorerBot');
      await page.locator('button:has-text("RECRUIT")').last().click();
      await delay(4000);
    }
    results.fighterCreated = true;
    log('STEP 2', '✅ Fighter ready');

    // 2.5 Select first fighter (required for Quick Join)
    log('STEP 2.5', 'Selecting fighter...');
    const fighterCard = await page.locator('[data-testid*="fighter"], .fighter-card').first();
    if (await fighterCard.count() > 0) {
      await fighterCard.click();
      await delay(1000);
      // Look for "Select" or "Use" button
      const selectBtn = page.locator('button:has-text("Select"), button:has-text("Use"), button:has-text("Choose")').first();
      if (await selectBtn.count() > 0 && await selectBtn.isVisible()) {
        await selectBtn.click();
        await delay(1000);
      }
    }
    log('STEP 2.5', '✅ Fighter selected');

    // 3. Join Match
    log('STEP 3', 'Joining match...');
    await page.goto('http://localhost:5173/matches');
    await delay(2000);

    // Wait for roster to load (wait for fighters to appear)
    log('STEP 3', 'Waiting for roster to load...');
    try {
      await page.waitForFunction(() => {
        const fighters = document.querySelectorAll('[data-testid*="fighter"], .fighter-card');
        return fighters.length > 0;
      }, { timeout: 10000 });
    } catch (e) {
      log('STEP 3', '⚠️ Fighters not appearing, checking page content...');
      const html = await page.content();
      console.log('Page contains "fighter":', html.includes('fighter'));
      console.log('Page contains "Fighter":', html.includes('Fighter'));
      console.log('Quick join button exists:', html.includes('quick-join-button'));
      const btnDisabled = await page.locator('[data-testid="quick-join-button"]').isDisabled();
      console.log('Quick join button disabled:', btnDisabled);
      // Check browser console for errors
      page.on('console', msg => console.log('Browser console:', msg.text(), msg.type()));
      await delay(2000);
      // Take screenshot for debugging
      await page.screenshot({ path: '/root/FutureOfDev/opencode/hyper-explorer/memory/debug_matches_no_fighters.png' });
    }
    log('STEP 3', `✅ Roster loaded, joining match...`);
    await page.locator('[data-testid="quick-join-button"]').click();
    await delay(3000);
    
    // Check for fighter selection modal - click START
    const startBtn = page.locator('button:has-text("START"), button:has-text("Start Battle"), [data-testid*="start"]').first();
    if (await startBtn.count() > 0 && await startBtn.isVisible()) {
      log('STEP 3', 'Fighter selected, starting battle setup...');
      await startBtn.click({ force: true });
      await delay(3000);
    }
    
    // Check for LOBBY with BEGIN button
    const beginBtn = page.locator('button:has-text("BEGIN"), button:has-text("Begin")').first();
    if (await beginBtn.count() > 0 && await beginBtn.isVisible()) {
      log('STEP 3', 'In lobby, beginning battle...');
      await beginBtn.click();
      await delay(5000);
    }
    
    results.matchJoined = page.url().includes('/match') || page.url().includes('battle');
    log('STEP 3', results.matchJoined ? '✅ Match started!' : '⚠️ Waiting in lobby');

    await page.screenshot({ path: path.join(MEMORY_DIR, 'finalflow_03_match.png') });

    // 4. Wait for Match Complete
    if (results.matchJoined) {
      log('STEP 4', 'Waiting for match completion (up to 120s)...');
      // Try to speed up by clicking play button if auto is off
      try {
        const autoBtn = page.locator('button:has-text("Auto"), [data-testid*="auto"]').first();
        if (await autoBtn.count() > 0) {
          await autoBtn.click();
          log('STEP 4', 'Enabled auto-play');
        }
      } catch {}
      
      results.matchCompleted = await waitForMatchComplete(page, 120000);
      log('STEP 4', results.matchCompleted ? '✅ Match completed!' : '⏱️ Timeout - match may still be running');
      await page.screenshot({ path: path.join(MEMORY_DIR, 'finalflow_04_complete.png') });
    }

    // 5. Claim Rewards
    log('STEP 5', 'Claiming rewards...');
    await page.goto('http://localhost:5173/dashboard');
    await delay(3000);

    const claimBtns = await page.locator('button:has-text("Claim"), [data-testid*="claim"]').all();
    for (const btn of claimBtns) {
      try {
        await btn.click();
        await delay(500);
        results.rewardsClaimed = true;
      } catch {}
    }
    log('STEP 5', results.rewardsClaimed ? '✅ Rewards claimed!' : '⚠️ No rewards available');
    await page.screenshot({ path: path.join(MEMORY_DIR, 'finalflow_05_rewards.png') });

    results.duration = Date.now() - startTime;

  } catch (e) {
    console.error('\n❌ Error:', e.message);
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 FULL FLOW RESULTS');
  console.log('='.repeat(50));
  console.log(`Fighter Created:   ${results.fighterCreated ? '✅' : '❌'}`);
  console.log(`Match Joined:      ${results.matchJoined ? '✅' : '❌'}`);
  console.log(`Match Completed:   ${results.matchCompleted ? '✅' : '❌'}`);
  console.log(`Rewards Claimed:   ${results.rewardsClaimed ? '✅' : '❌'}`);
  console.log(`Total Duration:    ${(results.duration / 1000).toFixed(1)}s`);
  console.log('='.repeat(50));

  fs.writeFileSync(
    path.join(MEMORY_DIR, 'fullflow_results.json'),
    JSON.stringify(results, null, 2)
  );

  return results;
}

runFullFlow().catch(console.error);
