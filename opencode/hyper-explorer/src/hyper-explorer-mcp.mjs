#!/usr/bin/env node
/**
 * HYPER-EXPLORER V2 — MCP-Powered Goal-Directed Graph Exploration
 *
 * Architecture: Uses Playwright MCP tools via direct invocation
 * instead of spawning browser directly. Enables distributed
 * execution and tool reuse across multiple agents.
 *
 * Key Innovation: MCP Session Manager that maintains persistent
 * browser context while the explorer focuses on graph reasoning.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const KNOWLEDGE_GRAPH_FILE = path.join(MEMORY_DIR, 'knowledge_graph.json');
const PLAN_TRACE_FILE = path.join(MEMORY_DIR, 'plan_trace.jsonl');
const EXECUTION_LOG_FILE = path.join(MEMORY_DIR, 'execution_log.jsonl');
const MCP_LOG_FILE = path.join(MEMORY_DIR, 'mcp_session.log');
const PLAYER_BUGS_FILE = path.join(MEMORY_DIR, 'player_bugs.jsonl');

// ─────────────────────────────────────────────────────────────────────────────
// MCP SESSION MANAGER — Manages Playwright MCP connection
// ─────────────────────────────────────────────────────────────────────────────

class MCPSessionManager {
    constructor(options = {}) {
        this.options = {
            headless: options.headless ?? true,
            browser: options.browser ?? 'chromium',
            viewportSize: options.viewportSize ?? '1280x720',
            timeoutAction: options.timeoutAction ?? 5000,
            timeoutNavigation: options.timeoutNavigation ?? 30000,
            ...options
        };
        this.mcpProcess = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.sessionState = {
            url: null,
            title: null,
            snapshot: null,
            lastError: null
        };
        this.isConnected = false;
    }

    async start() {
        const args = [
            '@playwright/mcp@latest',
            '--browser', this.options.browser,
            '--viewport-size', this.options.viewportSize,
            '--timeout-action', String(this.options.timeoutAction),
            '--timeout-navigation', String(this.options.timeoutNavigation),
            '--snapshot-mode', 'full'
        ];

        if (this.options.headless) {
            args.push('--headless');
        }

        log(`Starting MCP session: npx ${args.join(' ')}`, 'MCP');

        this.mcpProcess = spawn('npx', args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: __dirname
        });

        this.mcpProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            fs.appendFileSync(MCP_LOG_FILE, `[STDERR] ${msg}\n`);
            if (msg.includes('error') || msg.includes('Error')) {
                log(`MCP Error: ${msg.substring(0, 100)}`, 'ERROR');
            }
        });

        this.mcpProcess.stdout.on('data', (data) => {
            this.handleMCPResponse(data.toString());
        });

        this.mcpProcess.on('close', (code) => {
            log(`MCP process exited with code ${code}`, 'WARNING');
            this.isConnected = false;
        });

        // Wait for MCP to initialize
        await this.sleep(2000);
        this.isConnected = true;
        log('MCP session connected', 'SUCCESS');

        return this;
    }

    handleMCPResponse(data) {
        fs.appendFileSync(MCP_LOG_FILE, `[STDOUT] ${data}\n`);

        try {
            const lines = data.split('\n').filter(l => l.trim());
            for (const line of lines) {
                if (line.startsWith('{')) {
                    const response = JSON.parse(line);
                    if (response.id && this.pendingRequests.has(response.id)) {
                        const { resolve, reject } = this.pendingRequests.get(response.id);
                        this.pendingRequests.delete(response.id);

                        if (response.error) {
                            reject(new Error(response.error.message));
                        } else {
                            resolve(response.result);
                        }
                    }
                }
            }
        } catch (e) {
            // Not JSON, ignore
        }
    }

    async sendRequest(toolName, params = {}) {
        if (!this.isConnected) {
            throw new Error('MCP not connected');
        }

        this.messageId++;
        const id = String(this.messageId);

        const request = {
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: params
            }
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });

            const requestLine = JSON.stringify(request) + '\n';
            this.mcpProcess.stdin.write(requestLine);

            fs.appendFileSync(MCP_LOG_FILE, `[SEND] ${requestLine}`);

            // Timeout handling
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request ${id} timeout`));
                }
            }, this.options.timeoutAction + 5000);
        });
    }

    // ─── MCP Tool Wrappers ───

    async browserNavigate(url) {
        const result = await this.sendRequest('browser_navigate', { url });
        this.sessionState.url = url;
        return result;
    }

    async browserSnapshot() {
        const result = await this.sendRequest('browser_snapshot', {});
        this.sessionState.snapshot = result;
        if (result?.content?.[0]?.text) {
            // Parse title from snapshot
            const titleMatch = result.content[0].text.match(/# (.+)/);
            if (titleMatch) {
                this.sessionState.title = titleMatch[1];
            }
        }
        return result;
    }

    async browserClick(ref, element = '') {
        return this.sendRequest('browser_click', {
            ref,
            element: element || `Element ${ref}`
        });
    }

    async browserType(ref, text, submit = false) {
        return this.sendRequest('browser_type', {
            ref,
            text,
            submit
        });
    }

    async browserFillForm(fields) {
        return this.sendRequest('browser_fill_form', { fields });
    }

    async browserEvaluate(code) {
        return this.sendRequest('browser_evaluate', {
            function: code
        });
    }

    async browserConsoleMessages(level = 'error') {
        return this.sendRequest('browser_console_messages', { level });
    }

    async browserTakeScreenshot(filename, fullPage = false) {
        return this.sendRequest('browser_take_screenshot', {
            filename,
            fullPage
        });
    }

    async browserWaitFor(time) {
        return this.sendRequest('browser_wait_for', { time });
    }

    async browserClose() {
        return this.sendRequest('browser_close', {});
    }

    async stop() {
        if (this.mcpProcess) {
            try {
                await this.browserClose();
            } catch (e) {
                // Ignore
            }
            this.mcpProcess.kill();
            this.isConnected = false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function log(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
        INFO: '📋', SUCCESS: '✅', WARNING: '⚠️', ERROR: '❌',
        ACTION: '🎯', PLAN: '🗺️', GRAPH: '🔷', THINK: '💭',
        MCP: '🔌'
    }[level] || '📋';
    console.log(`[${timestamp}] ${emoji} ${msg}`);
}

function logJson(file, data) {
    fs.appendFileSync(file, JSON.stringify({ t: Date.now(), ...data }) + '\n');
}

function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE FINGERPRINT — Multi-signal SPA detection
// ─────────────────────────────────────────────────────────────────────────────

class StateFingerprint {
    constructor(url, title, snapshotText, elements = []) {
        this.url = url;
        this.title = title || '';
        this.snapshotText = snapshotText || '';
        this.elementCount = elements.length;
        this.urlPath = this.extractPath(url);
        this.contentHash = hashString(snapshotText.substring(0, 2000));
        this.landmarkHash = this.computeLandmarkHash(snapshotText);
        this.key = this.computeKey();
    }

    extractPath(url) {
        try {
            const u = new URL(url);
            return u.pathname + u.search + u.hash;
        } catch {
            return url;
        }
    }

    computeLandmarkHash(snapshotText) {
        // Extract headings and key landmarks
        const headings = [];
        const lines = snapshotText.split('\n');
        for (const line of lines) {
            if (line.match(/^\s*- heading\s/i)) {
                headings.push(line.trim());
            }
        }
        return hashString(headings.join('|'));
    }

    computeKey() {
        return `${this.urlPath}|${this.landmarkHash}|${this.contentHash.substring(0, 8)}`;
    }

    getShortKey() {
        return `${this.urlPath.substring(0, 30)}|${this.landmarkHash.substring(0, 6)}`;
    }

    equals(other) {
        return this.key === other.key;
    }

    delta(other) {
        const changes = [];
        if (this.urlPath !== other.urlPath) changes.push('url');
        if (this.landmarkHash !== other.landmarkHash) changes.push('landmarks');
        if (this.contentHash !== other.contentHash) changes.push('content');
        return changes;
    }

    static fromSnapshot(url, snapshotResult) {
        const text = snapshotResult?.content?.[0]?.text || '';
        const titleMatch = text.match(/# (.+)/);
        const title = titleMatch ? titleMatch[1] : '';

        // Parse elements from snapshot
        const elements = [];
        const lines = text.split('\n');
        const interactablePattern = /^\s*- (button|link|textbox|checkbox|radio|combobox|menuitem|tab|switch|heading)/i;

        for (const line of lines) {
            const match = line.match(interactablePattern);
            if (match) {
                const refMatch = line.match(/\[ref=([^\]]+)\]/);
                if (refMatch) {
                    elements.push({
                        role: match[1].toLowerCase(),
                        ref: refMatch[1],
                        text: line.replace(/\[ref=[^\]]+\]/, '').trim()
                    });
                }
            }
        }

        return new StateFingerprint(url, title, text, elements);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE GRAPH — Stores discovered states and transitions
// ─────────────────────────────────────────────────────────────────────────────

class KnowledgeGraph {
    constructor(savePath = KNOWLEDGE_GRAPH_FILE) {
        this.savePath = savePath;
        this.nodes = new Map();
        this.edges = new Map();
        this.frontier = new Set();
        this.surprises = [];
        this.load();
    }

    load() {
        if (!fs.existsSync(this.savePath)) return;
        try {
            const data = JSON.parse(fs.readFileSync(this.savePath, 'utf8'));
            this.nodes = new Map(data.nodes || []);
            this.edges = new Map(data.edges || []);
            this.frontier = new Set(data.frontier || []);
            this.surprises = data.surprises || [];
        } catch (e) {
            log(`Failed to load graph: ${e.message}`, 'WARNING');
        }
    }

    save() {
        fs.mkdirSync(path.dirname(this.savePath), { recursive: true });
        fs.writeFileSync(this.savePath, JSON.stringify({
            nodes: Array.from(this.nodes.entries()),
            edges: Array.from(this.edges.entries()),
            frontier: Array.from(this.frontier),
            surprises: this.surprises,
            savedAt: new Date().toISOString()
        }, null, 2));
    }

    addNode(stateFingerprint, consoleMessages = []) {
        const key = stateFingerprint.key;
        const existing = this.nodes.get(key);

        if (!existing) {
            this.nodes.set(key, {
                url: stateFingerprint.url,
                title: stateFingerprint.title,
                urlPath: stateFingerprint.urlPath,
                contentHash: stateFingerprint.contentHash,
                landmarkHash: stateFingerprint.landmarkHash,
                elementCount: stateFingerprint.elementCount,
                visitedAt: Date.now(),
                visitCount: 1,
                explored: false,
                consoleMessages: consoleMessages.slice(-20) // Keep last 20
            });
            this.frontier.add(key);
            log(`Graph: New state ${stateFingerprint.getShortKey()} (${stateFingerprint.elementCount} elements)`, 'GRAPH');
            
            // Log console errors immediately
            const errors = consoleMessages.filter(m => m.includes('error') || m.includes('Error') || m.includes('❌'));
            if (errors.length > 0) {
                log(`⚠️ Console errors in new state: ${errors.length}`, 'WARNING');
                errors.forEach(e => log(`  ${e.substring(0, 100)}`, 'ERROR'));
            }
        } else {
            existing.visitCount++;
            existing.lastVisited = Date.now();
            // Merge console messages
            if (consoleMessages.length > 0) {
                existing.consoleMessages = [...existing.consoleMessages, ...consoleMessages].slice(-50);
            }
        }
        return key;
    }

    recordTransition(fromState, actionRef, actionType, toState) {
        const fromKey = fromState.key;
        const toKey = toState.key;
        const edgeKey = `${fromKey}::${actionRef}`;

        const edge = this.edges.get(edgeKey) || {
            from: fromKey, actionRef, actionType,
            to: toKey, count: 0, outcomes: []
        };

        edge.count++;
        edge.outcomes.push({ to: toKey, at: Date.now() });
        this.edges.set(edgeKey, edge);

        if (!fromState.equals(toState)) {
            const delta = fromState.delta(toState);
            if (delta.length > 0) {
                this.surprises.push({
                    from: fromKey, actionRef,
                    delta, at: Date.now()
                });
            }
        }

        if (!this.nodes.has(toKey)) {
            this.frontier.add(toKey);
        }

        this.save();
    }

    getCoverageStats() {
        const total = this.nodes.size;
        const explored = total - this.frontier.size;
        return { total, explored, frontier: this.frontier.size, percent: total ? (explored / total * 100).toFixed(1) : 0 };
    }

    getRecommendedAction(fromState, elements) {
        // BFS to nearest unexplored state
        const fromKey = fromState.key;
        if (this.frontier.has(fromKey)) return null;

        const queue = [[fromKey]];
        const visited = new Set([fromKey]);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            if (this.frontier.has(current) && path.length > 1) {
                // Find edge from path[0] to path[1]
                const nextNode = path[1];
                for (const [, edge] of this.edges) {
                    if (edge.from === fromKey && edge.to === nextNode) {
                        return { ref: edge.actionRef, type: edge.actionType, confidence: 'graph_guided' };
                    }
                }
                return null;
            }

            for (const [, edge] of this.edges) {
                if (edge.from === current && !visited.has(edge.to)) {
                    visited.add(edge.to);
                    queue.push([...path, edge.to]);
                }
            }
        }
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANNER — Goal-directed mission control
// ─────────────────────────────────────────────────────────────────────────────

class Planner {
    constructor(goals, graph) {
        this.goals = goals;
        this.graph = graph;
        this.currentPlan = [];
        this.completedGoals = [];
        this.planHistory = [];
    }

    generatePlan(currentState, goal) {
        const plan = this.decomposeGoal(goal, currentState);
        this.currentPlan = plan;
        this.planHistory.push({ at: Date.now(), goal, plan: plan.map(p => p.type) });
        logJson(PLAN_TRACE_FILE, { event: 'plan_generated', goal, subtasks: plan.length });
        return plan;
    }

    decomposeGoal(goal, state) {
        const subtasks = [];

        if (goal.includes('register') || goal.includes('signup')) {
            subtasks.push(
                { type: 'find_auth_page', intent: 'Locate registration entry point' },
                { type: 'fill_form', intent: 'Complete registration fields' },
                { type: 'submit', intent: 'Submit registration' },
                { type: 'verify_success', intent: 'Confirm successful registration' }
            );
        } else if (goal.includes('login') || goal.includes('signin')) {
            subtasks.push(
                { type: 'find_auth_page', intent: 'Locate login form' },
                { type: 'fill_form', intent: 'Enter credentials' },
                { type: 'submit', intent: 'Submit login' },
                { type: 'verify_dashboard', intent: 'Confirm logged-in state' }
            );
        } else if (goal.includes('explore') || goal.includes('discover') || goal.includes('coverage')) {
            subtasks.push({ type: 'maximize_coverage', intent: 'Explore all reachable states' });
        } else {
            subtasks.push({ type: 'explore_depth', intent: `Explore deeply: ${goal}`, depth: 5 });
        }

        return subtasks;
    }

    replan(currentState, failure, completedSubtasks) {
        log(`Replanning due to: ${failure.reason}`, 'PLAN');
        const newPlan = [];

        if (failure.type === 'stuck_on_form') {
            newPlan.push(
                { type: 'backtrack', intent: 'Return to previous state' },
                { type: 'try_alternative_path', intent: 'Find different approach' }
            );
        } else if (failure.type === 'dead_end') {
            newPlan.push({ type: 'find_frontier', intent: 'Navigate to unexplored area' });
        } else if (failure.type === 'mcp_error') {
            newPlan.push({ type: 'recover', intent: 'Recover from MCP error' });
        }

        const remaining = this.currentPlan.slice(completedSubtasks.length);
        newPlan.push(...remaining);

        this.currentPlan = newPlan;
        logJson(PLAN_TRACE_FILE, { event: 'replan', reason: failure.reason, newPlan: newPlan.length });
        return newPlan;
    }

    markCompleted(subtask) {
        this.completedGoals.push({ ...subtask, completedAt: Date.now() });
    }

    checkGoalAchieved(goal, state) {
        const urlPath = state.urlPath?.toLowerCase() || '';
        const title = state.title?.toLowerCase() || '';

        if (goal.includes('register') && (urlPath.includes('welcome') || urlPath.includes('dashboard'))) return true;
        if (goal.includes('login') && (urlPath.includes('dashboard') || urlPath.includes('home'))) return true;
        if (goal.includes('coverage') && this.graph.getCoverageStats().percent > 80) return true;
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP TACTICAL EXECUTOR — Inner ReAct loop using MCP tools
// ─────────────────────────────────────────────────────────────────────────────

class MCPTacticalExecutor {
    constructor(mcpSession, graph) {
        this.mcp = mcpSession;
        this.graph = graph;
        this.visitedRefs = new Set();
        this.consecutiveStuck = 0;
        this.actionHistory = [];
    }

    async observe() {
        // Get current URL from MCP session state
        const url = this.mcp.sessionState.url || 'about:blank';

        // Take snapshot via MCP
        const snapshotResult = await this.mcp.browserSnapshot();
        const state = StateFingerprint.fromSnapshot(url, snapshotResult);

        // Parse elements from snapshot
        const elements = this.parseElementsFromSnapshot(snapshotResult);

        // Capture console messages
        let consoleMessages = [];
        try {
            const consoleResult = await this.mcp.browserConsoleMessages('error');
            if (consoleResult?.content?.[0]?.text) {
                consoleMessages = consoleResult.content[0].text.split('\n').filter(l => l.trim());
            }
        } catch (e) {
            // Console collection may not be available
        }

        this.graph.addNode(state, consoleMessages);

        return { state, elements, snapshot: snapshotResult, consoleMessages };
    }

    parseElementsFromSnapshot(snapshotResult) {
        const text = snapshotResult?.content?.[0]?.text || '';
        const elements = [];
        const lines = text.split('\n');
        const interactablePattern = /^\s*- (button|link|textbox|checkbox|radio|combobox|menuitem|tab|switch|heading)/i;

        for (const line of lines) {
            const match = line.match(interactablePattern);
            if (match) {
                const refMatch = line.match(/\[ref=([^\]]+)\]/);
                if (refMatch) {
                    elements.push({
                        role: match[1].toLowerCase(),
                        ref: refMatch[1],
                        text: line.replace(/\[ref=[^\]]+\]/, '').trim()
                    });
                }
            }
        }

        return elements;
    }

    async decide(observation, subtask) {
        const { state, elements } = observation;

        const graphAction = this.graph.getRecommendedAction(state, elements);
        if (graphAction && subtask.type !== 'backtrack') {
            log(`Graph-guided: click ref ${graphAction.ref}`, 'THINK');
            return { type: 'click', ref: graphAction.ref, source: 'graph' };
        }

        switch (subtask.type) {
            case 'find_auth_page':
                return this.decideForAuthPage(elements);
            case 'fill_form':
                return this.decideForFormFill(elements);
            case 'submit':
                return this.decideForSubmit(elements);
            case 'backtrack':
                return this.decideBacktrack(elements);
            case 'find_frontier':
            case 'maximize_coverage':
            case 'explore_depth':
            default:
                return this.decideExploration(elements);
        }
    }

    decideForAuthPage(elements) {
        const authKeywords = ['login', 'signin', 'register', 'signup', 'sign up', 'sign in', 'get started'];
        const clickable = [...elements.filter(e => e.role === 'link'), ...elements.filter(e => e.role === 'button')];

        for (const el of clickable) {
            const text = el.text.toLowerCase();
            if (authKeywords.some(k => text.includes(k))) {
                if (!this.visitedRefs.has(el.ref)) {
                    return { type: 'click', ref: el.ref, source: 'goal' };
                }
            }
        }

        return this.decideExploration(elements);
    }

    decideForFormFill(elements) {
        const textboxes = elements.filter(e => e.role === 'textbox');
        if (textboxes.length === 0) return null;

        // Generate values for each textbox
        const values = textboxes.map((box, i) => {
            if (i === 0) return `user${Date.now()}@test.local`;
            if (i === 1) return 'TestPass123!';
            return 'Test User';
        });

        return { type: 'fill_form', textboxes, values, source: 'goal' };
    }

    decideForSubmit(elements) {
        const buttons = elements.filter(e => e.role === 'button');
        const submitKeywords = ['submit', 'sign in', 'login', 'register', 'continue', 'next'];

        for (const btn of buttons) {
            const text = btn.text.toLowerCase();
            if (submitKeywords.some(k => text.includes(k))) {
                return { type: 'click', ref: btn.ref, source: 'goal' };
            }
        }

        return buttons.length > 0 ? { type: 'click', ref: buttons[0].ref, source: 'default' } : null;
    }

    decideBacktrack(elements) {
        const links = elements.filter(e => e.role === 'link');
        const backKeywords = ['back', 'home', 'cancel', 'return'];

        for (const link of links) {
            const text = link.text.toLowerCase();
            if (backKeywords.some(k => text.includes(k))) {
                return { type: 'click', ref: link.ref, source: 'backtrack' };
            }
        }

        return null;
    }

    decideExploration(elements) {
        const unvisited = elements.filter(e => !this.visitedRefs.has(e.ref));
        if (unvisited.length > 0) {
            return { type: 'click', ref: unvisited[0].ref, source: 'exploration' };
        }

        if (elements.length > 0) {
            this.visitedRefs.clear();
            return { type: 'click', ref: elements[0].ref, source: 'revisit' };
        }

        return null;
    }

    async act(decision, observation) {
        if (!decision) return { success: false, reason: 'no_decision' };

        const beforeState = observation.state;

        try {
            if (decision.type === 'fill_form') {
                // Fill form fields
                const fields = decision.textboxes.map((box, i) => ({
                    ref: box.ref,
                    value: decision.values[i]
                }));

                for (const field of fields) {
                    await this.mcp.browserType(field.ref, field.value);
                    log(`Filled ref ${field.ref}`, 'ACTION');
                }

                // Then submit
                const buttons = observation.elements.filter(e => e.role === 'button');
                if (buttons.length > 0) {
                    await this.mcp.browserClick(buttons[0].ref);
                    this.visitedRefs.add(buttons[0].ref);
                }
            } else if (decision.type === 'click') {
                await this.mcp.browserClick(decision.ref, decision.text);
                this.visitedRefs.add(decision.ref);
                log(`Clicked ref ${decision.ref}`, 'ACTION');
            }

            // Wait for potential navigation
            await this.mcp.browserWaitFor(1.5);

            // Get new state
            const afterUrl = this.mcp.sessionState.url || beforeState.url;
            const afterSnapshot = await this.mcp.browserSnapshot();
            const afterState = StateFingerprint.fromSnapshot(afterUrl, afterSnapshot);

            this.graph.recordTransition(beforeState, decision.ref, decision.type, afterState);

            const navigated = !beforeState.equals(afterState);
            const structuralChange = navigated && (beforeState.urlPath !== afterState.urlPath || beforeState.landmarkHash !== afterState.landmarkHash);

            if (structuralChange) {
                this.consecutiveStuck = 0;
                this.visitedRefs.clear();
                const delta = beforeState.delta(afterState);
                log(`🧭 Structural nav (${delta.join(',')}): ${beforeState.getShortKey()} → ${afterState.getShortKey()}`, 'SUCCESS');
            } else {
                this.consecutiveStuck++;
                if (this.consecutiveStuck >= 2) {
                    log(`⚠️ Stuck count: ${this.consecutiveStuck} (no structural change)`, 'WARNING');
                }
            }

            logJson(EXECUTION_LOG_FILE, {
                action: decision.type, ref: decision.ref, source: decision.source,
                from: beforeState.getShortKey(), to: afterState.getShortKey(),
                navigated, structuralChange, stuckCount: this.consecutiveStuck
            });

            return { success: true, navigated, structuralChange, afterState };

        } catch (e) {
            log(`Action failed: ${e.message}`, 'WARNING');
            return { success: false, reason: e.message, type: 'mcp_error' };
        }
    }

    async execute(subtask, maxSteps = 10) {
        log(`Executing subtask: ${subtask.type}`, 'ACTION');

        let completed = false;
        let failure = null;
        let step = 0;

        for (step = 0; step < maxSteps; step++) {
            const observation = await this.observe();
            log(`Step ${step + 1}/${maxSteps}: ${observation.state.getShortKey()}`, 'INFO');

            const decision = await this.decide(observation, subtask);
            if (!decision) {
                failure = { type: 'dead_end', reason: 'No actionable decision' };
                break;
            }

            const result = await this.act(decision, observation);

            if (!result.success) {
                failure = { type: result.type || 'action_failed', reason: result.reason };
                break;
            }

            if (this.consecutiveStuck >= 3) {
                failure = { type: 'stuck_on_form', reason: 'Stuck on same state' };
                break;
            }

            if (result.navigated && subtask.type === 'find_auth_page') {
                completed = true;
                break;
            }
        }

        // If loop completed without explicit failure/success
        if (!completed && !failure && step >= maxSteps - 1) {
            failure = { type: 'timeout', reason: 'Max steps reached' };
        }

        return { completed, failure, state: await this.observe() };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HYPER EXPLORER MCP — Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

class HyperExplorerMCP {
    constructor(config = {}) {
        this.config = {
            startUrl: config.startUrl || 'http://localhost:5173',
            goals: config.goals || ['explore_max_coverage'],
            maxSubtaskSteps: config.maxSubtaskSteps || 8,
            maxReplans: config.maxReplans || 3,
            headless: config.headless ?? true,
            browser: config.browser ?? 'chromium'
        };

        this.graph = new KnowledgeGraph();
        this.planner = new Planner(this.config.goals, this.graph);
        this.mcpSession = null;
        this.executor = null;
        this.startTime = Date.now();
        this.failedGoals = []; // Track failed goals for bug reports
        this.successfulGoals = []; // Track successful goals
    }

    async init() {
        log('🚀 Hyper-Explorer V2 (MCP-powered) booting...');

        fs.mkdirSync(MEMORY_DIR, { recursive: true });

        // Start MCP session
        this.mcpSession = new MCPSessionManager({
            headless: this.config.headless,
            browser: this.config.browser
        });

        await this.mcpSession.start();

        // Navigate to start URL
        await this.mcpSession.browserNavigate(this.config.startUrl);
        await this.mcpSession.browserWaitFor(2);

        // Create executor
        this.executor = new MCPTacticalExecutor(this.mcpSession, this.graph);

        log('✅ MCP session ready', 'SUCCESS');
    }

    async run() {
        await this.init();

        log(`
╔════════════════════════════════════════════════════════╗
║  HYPER-EXPLORER V2 — MCP-Powered Graph Navigation       ║
║  Target: ${this.config.startUrl.padEnd(42)} ║
║  Goals: ${this.config.goals.join(', ').padEnd(36)} ║
╚════════════════════════════════════════════════════════╝
        `);

        try {
            for (const goal of this.config.goals) {
                log(`\n🎯 Goal: ${goal}`, 'PLAN');
                await this.executeGoal(goal);
            }
        } catch (error) {
            log(`Fatal error: ${error.message}`, 'ERROR');
        } finally {
            await this.shutdown();
        }
    }

    calculateSeverity(replans, stuckCount, consoleErrors) {
        if (replans >= 3) return 'CRITICAL';
        if (consoleErrors > 0) return 'HIGH';
        if (stuckCount > 5) return 'MEDIUM';
        return 'LOW';
    }

    classifyFailure(failureType) {
        const mapping = {
            'stuck_on_form': 'FORM_VALIDATION_BUG',
            'dead_end': 'NAVIGATION_BUG',
            'timeout': 'PERFORMANCE_BUG',
            'mcp_error': 'SPA_STATE_BUG',
            'action_failed': 'INTERACTION_BUG'
        };
        return mapping[failureType] || 'UNKNOWN_BUG';
    }

    writeUXFinding(bugReport) {
        const severityEmoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[bugReport.severity];
        const category = bugReport.type.replace('_BUG', ' Failure');
        
        const finding = `
## ${severityEmoji} [${bugReport.timestamp}] ${bugReport.title}

**Severity:** ${bugReport.severity}
**Page:** ${bugReport.reproduction.url}
**Category:** ${category}

### Issue
Goal "${bugReport.goal}" failed after ${bugReport.reproduction.replans} replan attempts.
Reproduction: ${bugReport.reproduction.attemptedPlan.join(' → ')}

### Impact
Users cannot complete the intended workflow. This blocks core functionality.

### Recommendation
Investigate ${bugReport.type} at state ${bugReport.reproduction.finalState}.
Console errors: ${bugReport.technical.consoleErrorCount}
Total states discovered during attempt: ${bugReport.graphSnapshot.totalStates}

---

`;
        
        const UX_FINDINGS_FILE = path.join(MEMORY_DIR, 'ux_findings.md');
        fs.appendFileSync(UX_FINDINGS_FILE, finding);
        log(`📝 UX Finding written to watcher-compatible file`, 'INFO');
    }

    generateBugReport(goal, replans, failures, finalState) {
        const lastFailure = failures[failures.length - 1]?.failure;
        const stuckCount = this.executor.consecutiveStuck;
        const consoleErrorCount = finalState.consoleMessages?.filter(m => 
            m.includes('error') || m.includes('Error')
        ).length || 0;

        const bugReport = {
            id: `BUG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            title: `Failed Goal: ${goal}`,
            severity: this.calculateSeverity(replans, stuckCount, consoleErrorCount),
            type: this.classifyFailure(lastFailure?.type),
            goal: goal,
            reproduction: {
                attemptedPlan: this.planner.currentPlan.map(p => p.type),
                replans: replans,
                stuckCount: stuckCount,
                finalState: finalState.getShortKey(),
                url: finalState.url
            },
            technical: {
                failureType: lastFailure?.type,
                failureReason: lastFailure?.reason,
                consoleErrors: finalState.consoleMessages?.slice(0, 5) || [],
                consoleErrorCount: consoleErrorCount
            },
            graphSnapshot: {
                totalStates: this.graph.nodes.size,
                totalTransitions: this.graph.edges.size
            }
        };

        return bugReport;
    }

    async executeGoal(goal) {
        let replans = 0;
        let completed = false;
        const initialObservation = await this.executor.observe();
        let plan = this.planner.generatePlan(initialObservation.state, goal);
        const failures = [];
        let finalObservation = initialObservation;

        while (!completed && replans < this.config.maxReplans) {
            log(`\nPlan: ${plan.map(p => p.type).join(' → ')}`, 'PLAN');

            let completedSubtasks = 0;
            const cycleFailures = [];

            for (const subtask of plan) {
                const result = await this.executor.execute(subtask, this.config.maxSubtaskSteps);
                finalObservation = result.state;

                if (result.completed) {
                    this.planner.markCompleted(subtask);
                    completedSubtasks++;
                    log(`✅ Subtask complete: ${subtask.type}`, 'SUCCESS');
                } else {
                    cycleFailures.push({ subtask, failure: result.failure });
                    failures.push({ subtask, failure: result.failure });
                    break;
                }

                const currentObservation = await this.executor.observe();
                if (this.planner.checkGoalAchieved(goal, currentObservation.state)) {
                    completed = true;
                    log(`🎉 Goal achieved: ${goal}`, 'SUCCESS');
                    this.successfulGoals.push({
                        goal,
                        timestamp: Date.now(),
                        replans,
                        statesDiscovered: this.graph.nodes.size
                    });
                    break;
                }
            }

            if (!completed && cycleFailures.length > 0) {
                const failure = cycleFailures[0].failure;
                const observation = await this.executor.observe();
                plan = this.planner.replan(observation.state, failure, completedSubtasks);
                replans++;
                log(`Replan #${replans}: ${plan.map(p => p.type).join(' → ')}`, 'PLAN');
            } else if (!completed && cycleFailures.length === 0) {
                // Max steps reached without explicit failure
                break;
            } else {
                break;
            }
        }

        if (!completed) {
            log(`❌ Goal FAILED: ${goal} — Filing bug report`, 'ERROR');
            const bugReport = this.generateBugReport(goal, replans, failures, finalObservation.state);
            this.failedGoals.push(bugReport);
            
            // Write to player_bugs.jsonl immediately
            fs.appendFileSync(PLAYER_BUGS_FILE, JSON.stringify(bugReport) + '\n');
            
            // Also write to ux_findings.md for watcher compatibility
            this.writeUXFinding(bugReport);
            
            log(`📝 Bug filed: ${bugReport.id} (${bugReport.severity}) — ${bugReport.type}`, 'WARNING');
        }
    }

    async shutdown() {
        // Take final screenshot
        try {
            await this.mcpSession.browserTakeScreenshot('hyper_final.png', true);
        } catch (e) {
            // Ignore
        }

        const coverage = this.graph.getCoverageStats();
        
        // Generate console error report
        const consoleReport = [];
        for (const [key, node] of this.graph.nodes) {
            if (node.consoleMessages && node.consoleMessages.length > 0) {
                const errors = node.consoleMessages.filter(m => 
                    m.includes('error') || m.includes('Error') || m.includes('❌')
                );
                if (errors.length > 0) {
                    consoleReport.push({
                        state: key.substring(0, 40),
                        url: node.url,
                        errors: errors.slice(0, 3)
                    });
                }
            }
        }
        
        // Save console report
        if (consoleReport.length > 0) {
            const reportPath = path.join(MEMORY_DIR, 'console_errors.json');
            fs.writeFileSync(reportPath, JSON.stringify(consoleReport, null, 2));
            log(`📋 Console errors: ${consoleReport.length} states with errors`, 'WARNING');
            log(`📝 Console report: ${reportPath}`, 'INFO');
        }
        
        // Generate Player Bug Report Summary
        log(`\n╔════════════════════════════════════════════════════════╗`, 'SUCCESS');
        log(`║  🎮 PLAYER AGENT SUMMARY                              ║`, 'SUCCESS');
        log(`╚════════════════════════════════════════════════════════╝`, 'SUCCESS');
        
        if (this.successfulGoals.length > 0) {
            log(`\n✅ SUCCESSFUL GOALS: ${this.successfulGoals.length}`, 'SUCCESS');
            this.successfulGoals.forEach(g => {
                log(`   • ${g.goal} (${g.statesDiscovered} states)`, 'SUCCESS');
            });
        }
        
        if (this.failedGoals.length > 0) {
            log(`\n❌ BUGS FOUND: ${this.failedGoals.length}`, 'ERROR');
            
            const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
            this.failedGoals.forEach(bug => bySeverity[bug.severity].push(bug));
            
            Object.entries(bySeverity).forEach(([severity, bugs]) => {
                if (bugs.length > 0) {
                    const emoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }[severity];
                    log(`\n   ${emoji} ${severity}: ${bugs.length}`, severity === 'CRITICAL' ? 'ERROR' : 'WARNING');
                    bugs.forEach(bug => {
                        log(`      • ${bug.id}: ${bug.type}`, 'WARNING');
                        log(`        └─ ${bug.reproduction.finalState} | ${bug.technical.consoleErrorCount} console errors`, 'INFO');
                    });
                }
            });
            
            log(`\n📝 All bugs written to: ${PLAYER_BUGS_FILE}`, 'INFO');
        }
        
        log(`\n✅ Shutdown`, 'SUCCESS');
        log(`📊 Coverage: ${coverage.explored}/${coverage.total} (${coverage.percent}%)`);
        log(`🔷 Nodes: ${coverage.total} | Surprises: ${this.graph.surprises.length}`);
        if (consoleReport.length > 0) {
            log(`❌ Console Errors: ${consoleReport.length} states affected`);
        }
        log(`📝 Graph: ${KNOWLEDGE_GRAPH_FILE}`);
        log(`📋 Plan trace: ${PLAN_TRACE_FILE}`);
        log(`⚙️ Execution log: ${EXECUTION_LOG_FILE}`);
        log(`🔌 MCP log: ${MCP_LOG_FILE}`);

        if (this.mcpSession) {
            await this.mcpSession.stop();
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const startUrl = args[0] || 'http://localhost:5173';
const goals = [];
let maxSubtaskSteps = 8;
let headless = true;

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--max-steps') {
        maxSubtaskSteps = parseInt(args[i + 1]) || 8;
        i++;
    } else if (args[i] === '--headed') {
        headless = false;
    } else {
        goals.push(args[i]);
    }
}

if (goals.length === 0) {
    goals.push('explore_max_coverage');
}

const explorer = new HyperExplorerMCP({
    startUrl,
    goals,
    maxSubtaskSteps,
    headless
});

// Handle graceful shutdown on signals
let isShuttingDown = false;
async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[${signal}] Graceful shutdown...`);
    try {
        await explorer.shutdown();
    } catch (e) {
        // Ignore errors during shutdown
    }
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

explorer.run().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
