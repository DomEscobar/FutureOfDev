#!/usr/bin/env node
/**
 * UNIVERSAL WEB APP EXPLORER V20 — Structure-only (ReAct-style)
 *
 * Discovers any web app using Playwright’s accessibility snapshot and refs only.
 * No keyword matching: decisions from DOM structure (role + order). Uses
 * Observe → Reason → Act loop; actions by ref (aria-ref=...).
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, 'roster/player/memory');
const CREDENTIALS_FILE = path.join(MEMORY_DIR, 'credentials.json');
const JOURNAL = path.join(MEMORY_DIR, 'exploration_journal.md');
const STATE_FILE = path.join(MEMORY_DIR, 'explorer_state.json');
const APP_MEMORY_FILE = path.join(MEMORY_DIR, 'app_memory.json');
const AGENCY_FEEDBACK_FILE = path.join(MEMORY_DIR, 'agency_feedback.md');

// Player Telegram telemetry (beautiful dashboard)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { updatePlayerDashboard } = require('./telemetry-player.cjs');

function log(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = { INFO: '📋', SUCCESS: '✅', WARNING: '⚠️', ERROR: '❌', ACTION: '🎯' }[level] || '📋';
    console.log(`[${timestamp}] ${emoji} ${msg}`);
}

function saveJournal(entry) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(JOURNAL, `\n## [${timestamp}]\n${entry}\n`);
}

function saveFinding(finding) {
    const FINDINGS_FILE = path.join(MEMORY_DIR, 'ux_findings.md');
    if (!fs.existsSync(FINDINGS_FILE)) {
        fs.writeFileSync(FINDINGS_FILE, '# UX/UI FINDINGS & CRITIQUES\n\nPlayer-generated issues for agency to fix.\n\n');
    }
    
    const timestamp = new Date().toISOString();
    const severity = finding.severity || 'MEDIUM';
    const emoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[severity] || '🟡';
    
    const entry = `
## ${emoji} [${timestamp}] ${finding.title}

**Severity:** ${severity}
**Page:** ${finding.page || 'Unknown'}
**Category:** ${finding.category || 'General'}

### Issue
${finding.issue}

### Impact
${finding.impact}

### Recommendation
${finding.recommendation}

---
`;
    
    fs.appendFileSync(FINDINGS_FILE, entry);
    log(`📝 Finding logged: ${finding.title}`, 'WARNING');
}

const INTERACTABLE_ROLES = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'menuitem', 'tab', 'switch']);

function parseSnapshotToElements(snapshotFull) {
    if (!snapshotFull || typeof snapshotFull !== 'string') return [];
    const lines = snapshotFull.split('\n');
    const elements = [];
    const linkRefToHref = {};
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const refMatch = line.match(/\[ref=([^\]]+)\]/);
        if (!refMatch) continue;
        const ref = refMatch[1];
        const roleMatch = line.match(/^\s*-\s*(\w+)/);
        const role = roleMatch ? roleMatch[1].toLowerCase() : 'generic';
        if (!INTERACTABLE_ROLES.has(role) && role !== 'generic') continue;
        const indent = (line.match(/^(\s*)/) || [])[1].length;
        if (role === 'link') {
            for (let j = i + 1; j < lines.length; j++) {
                const nextIndent = (lines[j].match(/^(\s*)/) || [])[1].length;
                if (nextIndent <= indent) break;
                const urlMatch = lines[j].match(/\/url:\s*(\S+)/);
                if (urlMatch) {
                    linkRefToHref[ref] = urlMatch[1].trim();
                    break;
                }
            }
        }
        elements.push({ ref, role, raw: line.trim(), href: linkRefToHref[ref] });
    }
    return elements;
}

function structureDecide(snapshotElements, visitedRefs, lastUrl, lastAction, currentUrl, memoryHint) {
    const buttons = snapshotElements.filter(e => e.role === 'button');
    const links = snapshotElements.filter(e => e.role === 'link');
    const textboxes = snapshotElements.filter(e => e.role === 'textbox');
    const unvisitedButton = buttons.find(b => !visitedRefs.has(b.ref));
    const unvisitedLink = links.find(l => !visitedRefs.has(l.ref));

    const stuckOnForm = currentUrl === lastUrl && lastAction === 'fill_then_click';
    const learnedStuck = memoryHint && memoryHint.learnedStuckScreens && memoryHint.learnedStuckScreens.includes(urlToKey(currentUrl));
    if ((stuckOnForm || learnedStuck) && unvisitedLink) {
        return { action: 'click', ref: unvisitedLink.ref };
    }

    if (textboxes.length >= 1 && buttons.length >= 1 && !stuckOnForm && !learnedStuck) {
        return {
            action: 'fill_then_click',
            textboxRefs: textboxes.map(t => t.ref),
            submitRef: buttons[0].ref
        };
    }

    if (memoryHint && memoryHint.unvisitedPathPrefixes && memoryHint.unvisitedPathPrefixes.length > 0 && links.length > 0) {
        const linkToNew = links.find(l => l.href && memoryHint.unvisitedPathPrefixes.some(prefix => l.href.startsWith(prefix)) && !visitedRefs.has(l.ref));
        if (linkToNew) return { action: 'click', ref: linkToNew.ref };
    }

    if (unvisitedButton) return { action: 'click', ref: unvisitedButton.ref };
    if (unvisitedLink) return { action: 'click', ref: unvisitedLink.ref };
    if (buttons[0]) return { action: 'click', ref: buttons[0].ref };
    if (links[0]) return { action: 'click', ref: links[0].ref };
    return null;
}

function generateFormValuesByPosition(count, context) {
    const values = [];
    const email = context.email || `explorer${Date.now()}@test.local`;
    const password = context.password || 'SecurePass123!';
    const name = context.name || 'Test Explorer';
    for (let i = 0; i < count; i++) {
        if (i === 0) values.push(email);
        else if (i === 1) values.push(password);
        else values.push(name);
    }
    return values;
}

function urlToKey(url) {
    try {
        const u = new URL(url);
        return u.origin + u.pathname.replace(/\/$/, '') || u.origin + '/';
    } catch {
        return url;
    }
}

class AppMemory {
    constructor(memoryPath = APP_MEMORY_FILE) {
        this.path = memoryPath;
        this.data = this.load();
    }

    load() {
        if (!fs.existsSync(this.path)) {
            return { apps: {} };
        }
        try {
            return JSON.parse(fs.readFileSync(this.path, 'utf8'));
        } catch (e) {
            return { apps: {} };
        }
    }

    save() {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    }

    appKey(startUrl) {
        try {
            const u = new URL(startUrl);
            return u.origin;
        } catch {
            return startUrl;
        }
    }

    ensureApp(startUrl) {
        const key = this.appKey(startUrl);
        if (!this.data.apps[key]) {
            this.data.apps[key] = {
                screens: {},
                transitions: [],
                outcomes: {},
                lastUpdated: null
            };
        }
        return this.data.apps[key];
    }

    recordScreen(startUrl, url, structureSummary) {
        const app = this.ensureApp(startUrl);
        const key = urlToKey(url);
        app.screens[key] = {
            summary: structureSummary,
            lastSeen: new Date().toISOString()
        };
        app.lastUpdated = new Date().toISOString();
        this.save();
    }

    recordTransition(startUrl, fromUrl, actionType, toUrl, navigated) {
        const app = this.ensureApp(startUrl);
        const from = urlToKey(fromUrl);
        const to = urlToKey(toUrl);
        app.transitions.push({
            from,
            action: actionType,
            to,
            navigated: navigated,
            at: new Date().toISOString()
        });
        const outcomeKey = `${from}::${actionType}`;
        if (!app.outcomes[outcomeKey]) {
            app.outcomes[outcomeKey] = { navigated: 0, stayed: 0, toUrl: null };
        }
        const o = app.outcomes[outcomeKey];
        if (navigated) {
            o.navigated += 1;
            o.toUrl = to;
        } else {
            o.stayed += 1;
        }
        app.lastUpdated = new Date().toISOString();
        if (app.transitions.length > 500) {
            app.transitions = app.transitions.slice(-300);
        }
        this.save();
    }

    didSubmitUsuallyStay(startUrl, url) {
        const app = this.ensureApp(startUrl);
        const key = urlToKey(url);
        const outcomeKey = `${key}::fill_then_click`;
        const o = app.outcomes[outcomeKey];
        if (!o) return false;
        const total = o.navigated + o.stayed;
        return total >= 1 && o.stayed >= o.navigated;
    }

    getLearnedStuckScreens(startUrl) {
        const app = this.ensureApp(startUrl);
        const stuck = [];
        for (const [k, o] of Object.entries(app.outcomes)) {
            if (!k.endsWith('::fill_then_click')) continue;
            const total = o.navigated + o.stayed;
            if (total >= 1 && o.stayed >= o.navigated) {
                stuck.push(k.replace('::fill_then_click', ''));
            }
        }
        return stuck;
    }
}

class UniversalFormHandler {
    /**
     * Handles ANY form on ANY website
     * Intelligently fills inputs based on type, name, placeholder
     */
    
    static async analyzeForm(page) {
        return await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
            return inputs.map(input => ({
                type: input.type || 'text',
                name: input.name || '',
                id: input.id || '',
                placeholder: input.placeholder || '',
                required: input.required,
                visible: input.offsetParent !== null,
                autocomplete: input.getAttribute('autocomplete') || ''
            })).filter(i => i.visible);
        });
    }
    
    static generateValueForInput(input, context = {}) {
        const type = (input.type || 'text').toLowerCase();
        const position = context._index ?? 0;
        if (type === 'email') return context.email || `explorer${Date.now()}@test.local`;
        if (type === 'password') return context.password || 'SecurePass123!';
        if (type === 'tel') return '+1234567890';
        if (type === 'number') return '42';
        if (type === 'date') return '2000-01-01';
        if (type === 'url') return 'https://example.com';
        if (position === 0) return context.email || `explorer${Date.now()}@test.local`;
        if (position === 1) return context.password || 'SecurePass123!';
        return context.name || `Test${Date.now()}`;
    }
    
    static async fillForm(page, context = {}) {
        const fields = await this.analyzeForm(page);
        const filled = [];
        
        for (const field of fields) {
            try {
                const value = this.generateValueForInput(field, { ...context, _index: filled.length });
                const selector = field.id ? `#${field.id}` : `input[name="${field.name}"]`;
                
                // Add timeout to prevent hanging
                await page.locator(selector).first().fill(String(value), { timeout: 3000 });
                filled.push({ field: field.name || field.id, type: field.type });
            } catch (e) {
                // Skip fields that can't be filled quickly
                log(`  ⚠️ Skipped field: ${field.name || field.id}`, 'WARNING');
            }
        }
        
        return filled;
    }

    static async fillFormByRefs(page, textboxRefs, values) {
        const filled = [];
        for (let i = 0; i < textboxRefs.length; i++) {
            const ref = textboxRefs[i];
            const value = values[i] ?? `val${Date.now()}`;
            try {
                const loc = page.locator(`aria-ref=${ref}`);
                await loc.fill(String(value), { timeout: 3000 });
                filled.push({ ref, value: value.slice(0, 10) + '...' });
            } catch (e) {
                log(`  ⚠️ Skip fill ref ${ref}: ${e.message}`, 'WARNING');
            }
        }
        return filled;
    }
}

