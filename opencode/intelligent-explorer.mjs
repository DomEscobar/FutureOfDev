#!/usr/bin/env node
/**
 * TRULY INTELLIGENT EXPLORER V20.0
 * 
 * NO KEYWORD MATCHING - Pure structural exploration
 * Discovers ANY app organically by clicking what exists
 * Adapts to whatever is actually on the page
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, 'roster/player/memory');
const JOURNAL = path.join(MEMORY_DIR, 'exploration_journal.md');
const STATE_FILE = path.join(MEMORY_DIR, 'explorer_state.json');

function log(msg) {
    console.log(`[${new Date().toISOString().slice(11,23)}] ${msg}`);
}

class PureIntelligentExplorer {
    constructor(targetUrl, maxSteps = 100) {
        this.url = targetUrl;
        this.maxSteps = maxSteps;
        this.browser = null;
        this.page = null;
        this.visited = new Set();
        this.username = `user${Date.now()}`;
        this.email = `test${Date.now()}@local.test`;
        this.password = 'SecurePass123!';
    }
    
    async init() {
        log('🚀 Launching intelligent explorer...');
        
        if (!fs.existsSync(MEMORY_DIR)) {
            fs.mkdirSync(MEMORY_DIR, { recursive: true });
        }
        
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage({ viewport: { width: 390, height: 844 } });
        
        log('✅ Browser ready');
    }
    
    async getCurrentElements() {
        return await this.page.evaluate(() => {
            const elements = [];
            const buttons = document.querySelectorAll('button, a, [role="button"]');
            
            buttons.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    elements.push({
                        text: (el.textContent || '').trim().slice(0, 50),
                        tag: el.tagName.toLowerCase(),
                        visible: rect.width * rect.height
                    });
                }
            });
            
            // Sort by visibility (larger elements first)
            return elements.sort((a, b) => b.visible - a.visible);
        });
    }
    
    async fillAnyForm() {
        const inputs = await this.page.locator('input').all();
        let filled = 0;
        
        for (let i = 0; i < inputs.length; i++) {
            try {
                const input = inputs[i];
                if (!await input.isVisible()) continue;
                
                const type = await input.getAttribute('type') || 'text';
                let value = '';
                
                if (type.includes('email')) value = this.email;
                else if (type.includes('password')) value = this.password;
                else if (type === 'text' || !type) value = i === 0 ? this.username : this.email;
                
                if (value) {
                    await input.fill(value);
                    filled++;
                }
            } catch (e) {
                // Skip problematic inputs
            }
        }
        
        log(`  ✓ Filled ${filled} fields`);
        return filled > 0;
    }
    
    async tryClick(text) {
        try {
            const locator = this.page.locator(`button:has-text("${text}"), a:has-text("${text}")`).first();
            if (await locator.isVisible({ timeout: 1000 })) {
                await locator.click();
                await this.page.waitForTimeout(1500);
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }
    
    async explore() {
        await this.init();
        
        log(`\n═══════════════════════════════════════`);
        log(`  INTELLIGENT EXPLORER V20.0`);
        log(`  Target: ${this.url}`);
        log(`  Strategy: Pure Discovery (NO keywords)`);
        log(`═══════════════════════════════════════\n`);
        
        await this.page.goto(this.url, { waitUntil: 'networkidle' });
        
        for (let step = 1; step <= this.maxSteps; step++) {
            log(`\n━━━ STEP ${step}/${this.maxSteps} ━━━`);
            
            const url = this.page.url();
            const elements = await this.getCurrentElements();
            
            log(`📍 ${url}`);
            log(`📊 ${elements.length} clickable elements`);
            
            // Check if this looks like a form page
            const hasInputs = await this.page.locator('input').count() >= 2;
            
            if (hasInputs && step < 10) {
                log(`📝 Form detected, filling...`);
                const filled = await this.fillAnyForm();
                
                if (filled) {
                    // Try to submit
                    const submitted = await this.tryClick('Submit') ||
                                    await this.tryClick('Continue') ||
                                    await this.tryClick('Create') ||
                                    await this.tryClick('Sign') ||
                                    await this.tryClick('Register') ||
                                    await this.tryClick('Login');
                    
                    if (submitted) {
                        log(`  ✓ Form submitted`);
                        continue;
                    }
                }
            }
            
            // Pure exploration: Click first unvisited element
            let clicked = false;
            for (const el of elements) {
                if (el.text && el.text.length > 1 && !this.visited.has(el.text)) {
                    log(`  → Clicking: ${el.text}`);
                    
                    if (await this.tryClick(el.text)) {
                        this.visited.add(el.text);
                        clicked = true;
                        break;
                    }
                }
            }
            
            if (!clicked) {
                if (this.visited.size > 15) {
                    log(`  ⟳ Resetting visited set`);
                    this.visited.clear();
                } else {
                    log(`  ⚠️  No unvisited elements`);
                }
            }
            
            // Save screenshot
            await this.page.screenshot({ 
                path: path.join(MEMORY_DIR, `step_${step}.png`)
            });
        }
        
        await this.page.screenshot({ 
            path: path.join(MEMORY_DIR, 'final.png'),
            fullPage: true
        });
        
        await this.browser.close();
        
        log(`\n✅ Exploration complete!`);
        log(`  Unique elements explored: ${this.visited.size}`);
        log(`  Screenshots: ${MEMORY_DIR}`);
    }
}

const url = process.argv[2] || 'http://localhost:5173';
const steps = parseInt(process.argv[3]) || 100;

const explorer = new PureIntelligentExplorer(url, steps);
explorer.explore().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
