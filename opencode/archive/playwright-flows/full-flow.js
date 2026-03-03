#!/usr/bin/env node
/**
 * Create Fighter → Join Match → Claim Rewards Flow
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

async function runFullFlow() {
  console.log('🎮 FULL FLOW: Create Fighter → Join Match → Claim Rewards\n');
  
  // Load credentials
  let credentials = null;
  try {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    log('AUTH', `Using credentials: ${credentials.email}`);
  } catch {
    log('AUTH', '❌ No credentials found. Run register flow first.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  const results = {
    fighterCreated: false,
    matchJoined: false,
    matchCompleted: false,
    rewardsClaimed: false,
    errors: []
  };

  try {
    // STEP 1: Login
    log('STEP 1', 'Logging in...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await delay(1000);
    
    // Find and fill email
    const emailInput = await page.locator('input').first();
    await emailInput.fill(credentials.email);
    
    // Find and fill password  
    const inputs = await page.locator('input').all();
    if (inputs.length > 1) await inputs[1].fill(credentials.password);
    
    // Click submit
    const submitBtn = await page.locator('button').first();
    await submitBtn.click();
    await delay(3000);
    
    if (!page.url().includes('dashboard')) {
      throw new Error('Login failed');
    }
    log('STEP 1', '✅ Logged in');

    // STEP 2: Create Fighter
    log('STEP 2', 'Creating fighter...');
    await page.goto('http://localhost:5173/roster');
    await delay(2000);
    
    await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_before_recruit.png') });
    
    // Click RECRUIT FIRST WARRIOR
    log('STEP 2', 'Looking for RECRUIT button...');
    
    // Try multiple selectors
    const recruitSelectors = [
      'button:has-text("RECRUIT")',
      'button:has-text("RECRUIT FIRST WARRIOR")', 
      'button:has-text("Recruit")',
      '[data-testid*="recruit"]',
      'button:has-text("+ RECRUIT")',
      'button:has-text("+ RECRUIT")'
    ];
    
    let recruitBtn = null;
    for (const sel of recruitSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible()) {
        recruitBtn = btn;
        log('STEP 2', `Found button with: ${sel}`);
        break;
      }
    }
    
    if (recruitBtn) {
      await recruitBtn.click();
      await delay(3000);
      
      log('STEP 2', `After recruit click: ${page.url()}`);
      await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_after_recruit_click.png') });
      
      // Check if we're on create fighter page
      if (page.url().includes('create') || page.url().includes('recruit') || page.url().includes('fighter')) {
        log('STEP 2', 'On fighter creation page');
        
        // Fill fighter name
        const nameInput = await page.locator('input').first();
        await nameInput.fill('ExplorerBot');
        
        // Select class if options exist
        const classBtns = await page.locator('button').all();
        log('STEP 2', `Found ${classBtns.length} buttons on creation page`);
        
        // Try clicking what looks like class buttons (first few)
        for (const btn of classBtns.slice(0, 3)) {
          try {
            const text = await btn.textContent();
            log('STEP 2', `Trying button: ${text}`);
            if (text && (text.includes('Warrior') || text.includes('Mage') || text.includes('Rogue'))) {
              await btn.click();
              await delay(500);
              break;
            }
          } catch {}
        }
        
        // Click create/submit - look for buttons with create/submit text or just click the last button
        const allBtns = await page.locator('button').all();
        for (const btn of allBtns.reverse()) {
          try {
            const text = await btn.textContent();
            if (text && (text.toLowerCase().includes('create') || text.toLowerCase().includes('submit') || text.toLowerCase().includes('confirm'))) {
              await btn.click();
              log('STEP 2', `Clicked: ${text}`);
              break;
            }
          } catch {}
        }
        
        await delay(5000);
        log('STEP 2', `After creation: ${page.url()}`);
        
        results.fighterCreated = page.url().includes('roster') || page.url().includes('dashboard');
        log('STEP 2', results.fighterCreated ? '✅ Fighter created' : '⚠️ Fighter creation status unclear');
        
        await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_fighter_created.png') });
      } else {
        log('STEP 2', 'Not on creation page, checking if fighter exists...');
        // Maybe already has fighter
        results.fighterCreated = await page.locator('.fighter, .warrior, [data-testid*="fighter"]').count() > 0;
      }
    } else {
      log('STEP 2', 'No recruit button found, checking for existing fighter...');
      const hasFighter = await page.locator('.fighter, .warrior, [data-testid*="fighter"], .fighter-card').count() > 0;
      if (hasFighter) {
        results.fighterCreated = true;
        log('STEP 2', '✅ Fighter already exists');
      } else {
        log('STEP 2', '❌ No fighter and no recruit button');
        results.errors.push('Cannot create fighter - no recruit button');
      }
    }

    // STEP 3: Join Match
    log('STEP 3', 'Joining match...');
    await page.goto('http://localhost:5173/matches');
    await delay(2000);
    
    // Try QUICK JOIN
    const quickJoinBtn = await page.locator('button:has-text("QUICK JOIN"), button:has-text("Quick Join"), [data-testid*="quick"]').first();
    if (await quickJoinBtn.count() > 0) {
      await quickJoinBtn.click();
      await delay(5000);
      
      results.matchJoined = page.url().includes('/match/') || page.url().includes('match?id=');
      log('STEP 3', results.matchJoined ? `✅ Joined match: ${page.url()}` : '⚠️ Match join unclear');
      
      await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_match_joined.png') });
      
      // If in match, wait for completion
      if (results.matchJoined) {
        log('STEP 3', 'Waiting for match...');
        await delay(10000); // Wait for match to process
        
        // Check for victory/defeat
        const html = await page.content();
        results.matchCompleted = html.includes('Victory') || html.includes('Defeat') || html.includes('COMPLETED');
        log('STEP 3', results.matchCompleted ? '✅ Match completed' : '⏳ Match status unknown');
        
        await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_match_complete.png') });
      }
    } else {
      log('STEP 3', '❌ Quick Join button not found');
      results.errors.push('Quick Join button not found');
    }

    // STEP 4: Claim Rewards
    log('STEP 4', 'Claiming rewards...');
    await page.goto('http://localhost:5173/dashboard');
    await delay(2000);
    
    // Look for claim buttons
    const claimBtns = await page.locator('button:has-text("Claim"), button:has-text("CLAIM"), [data-testid*="claim"]').all();
    if (claimBtns.length > 0) {
      for (const btn of claimBtns.slice(0, 3)) { // Try first 3
        try {
          await btn.click();
          await delay(1000);
        } catch {}
      }
      results.rewardsClaimed = true;
      log('STEP 4', '✅ Rewards claimed');
    } else {
      log('STEP 4', '⚠️ No claim buttons found (may already be claimed)');
    }
    
    await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_rewards.png') });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 FLOW RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Fighter Created: ${results.fighterCreated}`);
    console.log(`✅ Match Joined: ${results.matchJoined}`);
    console.log(`✅ Match Completed: ${results.matchCompleted}`);
    console.log(`✅ Rewards Claimed: ${results.rewardsClaimed}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ Errors:');
      results.errors.forEach(e => console.log(`  - ${e}`));
    }
    
    // Save results
    fs.writeFileSync(
      path.join(MEMORY_DIR, 'full_flow_results.json'),
      JSON.stringify(results, null, 2)
    );
    
    const allSuccess = results.fighterCreated && results.matchJoined && results.matchCompleted;
    console.log(`\n${allSuccess ? '🎉' : '⚠️'} Flow ${allSuccess ? 'COMPLETE' : 'PARTIAL'}`);

  } catch (e) {
    console.error('\n❌ Flow error:', e.message);
    await page.screenshot({ path: path.join(MEMORY_DIR, 'flow_error.png') });
  } finally {
    await browser.close();
  }
}

runFullFlow().catch(console.error);