class UniversalExplorer {
    constructor(config = {}) {
        const fileCreds = this._loadCredentialsFile();
        this.config = {
            startUrl: config.startUrl || 'http://localhost:5173',
            maxSteps: config.maxSteps || 80,
            credentials: {
                username: config.username || fileCreds.username || `explorer${Date.now()}`,
                email: config.email ?? fileCreds.email ?? `explorer${Date.now()}@test.local`,
                password: config.password ?? fileCreds.password ?? 'SecurePass123!',
                name: config.name ?? fileCreds.name ?? 'Test Explorer'
            },
            goals: config.goals || [
                'complete_registration',
                'login',
                'explore_main_features',
                'discover_all_pages'
            ]
        };

        this.state = this.loadState();
        this.visitedRefs = new Set();
        this.lastUrl = '';
        this.lastAction = '';
        this.previousStepUrl = null;
        this.previousStepAction = null;
        this.appMemory = new AppMemory();
        this.discoveredPages = new Map();
        this.browser = null;
        this.page = null;
        this.startTime = Date.now();
        this.totalFindings = 0;
    }

    _loadCredentialsFile() {
        if (!fs.existsSync(CREDENTIALS_FILE)) return {};
        try {
            const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
            return {
                email: data.email,
                password: data.password,
                name: data.name,
                username: data.username
            };
        } catch (e) {
            return {};
        }
    }
    
