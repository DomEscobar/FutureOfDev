#!/usr/bin/env node
/**
 * Deep Feature Exploration - Matches, Rewards, Vault, Equipment
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

async function exploreFeatures() {
  console.log('🔍 Deep Feature Exploration\n');
  
  // Load credentials
  let credentials = null;
  try {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    console.log(`Using credentials: ${credentials.email}`);
  } catch {
    console.log('❌ No credentials found. Run register flow first.');
    return;
  }

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  const findings = {
    timestamp: new Date().toISOString(),
    pages: {},
    matches: null,
    vault: null,
    equipment: null,
    rewards: null,
    screenshots: []
  };

  try {
    // 1. Login
    console.log('\n1️⃣ Logging in...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await delay(1000);
    
    // Try multiple selectors for email input
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      'input[id*="email" i]',
      'input'  // fallback
    ];
    
    let emailInput = null;
    for (const sel of emailSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0 && await el.isVisible()) {
          emailInput = el;
          console.log(`   Found email input: ${sel}`);
          break;
        }
      } catch {}
    }
    
    if (!emailInput) {
      console.log('   ⚠️ Email input not found, trying snapshot...');
      const snapshot = await page.accessibility.snapshot();
      console.log('   Page snapshot:', JSON.stringify(snapshot.children?.slice(0, 5), null, 2));
      throw new Error('Email input not found');
    }
    
    await emailInput.fill(credentials.email);
    
    // Find password input
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(credentials.password);
    
    // Find submit button
    const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), button:has-text("Log in"), button').first();
    await submitBtn.click();
    await delay(3000);
    
    const dashboardUrl = page.url();
    console.log(`   Dashboard: ${dashboardUrl}`);
    findings.pages.dashboard = dashboardUrl;

    // 2. Explore Matches Page
    console.log('\n2️⃣ Exploring Matches...');
    await page.goto('http://localhost:5173/matches');
    await delay(2000);
    
    const matchesHtml = await page.content();
    let matchesSnapshot = { children: [] };
    try {
      matchesSnapshot = await page.accessibility.snapshot() || { children: [] };
    } catch {}
    const snapshotChildren = matchesSnapshot.children || [];
    
    findings.matches = {
      url: page.url(),
      title: await page.title(),
      buttons: snapshotChildren.filter(c => c.role === 'button').map(b => b.name),
      links: snapshotChildren.filter(c => c.role === 'link').map(l => l.name),
      hasQuickJoin: matchesHtml.includes('Quick Join'),
      hasCreateMatch: matchesHtml.includes('Create Match')
    };
    
    console.log(`   Buttons: ${findings.matches.buttons.join(', ')}`);
    console.log(`   Quick Join: ${findings.matches.hasQuickJoin ? '✅' : '❌'}`);
    
    await page.screenshot({ path: path.join(MEMORY_DIR, 'explore_matches.png') });
    findings.screenshots.push('explore_matches.png');

    // Try to join a match
    console.log('   Attempting Quick Join...');
    try {
      const quickJoinBtn = await page.locator('text=Quick Join, button:has-text("Quick Join"), [data-testid*="quick"]').first();
      if (await quickJoinBtn.count() > 0) {
        await quickJoinBtn.click({ timeout: 5000 });
        await delay(4000);
        
        findings.matches.joinResult = {
          url: page.url(),
          success: page.url().includes('/match/')
        };
        
        if (findings.matches.joinResult.success) {
          console.log(`   ✅ Joined match: ${page.url()}`);
          
          // Explore match viewer
          const matchHtml = await page.content();
          findings.matches.viewer = {
            hasPlayButton: matchHtml.includes('Play') || matchHtml.includes('▶'),
            hasPauseButton: matchHtml.includes('Pause') || matchHtml.includes('⏸'),
            hasTimeline: matchHtml.includes('timeline') || matchHtml.includes('range'),
            hasVictoryOverlay: matchHtml.includes('Victory') || matchHtml.includes('Defeat')
          };
          
          await page.screenshot({ path: path.join(MEMORY_DIR, 'explore_match_viewer.png') });
          findings.screenshots.push('explore_match_viewer.png');
        }
      }
    } catch (e) {
      findings.matches.joinError = e.message;
      console.log(`   ⚠️ Could not join: ${e.message}`);
    }

    // 3. Explore Vault/Roster
    console.log('\n3️⃣ Exploring Vault/Roster...');
    await page.goto('http://localhost:5173/roster');
    await delay(2000);
    
    const rosterHtml = await page.content();
    let rosterSnapshot = { children: [] };
    try {
      rosterSnapshot = await page.accessibility.snapshot() || { children: [] };
    } catch {}
    const rosterChildren = rosterSnapshot.children || [];
    
    findings.vault = {
      url: page.url(),
      title: await page.title(),
      hasFighters: rosterHtml.includes('fighter') || rosterHtml.includes('Fighter'),
      hasEquipment: rosterHtml.includes('equipment') || rosterHtml.includes('Equipment'),
      buttons: rosterChildren.filter(c => c.role === 'button').map(b => b.name).slice(0, 10)
    };
    
    console.log(`   Has fighters: ${findings.vault.hasFighters ? '✅' : '❌'}`);
    console.log(`   Has equipment: ${findings.vault.hasEquipment ? '✅' : '❌'}`);
    console.log(`   Buttons: ${findings.vault.buttons.join(', ')}`);
    
    await page.screenshot({ path: path.join(MEMORY_DIR, 'explore_vault.png') });
    findings.screenshots.push('explore_vault.png');

    // Try to equip something
    console.log('   Looking for equip buttons...');
    try {
      const equipBtns = await page.locator('button:has-text("Equip"), button:has-text("equip"), [data-testid*="equip"]').all();
      findings.vault.equipButtonsFound = equipBtns.length;
      console.log(`   Equip buttons found: ${equipBtns.length}`);
      
      if (equipBtns.length > 0) {
        await equipBtns[0].click();
        await delay(2000);
        
        findings.equipment = {
          url: page.url(),
          title: await page.title(),
          equipped: true
        };
        
        await page.screenshot({ path: path.join(MEMORY_DIR, 'explore_equip.png') });
        findings.screenshots.push('explore_equip.png');
        console.log('   ✅ Equipment interaction succeeded');
      }
    } catch (e) {
      findings.vault.equipError = e.message;
      console.log(`   ⚠️ Equip failed: ${e.message}`);
    }

    // 4. Check for Rewards
    console.log('\n4️⃣ Checking Rewards...');
    
    // Look for rewards in dashboard
    await page.goto('http://localhost:5173/dashboard');
    await delay(2000);
    
    const dashboardHtml = await page.content();
    findings.rewards = {
      hasRewardsSection: dashboardHtml.includes('reward') || dashboardHtml.includes('Reward'),
      hasClaimButton: dashboardHtml.includes('Claim') || dashboardHtml.includes('claim'),
      hasCurrency: dashboardHtml.includes('coins') || dashboardHtml.includes('gold') || dashboardHtml.includes('💰')
    };
    
    console.log(`   Rewards section: ${findings.rewards.hasRewardsSection ? '✅' : '❌'}`);
    console.log(`   Claim button: ${findings.rewards.hasClaimButton ? '✅' : '❌'}`);
    console.log(`   Currency display: ${findings.rewards.hasCurrency ? '✅' : '❌'}`);
    
    await page.screenshot({ path: path.join(MEMORY_DIR, 'explore_rewards.png') });
    findings.screenshots.push('explore_rewards.png');

    // 5. Summary
    console.log('\n📊 Exploration Summary');
    console.log('=' .repeat(50));
    console.log(`Pages explored: ${Object.keys(findings.pages).length + 4}`);
    console.log(`Screenshots: ${findings.screenshots.length}`);
    console.log(`Match join: ${findings.matches.joinResult?.success ? '✅' : '❌'}`);
    console.log(`Equipment: ${findings.equipment?.equipped ? '✅' : '⚠️'}`);
    
    // Save findings
    const findingsFile = path.join(MEMORY_DIR, 'deep_exploration_findings.json');
    fs.writeFileSync(findingsFile, JSON.stringify(findings, null, 2));
    console.log(`\n💾 Findings saved: ${findingsFile}`);

  } catch (e) {
    console.error('❌ Exploration error:', e.message);
  } finally {
    await browser.close();
  }
}

exploreFeatures().catch(console.error);
