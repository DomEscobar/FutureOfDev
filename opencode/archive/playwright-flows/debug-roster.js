#!/usr/bin/env node
/**
 * Create Fighter flow - detailed debugging
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

async function debugRoster() {
  console.log('🔍 DEBUG: Roster Page\n');
  
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
  console.log(`Using: ${credentials.email}`);

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    // Login
    await page.goto('http://localhost:5173/login');
    await delay(1000);
    const inputs = await page.locator('input').all();
    await inputs[0].fill(credentials.email);
    if (inputs[1]) await inputs[1].fill(credentials.password);
    await page.locator('button').first().click();
    await delay(3000);

    // Go to roster
    await page.goto('http://localhost:5173/roster');
    await delay(3000);

    // Get all buttons
    console.log('\n📋 ALL BUTTONS ON ROSTER PAGE:');
    const buttons = await page.locator('button').all();
    for (let i = 0; i < buttons.length; i++) {
      try {
        const text = await buttons[i].textContent();
        const visible = await buttons[i].isVisible();
        const enabled = await buttons[i].isEnabled();
        const testid = await buttons[i].getAttribute('data-testid');
        console.log(`  [${i}] "${text?.trim()}" | visible=${visible} | enabled=${enabled} | testid=${testid}`);
      } catch (e) {
        console.log(`  [${i}] ERROR: ${e.message}`);
      }
    }

    // Take screenshot
    await page.screenshot({ path: path.join(MEMORY_DIR, 'debug_roster.png'), fullPage: true });
    console.log('\n📸 Screenshot saved: debug_roster.png');
    
    // Try clicking RECRUIT button
    console.log('\n🖱️ Clicking RECRUIT button...');
    for (const btn of buttons) {
      try {
        const text = await btn.textContent();
        if (text?.toLowerCase().includes('recruit')) {
          console.log(`  Clicking: "${text.trim()}"`);
          await btn.click();
          await delay(3000);
          console.log(`  URL after click: ${page.url()}`);
          break;
        }
      } catch {}
    }
    
    // Get buttons on new page
    console.log('\n📋 BUTTONS AFTER RECRUIT CLICK:');
    const newButtons = await page.locator('button').all();
    for (let i = 0; i < Math.min(newButtons.length, 10); i++) {
      try {
        const text = await newButtons[i].textContent();
        console.log(`  [${i}] "${text?.trim()}"`);
      } catch {}
    }
    
    await page.screenshot({ path: path.join(MEMORY_DIR, 'debug_after_recruit.png') });
    console.log('\n📸 Screenshot saved: debug_after_recruit.png');

    await delay(5000);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

debugRoster().catch(console.error);