    async _sendTelemetryUpdate(extra = {}) {
        try {
            updatePlayerDashboard({
                taskId: `UX Audit: ${this.config.startUrl}`,
                startTime: this.startTime,
                latestThought: extra.latestThought || `Step ${this.state.actions.length}`,
                metrics: {
                    cost: '0.00',
                    loops: this._countFindings(),
                    quality: extra.quality || 'Good'
                },
                phases: extra.phases || { hammer: { status: `Step ${this.state.actions.length}/${this.config.maxSteps}` } }
            });
        } catch (e) {
            log(`Telemetry error: ${e.message}`, 'ERROR');
        }
    }
    
    _countFindings() {
        const file = path.join(MEMORY_DIR, 'ux_findings.md');
        if (!fs.existsSync(file)) return 0;
        const content = fs.readFileSync(file, 'utf8');
        const matches = content.match(/^##\s+/gm);
        return matches ? matches.length : 0;
    }
    
    loadState() {
        if (fs.existsSync(STATE_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
                if (Array.isArray(data.visitedRefs)) {
                    this.visitedRefs = new Set(data.visitedRefs);
                }
                return data;
            } catch (e) {
                log(`Could not load state: ${e.message}`, 'WARNING');
            }
        }
        
        return {
            phase: 'start',
            completedGoals: [],
            actions: [],
            discoveries: []
        };
    }
    
    saveState() {
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            ...this.state,
            config: this.config,
            visitedRefs: Array.from(this.visitedRefs),
            discoveredPages: Array.from(this.discoveredPages.entries())
        }, null, 2));
    }
    
    async init() {
        log('🚀 Launching Universal Explorer...');

        if (fs.existsSync(AGENCY_FEEDBACK_FILE)) {
            try {
                const feedback = fs.readFileSync(AGENCY_FEEDBACK_FILE, 'utf8');
                const lines = feedback.trim().split('\n').filter(Boolean);
                if (lines.length > 0) {
                    log('📬 Agency feedback (from watcher):', 'INFO');
                    lines.slice(0, 30).forEach(l => log(`   ${l}`, 'INFO'));
                    if (lines.length > 30) log(`   ... and ${lines.length - 30} more lines`, 'INFO');
                }
            } catch (e) {
                log(`Could not read agency feedback: ${e.message}`, 'WARNING');
            }
        }
        
        if (!fs.existsSync(MEMORY_DIR)) {
            fs.mkdirSync(MEMORY_DIR, { recursive: true });
        }
        
        this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage({
            viewport: { width: 1280, height: 720 }
        });
        
        log('✅ Browser ready', 'SUCCESS');
        await this._sendTelemetryUpdate({ latestThought: 'Booting virtual machine...' });
    }
    
    async analyzeCurrentPage() {
        const url = this.page.url();
        try {
            await this.page.waitForLoadState('domcontentloaded', { timeout: 2000 });
        } catch (_) {}
        const title = await this.page.title();
        let snapshotFull = '';
        try {
            const out = await this.page._snapshotForAI({});
            snapshotFull = out.full ?? '';
        } catch (e) {
            log(`Snapshot failed: ${e.message}`, 'WARNING');
        }
        const snapshotElements = parseSnapshotToElements(snapshotFull);
        const uxIssues = await this.analyzeUX();
        return {
            url,
            title,
            snapshotFull,
            snapshotElements,
            uxIssues
        };
    }
    
    async analyzeUX() {
        const issues = [];
        
        try {
            // Check for common UX issues
            const analysis = await this.page.evaluate(() => {
                const uxProblems = [];
                
                // Check button sizes (should be >= 44x44px for mobile)
                const buttons = document.querySelectorAll('button, a[role="button"], [role="button"]');
                buttons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
                        uxProblems.push({
                            type: 'small_touch_target',
                            element: btn.textContent?.trim().slice(0, 30),
                            size: `${rect.width}x${rect.height}px`
                        });
                    }
                });
                
                // Check for overlapping elements
                const nav = document.querySelector('nav, [role="navigation"]');
                if (nav) {
                    const navRect = nav.getBoundingClientRect();
                    const content = document.querySelectorAll('main > *, .content > *');
                    content.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.bottom > navRect.top && navRect.top > 0) {
                            uxProblems.push({
                                type: 'content_overlap',
                                element: el.className || el.tagName
                            });
                        }
                    });
                }
                
                // Check for missing labels on inputs
                const inputs = document.querySelectorAll('input:not([type="hidden"])');
                inputs.forEach(input => {
                    if (!input.labels || input.labels.length === 0) {
                        if (!input.placeholder && !input.getAttribute('aria-label')) {
                            uxProblems.push({
                                type: 'unlabeled_input',
                                element: input.name || input.id || 'unnamed'
                            });
                        }
                    }
                });
                
                // Check for low contrast (simplified)
                const textElements = document.querySelectorAll('p, span, a, button');
                let lowContrastCount = 0;
                textElements.forEach(el => {
                    const styles = window.getComputedStyle(el);
                    const color = styles.color;
                    const bg = styles.backgroundColor;
                    // Simplified check - if both are similar lightness
                    if (color.includes('rgb') && bg.includes('rgb')) {
                        const colorMatch = color.match(/\d+/g);
                        const bgMatch = bg.match(/\d+/g);
                        if (colorMatch && bgMatch) {
                            const colorAvg = colorMatch.slice(0, 3).reduce((a, b) => parseInt(a) + parseInt(b), 0) / 3;
                            const bgAvg = bgMatch.slice(0, 3).reduce((a, b) => parseInt(a) + parseInt(b), 0) / 3;
                            if (Math.abs(colorAvg - bgAvg) < 50) {
                                lowContrastCount++;
                            }
                        }
                    }
                });
                
                if (lowContrastCount > 5) {
                    uxProblems.push({
                        type: 'low_contrast',
                        count: lowContrastCount
                    });
                }
                
                // Check page performance
                const perf = performance.getEntriesByType('navigation')[0];
                if (perf && perf.loadEventEnd - perf.fetchStart > 3000) {
                    uxProblems.push({
                        type: 'slow_load',
                        loadTime: Math.round(perf.loadEventEnd - perf.fetchStart)
                    });
                }
                
                return uxProblems;
            });
            
            return analysis;
        } catch (e) {
            return [];
        }
    }
    
    async executeStructureAction(analysis) {
        const { snapshotElements } = analysis;
        if (!snapshotElements || snapshotElements.length === 0) return false;
        if (this.visitedRefs.size > 60) {
            log('  ⟳ Resetting visited refs to explore new paths', 'WARNING');
            this.visitedRefs.clear();
        }
        const memoryHint = {
            learnedStuckScreens: this.appMemory.getLearnedStuckScreens(this.config.startUrl)
        };
        const visitedPathnames = new Set(
            [...this.discoveredPages.keys()].map(u => {
                try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; }
            })
        );
        const linkPathnames = [...new Set(
            snapshotElements.filter(e => e.role === 'link' && e.href).map(e => {
                const p = e.href.replace(/\?.*$/, '').replace(/\/$/, '') || '/';
                return p;
            })
        )];
        memoryHint.unvisitedPathPrefixes = linkPathnames.filter(p => !visitedPathnames.has(p));
        const decision = structureDecide(snapshotElements, this.visitedRefs, this.lastUrl, this.lastAction, analysis.url, memoryHint);
        if (!decision) return false;

        if (decision.action === 'fill_then_click') {
            log('📝 Fill form then submit (by ref)', 'ACTION');
            const values = generateFormValuesByPosition(decision.textboxRefs.length, this.config.credentials);
            const filled = await UniversalFormHandler.fillFormByRefs(this.page, decision.textboxRefs, values);
            log(`  ✓ Filled ${filled.length} fields by ref`, 'SUCCESS');
            this.visitedRefs.add(decision.submitRef);
            const ok = await this.clickByRef(decision.submitRef, 2500);
            this.lastUrl = analysis.url;
            this.lastAction = 'fill_then_click';
            return ok;
        }

        if (decision.action === 'click') {
            this.visitedRefs.add(decision.ref);
            const ok = await this.clickByRef(decision.ref);
            this.lastUrl = analysis.url;
            this.lastAction = 'click';
            return ok;
        }
        return false;
    }

    async clickByRef(ref, postClickWaitMs = 1500) {
        try {
            const locator = this.page.locator(`aria-ref=${ref}`);
            await locator.click({ timeout: 5000 });
            log(`  ✓ Clicked ref ${ref}`, 'SUCCESS');
            await this.page.waitForTimeout(postClickWaitMs);
            return true;
        } catch (e) {
            log(`  ✗ Click ref ${ref} failed: ${e.message}`, 'WARNING');
            return false;
        }
    }
    
    async explore() {
        await this.init();
        
        log(`
╔════════════════════════════════════════════════════════╗
║  UNIVERSAL WEB APP EXPLORER V20 — Structure-only       ║
║  Target: ${this.config.startUrl.padEnd(40)} ║
║  Strategy: Snapshot → Reason → Act by ref (no keywords)║
║  Goals: ${this.config.goals.length} objectives                         ║
╚════════════════════════════════════════════════════════╝
        `);
        
        saveJournal(`# Exploration of ${this.config.startUrl}\n\nStarted: ${new Date().toISOString()}`);
        
        // Clear previous state to get fresh Telegram bubble per run
        if (fs.existsSync(STATE_FILE)) {
            fs.unlinkSync(STATE_FILE);
        }
        
        try {
            await this.page.goto(this.config.startUrl, { waitUntil: 'networkidle', timeout: 30000 });
            
            for (let step = 1; step <= this.config.maxSteps; step++) {
                log(`\n━━━ STEP ${step}/${this.config.maxSteps} ━━━`);

                const analysis = await this.analyzeCurrentPage();

                if (this.previousStepUrl !== null && this.previousStepAction !== null) {
                    const fromUrl = this.previousStepUrl;
                    const toUrl = analysis.url;
                    const navigated = urlToKey(fromUrl) !== urlToKey(toUrl);
                    this.appMemory.recordTransition(this.config.startUrl, fromUrl, this.previousStepAction, toUrl, navigated);
                }
                const currentPathKey = urlToKey(analysis.url);
                if (this.previousStepUrl !== null && urlToKey(this.previousStepUrl) !== currentPathKey) {
                    this.visitedRefs.clear();
                }
                const structureSummary = `${analysis.snapshotElements.filter(e => e.role === 'button').length}b,${analysis.snapshotElements.filter(e => e.role === 'link').length}l,${analysis.snapshotElements.filter(e => e.role === 'textbox').length}t`;
                this.appMemory.recordScreen(this.config.startUrl, analysis.url, structureSummary);

                log(`📍 ${analysis.url}`);
                log(`📄 "${analysis.title}"`);
                log(`📊 ${analysis.snapshotElements.length} interactable elements (by ref)`);

                // Report UX issues
                if (analysis.uxIssues && analysis.uxIssues.length > 0) {
                    log(`⚠️  ${analysis.uxIssues.length} UX issues detected`, 'WARNING');
                    
                    for (const issue of analysis.uxIssues) {
                        switch (issue.type) {
                            case 'small_touch_target':
                                saveFinding({
                                    title: `Touch Target Too Small: "${issue.element}"`,
                                    severity: 'HIGH',
                                    page: analysis.url,
                                    category: 'Mobile UX',
                                    issue: `Button "${issue.element}" is only ${issue.size}, below the 44x44px minimum for touch targets.`,
                                    impact: 'Users will frequently mis-tap, causing frustration and errors.',
                                    recommendation: 'Increase button size to at least 44x44px with adequate padding.'
                                });
                                break;
                            
                            case 'content_overlap':
                                saveFinding({
                                    title: `Content Overlaps Navigation`,
                                    severity: 'MEDIUM',
                                    page: analysis.url,
                                    category: 'Layout',
                                    issue: `Content element (${issue.element}) overlaps with navigation bar.`,
                                    impact: 'Content may be hidden or difficult to access.',
                                    recommendation: 'Add proper padding/margin to prevent overlap. Use safe-area-inset for mobile.'
                                });
                                break;
                            
                            case 'unlabeled_input':
                                saveFinding({
                                    title: `Input Field Missing Label`,
                                    severity: 'MEDIUM',
                                    page: analysis.url,
                                    category: 'Accessibility',
                                    issue: `Input field "${issue.element}" has no label, placeholder, or aria-label.`,
                                    impact: 'Screen reader users cannot identify field purpose. Poor accessibility score.',
                                    recommendation: 'Add <label> element or aria-label attribute to identify the field.'
                                });
                                break;
                            
                            case 'low_contrast':
                                saveFinding({
                                    title: `Low Contrast Detected`,
                                    severity: 'LOW',
                                    page: analysis.url,
                                    category: 'Accessibility',
                                    issue: `${issue.count} elements have low color contrast.`,
                                    impact: 'Text may be difficult to read for users with visual impairments.',
                                    recommendation: 'Ensure text has at least 4.5:1 contrast ratio with background (WCAG AA).'
                                });
                                break;
                            
                            case 'slow_load':
                                saveFinding({
                                    title: `Slow Page Load Time`,
                                    severity: 'MEDIUM',
                                    page: analysis.url,
                                    category: 'Performance',
                                    issue: `Page took ${issue.loadTime}ms to load (>3 seconds).`,
                                    impact: 'Users may abandon the page. Poor user experience.',
                                    recommendation: 'Optimize images, reduce JavaScript bundle size, implement code splitting.'
                                });
                                break;
                        }
                    }
                }                
                this.discoveredPages.set(analysis.url, {
                    title: analysis.title,
                    elements: analysis.snapshotElements.length,
                    visitedAt: new Date().toISOString()
                });

                saveJournal(
                    `**Step ${step}:** ${analysis.url}\n` +
                    `- Title: ${analysis.title}\n` +
                    `- Interactable (refs): ${analysis.snapshotElements.length}\n`
                );

                this.state.actions.push({
                    step,
                    url: analysis.url,
                    refsClicked: this.visitedRefs.size
                });
                
                this.saveState();
                
                // Send periodic telemetry update every 10 steps
                if (step % 10 === 0) {
                    await this._sendTelemetryUpdate({
                        latestThought: `Step ${step}: ${analysis.url}`,
                        quality: analysis.uxIssues?.length ? `${analysis.uxIssues.length} issues` : 'Good'
                    });
                }
                
                const acted = await this.executeStructureAction(analysis);

                if (!acted) {
                    log('⚠️  No action taken', 'WARNING');
                }

                this.previousStepUrl = analysis.url;
                this.previousStepAction = this.lastAction;

                await this.page.waitForTimeout(2000);
                await this.page.screenshot({ 
                    path: path.join(MEMORY_DIR, `step_${step}.png`),
                    fullPage: false
                });
            }
            
        } catch (error) {
            log(`Error: ${error.message}`, 'ERROR');
            saveJournal(`**ERROR:** ${error.message}`);
        } finally {
            if (this.page) {
                await this.page.screenshot({ 
                    path: path.join(MEMORY_DIR, 'final_state.png'),
                    fullPage: true
                });
            }
            if (this.browser) await this.browser.close();
        }
        
        // Final telemetry update
        await this._sendTelemetryUpdate({
            latestThought: `Complete: ${this.discoveredPages.size} pages, ${this.totalFindings} issues found`,
            phases: { hammer: { status: '✅ Complete' } },
            quality: 'Complete'
        });
        
        log(`\n✅ Exploration complete!`, 'SUCCESS');
        log(`📊 Statistics:`, 'INFO');
        log(`  - Pages discovered: ${this.discoveredPages.size}`);
        log(`  - Actions taken: ${this.state.actions.length}`);
        log(`  - Goals completed: ${(this.state.completedGoals || []).join(', ') || 'none'}`);
        log(`  - Refs acted on: ${this.visitedRefs.size}`);
        log(`📝 Journal: ${JOURNAL}`);
        log(`💾 State: ${STATE_FILE}`);
    }
}

// CLI Interface
const args = process.argv.slice(2);
const config = {
    startUrl: args[0] || 'http://localhost:5173',
    maxSteps: parseInt(args[1]) || 50
};

const explorer = new UniversalExplorer(config);
explorer.explore().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
