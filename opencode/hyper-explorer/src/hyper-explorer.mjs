#!/usr/bin/env node
/**
 * HYPER-EXPLORER V1 — Goal-Directed Graph-Based Web Exploration
 *
 * Hierarchical ReAct architecture:
 * - Outer Loop: Mission Control (Goal-directed planning)
 * - Inner Loop: Tactical ReAct (Graph-guided execution)
 *
 * Features:
 * - Knowledge graph with coverage tracking
 * - A* pathfinding to unexplored frontiers
 * - Fast-fail replanning on stuck states
 * - Surprise detection and learning
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const CREDENTIALS_FILE = path.join(MEMORY_DIR, 'credentials.json');
const KNOWLEDGE_GRAPH_FILE = path.join(MEMORY_DIR, 'knowledge_graph.json');
const PLAN_TRACE_FILE = path.join(MEMORY_DIR, 'plan_trace.jsonl');
const EXECUTION_LOG_FILE = path.join(MEMORY_DIR, 'execution_log.jsonl');

// Telemetry
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Telemetry stub for standalone mode
const updatePlayerDashboard = (state) => {
  // No-op when running standalone
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function log(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
        INFO: '📋', SUCCESS: '✅', WARNING: '⚠️', ERROR: '❌',
        ACTION: '🎯', PLAN: '🗺️', GRAPH: '🔷', THINK: '💭'
    }[level] || '📋';
    console.log(`[${timestamp}] ${emoji} ${msg}`);
}

function logJson(file, data) {
    fs.appendFileSync(file, JSON.stringify({ t: Date.now(), ...data }) + '\n');
}

function urlToKey(url) {
    try {
        const u = new URL(url);
        return u.origin + u.pathname.replace(/\/$/, '') || u.origin + '/';
    } catch {
        return url;
    }
}

function hashElements(elements) {
    return elements.map(e => `${e.role}:${e.ref}`).sort().join('|');
}

function computeDomHash(elements) {
    // Structural hash ignoring dynamic attributes
    const structure = elements.map(e => `${e.role}:${e.ref}`).sort();
    return hashString(structure.join('|'));
}

function hashString(str) {
    // Simple djb2 hash
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
}

class StateFingerprint {
    /**
     * Multi-signal state detection for SPAs with landmark tracking
     * Combines URL path, DOM structure hash, page title, and semantic landmarks
     */
    constructor(url, title, elements, landmarks = {}, consoleMessages = []) {
        this.url = url;
        this.title = title;
        this.elementCount = elements?.length || 0;
        this.domHash = computeDomHash(elements || []);
        this.landmarks = landmarks; // { headings: [], regions: [], mainContent: hash }
        this.landmarkHash = this.computeLandmarkHash(landmarks);
        this.urlPath = this.extractPath(url);
        this.consoleMessages = consoleMessages; // Array of error strings
        this.consoleErrorCount = consoleMessages.length;
        this.key = this.computeKey();
        this.timestamp = Date.now();
    }

    extractPath(url) {
        try {
            const u = new URL(url);
            return u.pathname + u.search + u.hash;
        } catch {
            return url;
        }
    }

    computeLandmarkHash(landmarks) {
        // Hash of semantic landmarks (stable across cosmetic changes)
        const parts = [
            ...(landmarks.headings || []).map(h => `${h.level}:${h.text}`),
            ...(landmarks.regions || []).map(r => r.role),
            landmarks.mainContentHash || ''
        ];
        return hashString(parts.join('|'));
    }

    computeKey() {
        // Hierarchical key: URL path + landmark hash (primary) + DOM hash (secondary) + title
        // Landmarks are more stable than full DOM (ignores animations, toasts)
        return `${this.urlPath}|${this.landmarkHash}|${this.domHash.substring(0, 8)}|${this.title}`;
    }

    getShortKey() {
        // For display/logging
        return `${this.urlPath.substring(0, 30)}|${this.landmarkHash.substring(0, 6)}`;
    }

    equals(other) {
        return this.key === other.key;
    }

    isStructuralChange(other) {
        // True if landmarks changed (real navigation) vs cosmetic changes
        return this.urlPath !== other.urlPath || this.landmarkHash !== other.landmarkHash;
    }

    delta(other) {
        // Classified changes: structural vs cosmetic
        const changes = [];
        if (this.urlPath !== other.urlPath) changes.push('url');
        if (this.landmarkHash !== other.landmarkHash) changes.push('landmarks');
        if (this.domHash !== other.domHash) changes.push('dom');
        if (this.title !== other.title) changes.push('title');
        return changes;
    }

    static async waitForStability(page, options = {}) {
        const { timeout = 5000, interval = 200, minStableMs = 400 } = options;
        const startTime = Date.now();
        let lastHash = null;
        let stableSince = null;

        while (Date.now() - startTime < timeout) {
            const current = await this.fromPage(page, { quick: true });
            const currentHash = current.domHash;

            if (currentHash === lastHash) {
                if (stableSince && (Date.now() - stableSince >= minStableMs)) {
                    // DOM has been stable for minStableMs
                    return current;
                }
                if (!stableSince) {
                    stableSince = Date.now();
                }
            } else {
                // DOM changed, reset stability timer
                lastHash = currentHash;
                stableSince = null;
            }

            await page.waitForTimeout(interval);
        }

        // Timeout reached, return current state anyway
        log(`Stability wait timeout, proceeding with current state`, 'WARNING');
        return this.fromPage(page, { quick: true });
    }

    static async fromPage(page, options = {}) {
        const { quick = false, waitForStable = false } = options;

        // Wait for stability if requested (after navigation)
        if (waitForStable) {
            return this.waitForStability(page);
        }

        const url = page.url();
        const title = await page.title().catch(() => '');
        
        // Get console errors from page buffer
        const consoleMessages = (page._consoleErrors || []).map(e => e.text).filter(t => t);
        
        // Get structural elements and landmarks
        let elements = [];
        let landmarks = { headings: [], regions: [], mainContentHash: '' };

        try {
            const snapshot = await page._snapshotForAI({});
            const lines = (snapshot?.full || '').split('\n');
            const interactableRoles = new Set([
                'button', 'link', 'textbox', 'checkbox', 'radio',
                'combobox', 'menuitem', 'tab', 'switch', 'heading'
            ]);
            
            for (const line of lines) {
                const refMatch = line.match(/\[ref=([^\]]+)\]/);
                if (!refMatch) continue;
                const ref = refMatch[1];
                const roleMatch = line.match(/^\s*-\s*(\w+)/);
                const role = roleMatch ? roleMatch[1].toLowerCase() : 'generic';
                
                // Track interactable elements
                if (interactableRoles.has(role)) {
                    elements.push({ ref, role });
                }
                
                // Track landmarks
                if (role === 'heading') {
                    const levelMatch = line.match(/heading\s+(\d)/i);
                    const level = levelMatch ? parseInt(levelMatch[1]) : 1;
                    const text = line.replace(/\[ref=[^\]]+\]/, '').replace(/^\s*-\s*\w+\s*/, '').trim();
                    landmarks.headings.push({ ref, level, text: text.substring(0, 50) });
                }
                if (['navigation', 'main', 'complementary', 'contentinfo', 'search'].includes(role)) {
                    landmarks.regions.push({ ref, role });
                }
            }

            // Get main content hash via page eval (if not quick mode)
            if (!quick) {
                try {
                    landmarks.mainContentHash = await page.evaluate(() => {
                        const main = document.querySelector('main, [role="main"], article, .content, #content');
                        if (!main) return '';
                        // Hash of text content (ignores HTML structure changes)
                        const text = main.innerText || main.textContent || '';
                        return text.substring(0, 1000).replace(/\s+/g, ' ').trim();
                    });
                    landmarks.mainContentHash = hashString(landmarks.mainContentHash);
                } catch (e) {
                    landmarks.mainContentHash = '';
                }
            }
        } catch (e) {
            // Fallback: minimal element detection
        }

        return new StateFingerprint(url, title, elements, landmarks, consoleMessages);
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
            // Normalize nodes (add missing fields for backwards compatibility)
            const normalizedNodes = (data.nodes || []).map(([key, node]) => {
                return [key, {
                    ...node,
                    consoleErrorCount: node.consoleErrorCount || 0,
                    consoleErrors: node.consoleErrors || []
                }];
            });
            this.nodes = new Map(normalizedNodes);
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
                domHash: stateFingerprint.domHash,
                landmarkHash: stateFingerprint.landmarkHash,
                landmarks: stateFingerprint.landmarks,
                elementCount: stateFingerprint.elementCount,
                consoleErrorCount: consoleMessages.length,
                consoleErrors: consoleMessages.slice(-20), // Keep last 20 errors
                visitedAt: Date.now(),
                visitCount: 1
            });
            this.frontier.add(key);
            const landmarkInfo = stateFingerprint.landmarks.headings.length > 0
                ? ` (${stateFingerprint.landmarks.headings.length} headings)`
                : '';
            log(`Graph: New state ${stateFingerprint.getShortKey()}${landmarkInfo}`, 'GRAPH');
        } else {
            existing.visitCount++;
            existing.lastVisited = Date.now();
            // Accumulate errors (keep unique, last 50 total)
            if (consoleMessages.length > 0) {
                existing.consoleErrorCount = (existing.consoleErrorCount || 0) + consoleMessages.length;
                existing.consoleErrors = [...(existing.consoleErrors || []), ...consoleMessages]
                    .filter((v, i, a) => a.indexOf(v) === i) // dedupe
                    .slice(-50);
            }
        }
        return key;
    }

    markExplored(urlKey) {
        this.frontier.delete(urlKey);
    }

    recordTransition(fromState, actionRef, actionType, toState, predictedState = null) {
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

        // Detect surprises: state changed unexpectedly
        if (predictedState && !predictedState.equals(toState)) {
            const delta = predictedState.delta(toState);
            this.surprises.push({
                from: fromKey, actionRef,
                predicted: predictedState.getShortKey(),
                actual: toState.getShortKey(),
                delta, at: Date.now()
            });
            log(`🎉 Surprise! Expected ${predictedState.getShortKey()}, got ${toState.getShortKey()} (${delta.join(',')})`, 'THINK');
        }

        if (!this.nodes.has(toKey)) {
            this.frontier.add(toKey);
        }

        this.save();
    }

    getUnvisitedNeighbors(urlKey) {
        const neighbors = [];
        for (const [edgeKey, edge] of this.edges) {
            if (edge.from === urlKey && this.frontier.has(edge.to)) {
                neighbors.push({ edge, edgeKey });
            }
        }
        return neighbors;
    }

    findPathToFrontier(startKey) {
        if (this.frontier.has(startKey)) return [startKey];

        const queue = [[startKey]];
        const visited = new Set([startKey]);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            if (this.frontier.has(current)) return path;

            for (const [, edge] of this.edges) {
                if (edge.from === current && !visited.has(edge.to)) {
                    visited.add(edge.to);
                    queue.push([...path, edge.to]);
                }
            }
        }
        return null;
    }

    getCoverageStats() {
        const total = this.nodes.size;
        const explored = total - this.frontier.size;
        return { total, explored, frontier: this.frontier.size, percent: total ? (explored / total * 100).toFixed(1) : 0 };
    }

    getRecommendedAction(fromState, elements) {
        const fromKey = fromState.key;
        const pathToFrontier = this.findPathToFrontier(fromKey);

        if (!pathToFrontier || pathToFrontier.length < 2) return null;

        const nextNode = pathToFrontier[1];

        for (const [, edge] of this.edges) {
            if (edge.from === fromKey && edge.to === nextNode) {
                return { ref: edge.actionRef, type: edge.actionType, confidence: 'graph_guided' };
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
        } else if (goal.includes('squad') || goal.includes('roster') || goal.includes('team')) {
            subtasks.push(
                { type: 'ensure_logged_in', intent: 'Login if needed' },
                { type: 'find_squad_page', intent: 'Navigate to squad creation' },
                { type: 'create_squad', intent: 'Create fighter squad' },
                { type: 'verify_squad_created', intent: 'Confirm squad created' }
            );
        } else if (goal.includes('match') || goal.includes('play') || goal.includes('battle')) {
            subtasks.push(
                { type: 'ensure_logged_in', intent: 'Login if needed' },
                { type: 'find_match_page', intent: 'Navigate to matches list' },
                { type: 'join_match', intent: 'Join a match (Quick Join or create)' },
                { type: 'wait_for_match_start', intent: 'Wait in lobby for match to start' },
                { type: 'watch_match', intent: 'Watch battle until completion' },
                { type: 'claim_rewards', intent: 'Claim match rewards if victorious' }
            );
        } else if (goal.includes('explore') || goal.includes('discover')) {
            subtasks.push({ type: 'maximize_coverage', intent: 'Explore all reachable states' });
        } else if (goal.includes('find') || goal.includes('locate')) {
            const target = goal.replace(/find|locate/gi, '').trim();
            subtasks.push(
                { type: 'search_nav', intent: `Navigate to find: ${target}` },
                { type: 'verify_element', intent: `Confirm ${target} is present` }
            );
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
        } else if (failure.type === 'unexpected_state') {
            newPlan.push({ type: 'adapt', intent: 'Continue from current state' });
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

        if (goal.includes('register')) {
            // Success: navigated to login (after auto-redirect) or dashboard/welcome
            if (urlPath.includes('login') || urlPath.includes('welcome') || urlPath.includes('dashboard')) return true;
        }
        if (goal.includes('login')) {
            // Success: navigated to dashboard or home (or roster indicating logged in)
            if (urlPath.includes('dashboard') || urlPath.includes('home') || urlPath.includes('roster') || urlPath.includes('squad') || urlPath.includes('play')) return true;
        }
        if (goal.includes('squad') || goal.includes('roster')) {
            // Success: on squad/roster page
            if (urlPath.includes('squad') || urlPath.includes('roster') || urlPath.includes('team')) return true;
        }
        if (goal.includes('match') || goal.includes('play')) {
            // Success: on match viewer page (not just matches list)
            if (urlPath.includes('/match/')) return true;
        }
        if (goal.includes('explore') && this.graph.getCoverageStats().percent > 80) return true;
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TACTICAL EXECUTOR — Inner ReAct loop
// ─────────────────────────────────────────────────────────────────────────────

class TacticalExecutor {
    constructor(page, graph, credentials) {
        this.page = page;
        this.graph = graph;
        this.credentials = credentials;
        this.interactableRoles = new Set([
            'button', 'link', 'textbox', 'checkbox', 'radio',
            'combobox', 'menuitem', 'tab', 'switch'
        ]);
        this.actionHistory = [];
        this.consecutiveStuck = 0;
        this.visitedRefs = new Set();
    }

    async observe() {
        // Clear console buffer before snapshot to capture errors from this state only
        this.page._consoleErrors = [];

        // Use quick mode for observation (no stability wait)
        const state = await StateFingerprint.fromPage(this.page, { quick: true });
        
        let snapshotFull = '';
        let elements = [];

        try {
            const out = await this.page._snapshotForAI({});
            snapshotFull = out.full ?? '';
            elements = this.parseSnapshot(snapshotFull);
        } catch (e) {
            log(`Snapshot failed: ${e.message}`, 'WARNING');
        }

        this.graph.addNode(state, state.consoleMessages);
        return { state, elements, snapshotFull, consoleErrors: state.consoleMessages };
    }

    parseSnapshot(snapshot) {
        if (!snapshot) return [];
        const lines = snapshot.split('\n');
        const elements = [];

        for (const line of lines) {
            const refMatch = line.match(/\[ref=([^\]]+)\]/);
            if (!refMatch) continue;
            const ref = refMatch[1];
            const roleMatch = line.match(/^\s*-\s*(\w+)/);
            const role = roleMatch ? roleMatch[1].toLowerCase() : 'generic';
            if (!this.interactableRoles.has(role) && role !== 'generic') continue;
            elements.push({ ref, role, raw: line.trim() });
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
            case 'verify_success':
            case 'verify_dashboard':
            case 'verify_squad_created':
                // Just observe - goal achievement checked after this subtask
                return { type: 'observe', source: 'verify' };
            case 'ensure_logged_in':
                return this.decideForLoginCheck(elements, state);
            case 'find_squad_page':
                return this.decideForSquadNavigation(elements, state);
            case 'create_squad':
                return this.decideForSquadCreation(elements, state);
            case 'find_match_page':
                return this.decideForMatchNavigation(elements, state);
            case 'join_match':
                return this.decideToJoinMatch(elements, state);
            case 'wait_for_match_start':
                return this.decideToWaitForMatch(elements, state);
            case 'watch_match':
                return this.decideToWatchMatch(elements, state);
            case 'claim_rewards':
                return this.decideToClaimRewards(elements, state);
            case 'create_squad':
                return this.decideForSquadCreation(elements, state);
            case 'play_match':
                return this.decideForMatchPlay(elements, state);
            case 'backtrack':
                return this.decideBacktrack(elements);
            case 'find_frontier':
                return this.decideExploreFrontier(elements, state);
            case 'maximize_coverage':
            case 'explore_depth':
            default:
                return this.decideExploration(elements, state);
        }
    }

    decideForAuthPage(elements) {
        const currentUrl = this.page.url();
        const pathname = new URL(currentUrl).pathname;
        const isHome = pathname === '/' || pathname === '';

        const links = elements.filter(e => e.role === 'link');
        const buttons = elements.filter(e => e.role === 'button');
        const allControls = [...links, ...buttons];

        const loginKeywords = ['login', 'signin', 'sign in'];
        const registerKeywords = ['register', 'signup', 'sign up', 'get started', 'start your journey', 'begin your campaign', 'create account'];
        const allAuthKeywords = [...loginKeywords, ...registerKeywords];

        log(`Auth search: ${links.length} links, ${buttons.length} buttons`, 'INFO');

        // Home page: goal-specific routing
        if (isHome) {
            const isLoginGoal = this.currentGoal?.includes('login');
            const desiredKeywords = isLoginGoal ? loginKeywords : registerKeywords;

            for (const ctrl of allControls) {
                const text = ctrl.raw.toLowerCase();
                if (desiredKeywords.some(k => text.includes(k)) && !this.visitedRefs.has(ctrl.ref)) {
                    log(`✅ Found auth element: ${ctrl.ref} = "${ctrl.raw.substring(0, 50)}"`, 'ACTION');
                    return { type: 'click', ref: ctrl.ref, source: 'goal' };
                }
            }

            // No matching link: direct nav
            const target = isLoginGoal ? '/login' : '/register';
            log(`No explicit ${target} link on home, using direct nav`, 'INFO');
            const url = new URL(currentUrl);
            url.pathname = target;
            return { type: 'goto', url: url.toString(), source: 'fallback' };
        }

        // Not on home: any unvisited auth link works
        for (const ctrl of allControls) {
            const text = ctrl.raw.toLowerCase();
            if (allAuthKeywords.some(k => text.includes(k)) && !this.visitedRefs.has(ctrl.ref)) {
                log(`✅ Found auth element: ${ctrl.ref} = "${ctrl.raw.substring(0, 50)}"`, 'ACTION');
                return { type: 'click', ref: ctrl.ref, source: 'goal' };
            }
        }

        // Debug: show first few elements
        if (allControls.length > 0) {
            log(`❌ No auth keywords in first 5 elements:`, 'WARNING');
            allControls.slice(0, 5).forEach(e => {
                log(`   [${e.role}] ${e.ref}: "${e.raw.substring(0, 50)}"`, 'WARNING');
            });
        } else {
            log(`❌ No link or button elements found at all!`, 'WARNING');
        }

        // Fallback to direct navigation (to /register)
        log(`⚡ Direct navigation fallback: going to /register`, 'ACTION');
        const url = new URL(currentUrl);
        url.pathname = '/register';
        return { type: 'goto', url: url.toString(), source: 'fallback' };
    }

    decideForFormFill(elements) {
        const textboxes = elements.filter(e => e.role === 'textbox');
        if (textboxes.length === 0) return null;

        const values = this.generateFormValues(textboxes);
        return { type: 'fill', textboxes, values, source: 'goal' };
    }

    decideForSubmit(elements) {
        const buttons = elements.filter(e => e.role === 'button');
        const submitKeywords = ['submit', 'sign in', 'login', 'register', 'continue', 'next'];

        for (const btn of buttons) {
            const text = btn.raw.toLowerCase();
            if (submitKeywords.some(k => text.includes(k))) {
                return { type: 'click', ref: btn.ref, source: 'goal' };
            }
        }

        return buttons.length > 0 ? { type: 'click', ref: buttons[0].ref, source: 'default' } : null;
    }

    decideForLoginCheck(elements, state) {
        const currentUrl = this.page.url();
        const urlPath = new URL(currentUrl).pathname;

        // If on dashboard/roster/matches/squad, we're already logged in
        if (urlPath.includes('dashboard') || urlPath.includes('roster') || urlPath.includes('matches') || urlPath.includes('squad')) {
            log('Already logged in (on protected page)', 'SUCCESS');
            return { type: 'observe', source: 'logged_in' };
        }

        // Check for logout button as indicator of being logged in
        const hasLogout = elements.some(e =>
            e.raw && (e.raw.toLowerCase().includes('logout') || e.raw.toLowerCase().includes('sign out'))
        );
        if (hasLogout) {
            log('Already logged in (found logout button)', 'SUCCESS');
            return { type: 'observe', source: 'logged_in' };
        }

        // If on login page with form present, fill and submit
        if (urlPath === '/login') {
            const hasEmailField = elements.some(e => e.role === 'textbox');
            const hasLoginButton = elements.some(e => e.role === 'button' && e.raw && (e.raw.toLowerCase().includes('sign in') || e.raw.toLowerCase().includes('login')));

            if (hasEmailField && hasLoginButton) {
                log('On login page with form - filling and submitting', 'ACTION');
                return { type: 'fill_and_submit_login', source: 'login_needed' };
            }
        }

        // Not logged in and not on login page - navigate to login
        log('Not logged in, navigating to login', 'ACTION');
        const url = new URL(currentUrl);
        url.pathname = '/login';
        return { type: 'goto', url: url.toString(), source: 'login_needed' };
    }

    decideForSquadNavigation(elements, state) {
        const currentUrl = this.page.url();
        const urlPath = new URL(currentUrl).pathname;
        
        // If on login/register page, go direct to roster
        if (urlPath === '/login' || urlPath === '/register') {
            const url = new URL(currentUrl);
            url.pathname = '/roster';
            return { type: 'goto', url: url.toString(), source: 'direct_nav' };
        }
        
        // Look for squad/roster/team links
        const keywords = ['squad', 'roster', 'team', 'fighters', 'units', 'heroes'];
        
        for (const el of elements) {
            const text = el.raw.toLowerCase();
            if (keywords.some(k => text.includes(k)) && !this.visitedRefs.has(el.ref)) {
                return { type: 'click', ref: el.ref, source: 'goal' };
            }
        }
        
        // Try direct navigation to common paths
        const paths = ['/roster', '/squad', '/team', '/fighters'];
        for (const path of paths) {
            if (!currentUrl.includes(path)) {
                const url = new URL(currentUrl);
                url.pathname = path;
                return { type: 'goto', url: url.toString(), source: 'direct_nav' };
            }
        }
        
        return null;
    }

    decideForSquadCreation(elements, state) {
        // Look for create/add squad buttons
        const createKeywords = ['create', 'add', 'new', 'form', 'setup'];
        
        for (const el of elements) {
            if (el.role === 'button') {
                const text = el.raw.toLowerCase();
                if (createKeywords.some(k => text.includes(k)) && !this.visitedRefs.has(el.ref)) {
                    return { type: 'click', ref: el.ref, source: 'goal' };
                }
            }
        }
        
        // If there are textboxes, fill them (squad name, etc)
        const textboxes = elements.filter(e => e.role === 'textbox');
        if (textboxes.length > 0) {
            return this.decideForFormFill(elements);
        }
        
        // Look for any clickable element
        const clickable = elements.find(e => (e.role === 'button' || e.role === 'link') && !this.visitedRefs.has(e.ref));
        if (clickable) {
            return { type: 'click', ref: clickable.ref, source: 'explore' };
        }
        
        return null;
    }

    decideForMatchNavigation(elements, state) {
        const currentUrl = this.page.url();
        const urlPath = new URL(currentUrl).pathname;

        // If on login/register page, go direct to matches list
        if (urlPath === '/login' || urlPath === '/register') {
            log('On auth page, navigating to /matches', 'ACTION');
            const url = new URL(currentUrl);
            url.pathname = '/matches';
            return { type: 'goto', url: url.toString(), source: 'direct_nav' };
        }

        // If on matches page, look for Quick Join button
        if (urlPath === '/matches' || urlPath.includes('/matches')) {
            const quickJoinBtn = elements.find(e =>
                (e.raw && e.raw.toLowerCase().includes('quick')) ||
                (e.raw && e.raw.includes('⚡')) ||
                (e.raw && e.raw.toLowerCase().includes('join'))
            );
            if (quickJoinBtn && !this.visitedRefs.has(quickJoinBtn.ref)) {
                log('Found Quick Join button: ' + quickJoinBtn.ref, 'ACTION');
                return { type: 'click', ref: quickJoinBtn.ref, source: 'goal' };
            }

            // Look for any "join" or "play" button
            for (const el of elements) {
                if (el.role === 'button') {
                    const text = el.raw.toLowerCase();
                    if ((text.includes('join') || text.includes('play') || text.includes('begin') || text.includes('start'))
                        && !this.visitedRefs.has(el.ref)) {
                        return { type: 'click', ref: el.ref, source: 'goal' };
                    }
                }
            }
        }

        // Look for play/match/battle/game links (but filter out misleading ones)
        const keywords = ['play', 'match', 'battle', 'fight', 'game', 'pvp', 'arena'];
        const excludePatterns = ['join the arena', 'sign up', 'register', 'create account'];

        for (const el of elements) {
            const text = el.raw.toLowerCase();
            const hasMatchKeyword = keywords.some(k => text.includes(k));
            const hasExcludePattern = excludePatterns.some(p => text.includes(p));

            if (hasMatchKeyword && !hasExcludePattern && !this.visitedRefs.has(el.ref)) {
                return { type: 'click', ref: el.ref, source: 'goal' };
            }
        }

        // Try direct navigation to matches list first
        const paths = ['/matches', '/play', '/match', '/battle', '/game'];
        for (const path of paths) {
            if (!currentUrl.includes(path)) {
                const url = new URL(currentUrl);
                url.pathname = path;
                return { type: 'goto', url: url.toString(), source: 'direct_nav' };
            }
        }

        return null;
    }

    decideForMatchPlay(elements, state) {
        // Look for start/begin/play buttons
        const startKeywords = ['start', 'begin', 'play', 'fight', 'battle', 'go'];
        
        for (const el of elements) {
            if (el.role === 'button') {
                const text = el.raw.toLowerCase();
                if (startKeywords.some(k => text.includes(k)) && !this.visitedRefs.has(el.ref)) {
                    return { type: 'click', ref: el.ref, source: 'goal' };
                }
            }
        }
        
        // Any unvisited button is a candidate
        const buttons = elements.filter(e => e.role === 'button' && !this.visitedRefs.has(e.ref));
        if (buttons.length > 0) {
            return { type: 'click', ref: buttons[0].ref, source: 'default' };
        }
        
        return null;
    }

    decideToJoinMatch(elements, state) {
        // On matches page, click Quick Join or any join button
        const currentUrl = this.page.url();
        const urlPath = new URL(currentUrl).pathname;
        
        if (urlPath.includes('/matches')) {
            // Look for Quick Join button
            const quickJoin = elements.find(e => 
                e.raw && (e.raw.toLowerCase().includes('quick') || e.raw.includes('⚡'))
            );
            if (quickJoin && !this.visitedRefs.has(quickJoin.ref)) {
                log('Clicking Quick Join', 'ACTION');
                return { type: 'click', ref: quickJoin.ref, source: 'goal' };
            }
            
            // Look for any join/play/begin button
            for (const el of elements) {
                if (el.role === 'button') {
                    const text = el.raw.toLowerCase();
                    if ((text.includes('join') || text.includes('play') || text.includes('begin') || text.includes('start'))
                        && !this.visitedRefs.has(el.ref)) {
                        return { type: 'click', ref: el.ref, source: 'goal' };
                    }
                }
            }
        }
        
        // If we're being redirected to a match page, that's success
        if (urlPath.includes('/match/')) {
            log('Joined match, on match page', 'SUCCESS');
            return { type: 'observe', source: 'joined' };
        }
        
        return null;
    }

    decideToWaitForMatch(elements, state) {
        const currentUrl = this.page.url();
        const urlPath = new URL(currentUrl).pathname;
        
        // If on a match viewer page, we're in or watching a match
        if (urlPath.includes('/match/')) {
            // Check if battle is running or completed
            const hasVictory = elements.some(e => 
                e.raw && (e.raw.toLowerCase().includes('victory') || e.raw.toLowerCase().includes('defeat'))
            );
            
            if (hasVictory) {
                log('Match completed', 'SUCCESS');
                return { type: 'observe', source: 'match_complete' };
            }
            
            // Look for "Begin" button in lobby
            const beginBtn = elements.find(e =>
                e.raw && e.raw.toLowerCase().includes('begin')
            );
            if (beginBtn && !this.visitedRefs.has(beginBtn.ref)) {
                log('Clicking Begin to start match', 'ACTION');
                return { type: 'click', ref: beginBtn.ref, source: 'goal' };
            }
            
            // Otherwise just observe/wait
            return { type: 'observe', source: 'waiting' };
        }
        
        return null;
    }

    decideToWatchMatch(elements, state) {
        // Just wait and observe - match plays automatically
        const hasVictory = elements.some(e => 
            e.raw && (e.raw.toLowerCase().includes('victory') || e.raw.toLowerCase().includes('defeat'))
        );
        
        if (hasVictory) {
            log('Match ended with result', 'SUCCESS');
            return { type: 'observe', source: 'match_ended' };
        }
        
        return { type: 'observe', source: 'watching' };
    }

    decideToClaimRewards(elements, state) {
        const currentUrl = this.page.url();
        
        // Only on match page
        if (!currentUrl.includes('/match/')) {
            return null;
        }
        
        // Look for claim rewards button
        const claimBtn = elements.find(e => 
            e.raw && (e.raw.toLowerCase().includes('claim') || e.raw.toLowerCase().includes('rewards'))
        );
        if (claimBtn && !this.visitedRefs.has(claimBtn.ref)) {
            log('Clicking Claim Rewards', 'ACTION');
            return { type: 'click', ref: claimBtn.ref, source: 'goal' };
        }
        
        // Look for exit/continue button if no rewards
        const exitBtn = elements.find(e => 
            e.raw && (e.raw.toLowerCase().includes('exit') || e.raw.toLowerCase().includes('continue'))
        );
        if (exitBtn && !this.visitedRefs.has(exitBtn.ref)) {
            return { type: 'click', ref: exitBtn.ref, source: 'exit' };
        }
        
        return { type: 'observe', source: 'checking_rewards' };
    }

    decideBacktrack(elements) {
        const links = elements.filter(e => e.role === 'link');
        const backKeywords = ['back', 'home', 'cancel', 'return'];

        for (const link of links) {
            const text = link.raw.toLowerCase();
            if (backKeywords.some(k => text.includes(k))) {
                return { type: 'click', ref: link.ref, source: 'backtrack' };
            }
        }

        return null;
    }

    decideExploreFrontier(elements, currentState) {
        const unvisited = elements.filter(e => !this.visitedRefs.has(e.ref));
        if (unvisited.length > 0) {
            return { type: 'click', ref: unvisited[0].ref, source: 'frontier' };
        }

        const links = elements.filter(e => e.role === 'link');
        return links.length > 0 ? { type: 'click', ref: links[0].ref, source: 'default' } : null;
    }

    decideExploration(elements, currentState) {
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

    generateFormValues(textboxes) {
        // Use smarter field mapping based on labels/placeholders
        const values = [];
        // For registration, always generate new credentials; for login, use stored ones
        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        const isRegistration = this.currentGoal?.includes('register');

        const email = (isRegistration || !this.credentials?.email) ? `explorer${uniqueId}@test.local` : this.credentials.email;
        const password = (isRegistration || !this.credentials?.password) ? 'SecurePass123!' : this.credentials.password;
        const name = (isRegistration || !this.credentials?.name) ? `Explorer_${uniqueId.substring(0, 6)}` : this.credentials.name;

        // Update executor credentials to match what was generated
        this.credentials = { email, password, name };

        for (const tb of textboxes) {
            const rawLower = (tb.raw || '').toLowerCase();
            // Try to infer field type from label or placeholder
            if (rawLower.includes('email') || rawLower.includes('@')) {
                values.push(email);
            } else if (rawLower.includes('password') || rawLower.includes('••') || rawLower.includes('***')) {
                values.push(password);
            } else if (rawLower.includes('username') || rawLower.includes('user') || rawLower.includes('commander')) {
                values.push(name);
            } else {
                // Fallback: use email for first, password for second, name for others
                values.push(values.length === 0 ? email : values.length === 1 ? password : name);
            }
        }
        return values;
    }

    async act(decision, observation) {
        if (!decision) return { success: false, reason: 'no_decision' };

        const beforeState = observation.state;

        try {
            if (decision.type === 'fill_and_click') {
                for (let i = 0; i < decision.textboxes.length; i++) {
                    const ref = decision.textboxes[i].ref;
                    const value = decision.values[i];
                    await this.page.locator(`aria-ref=${ref}`).fill(String(value), { timeout: 3000 });
                    log(`Filled ref ${ref} with ${value.slice(0, 10)}...`, 'ACTION');
                }

                const buttons = observation.elements.filter(e => e.role === 'button');
                if (buttons.length > 0) {
                    await this.page.locator(`aria-ref=${buttons[0].ref}`).click({ timeout: 5000 });
                    this.visitedRefs.add(buttons[0].ref);
                    log(`Clicked submit button`, 'ACTION');
                    
                    // Special case: if on /register and clicking submit, assume success and navigate to /login
                    const currentUrl = this.page.url();
                    if (currentUrl.includes('/register')) {
                        log(`✅ Registration submitted, navigating to /login`, 'SUCCESS');
                        await this.page.goto(currentUrl.replace('/register', '/login'), { waitUntil: 'domcontentloaded', timeout: 30000 });
                    }
                }
            } else if (decision.type === 'goto') {
                log(`Navigating directly to ${decision.url}`, 'ACTION');
                await this.page.goto(decision.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                // No ref to mark as visited for goto actions
            } else if (decision.type === 'fill') {
                for (let i = 0; i < decision.textboxes.length; i++) {
                    const ref = decision.textboxes[i].ref;
                    const value = decision.values[i];
                    await this.page.locator(`aria-ref=${ref}`).fill(String(value), { timeout: 3000 });
                    log(`Filled ref ${ref} with ${value.slice(0, 10)}...`, 'ACTION');
                }
            } else if (decision.type === 'fill_and_submit_login') {
                // Special handling for login form submission
                const { email, password } = this.credentials;

                // Find all textboxes (login form has 2: email/username and password)
                const textboxes = observation.elements.filter(e => e.role === 'textbox');
                
                if (textboxes.length >= 1) {
                    // Fill first textbox with email
                    await this.page.locator(`aria-ref=${textboxes[0].ref}`).fill(email, { timeout: 3000 });
                    log(`Filled email: ${email}`, 'ACTION');
                }

                if (textboxes.length >= 2) {
                    // Fill second textbox with password
                    await this.page.locator(`aria-ref=${textboxes[1].ref}`).fill(password, { timeout: 3000 });
                    log(`Filled password`, 'ACTION');
                }

                // Find and click login button
                const loginBtn = observation.elements.find(e =>
                    e.role === 'button' && e.raw && (e.raw.toLowerCase().includes('sign in') || e.raw.toLowerCase().includes('login'))
                );
                if (loginBtn) {
                    await this.page.locator(`aria-ref=${loginBtn.ref}`).click({ timeout: 5000 });
                    this.visitedRefs.add(loginBtn.ref);
                    log(`Clicked login button`, 'ACTION');
                }
            } else if (decision.type === 'observe') {
                // Verification subtask: just observe, no action needed
                log('Verification observation', 'INFO');
                // We'll still snapshot state below
            } else if (decision.type === 'click') {
                await this.page.locator(`aria-ref=${decision.ref}`).click({ timeout: 5000 });
                this.visitedRefs.add(decision.ref);
                log(`Clicked ref ${decision.ref}`, 'ACTION');

                // Register app doesn't auto-redirect after submit → help it
                const currentUrl = this.page.url();
                if (currentUrl.includes('/register')) {
                    log(`✅ Register submit clicked, navigating to /login`, 'SUCCESS');
                    await this.page.goto(currentUrl.replace('/register', '/login'), { waitUntil: 'domcontentloaded', timeout: 30000 });
                }
            }

            // Wait for DOM stability before snapshotting (handles SPAs, animations)
            const afterState = await StateFingerprint.fromPage(this.page, { waitForStable: true });

            // For goto actions, use special ref like '__direct__'
            const actionRef = decision.ref || decision.url || '__direct__';
            this.graph.recordTransition(beforeState, actionRef, decision.type, afterState);

            // SPA-aware navigation detection with structural change classification
            const navigated = !beforeState.equals(afterState);
            const structuralChange = navigated && beforeState.isStructuralChange(afterState);
            const delta = navigated ? beforeState.delta(afterState) : [];
            
            if (navigated) {
                this.consecutiveStuck = 0;
                if (structuralChange) {
                    this.visitedRefs.clear();
                    log(`🧭 Structural nav (${delta.join(',')}): ${beforeState.getShortKey()} → ${afterState.getShortKey()}`, 'SUCCESS');
                } else {
                    log(`🎨 Cosmetic change (${delta.join(',')}): ${afterState.getShortKey()}`, 'INFO');
                }
            } else {
                this.consecutiveStuck++;
            }

            logJson(EXECUTION_LOG_FILE, {
                action: decision.type, ref: decision.ref, source: decision.source,
                from: beforeState.getShortKey(), to: afterState.getShortKey(),
                navigated, structuralChange, delta, stuckCount: this.consecutiveStuck
            });

            return { success: true, navigated, structuralChange, afterState };

        } catch (e) {
            log(`Action failed: ${e.message}`, 'WARNING');
            return { success: false, reason: e.message };
        }
    }

    async execute(subtask, maxSteps = 10) {
        log(`Executing subtask: ${subtask.type}`, 'ACTION');

        let completed = false;
        let failure = null;

        for (let step = 0; step < maxSteps; step++) {
            const observation = await this.observe();
            log(`Step ${step + 1}/${maxSteps}: ${observation.state.getShortKey()}`, 'INFO');

            const decision = await this.decide(observation, subtask);
            if (!decision) {
                failure = { type: 'dead_end', reason: 'No actionable decision' };
                break;
            }

            const result = await this.act(decision, observation);

            if (!result.success) {
                failure = { type: 'action_failed', reason: result.reason };
                break;
            }

            if (this.consecutiveStuck >= 3) {
                failure = { type: 'stuck_on_form', reason: 'Stuck on same state (no structural change)' };
                break;
            }

            if (result.navigated && subtask.type === 'find_auth_page') {
                completed = true;
                break;
            }

            if (subtask.type === 'fill_form' && decision.type === 'fill') {
                completed = true;
                break;
            }

            if (subtask.type === 'submit' && decision.type === 'click') {
                completed = true;
                break;
            }

            if (subtask.type === 'verify_success' || subtask.type === 'verify_dashboard' || subtask.type === 'verify_squad_created') {
                completed = true;
                break;
            }

            // ensure_logged_in only completes when we confirm we're logged in (on protected page or found logout)
            // NOT when we just navigated - we need to actually login first
            if (subtask.type === 'ensure_logged_in') {
                const urlPath = result.state?.urlPath?.toLowerCase() || '';
                const onProtectedPage = urlPath.includes('dashboard') || urlPath.includes('roster') || urlPath.includes('matches');
                
                if (onProtectedPage || decision.type === 'observe') {
                    completed = true;
                    break;
                }
                // Otherwise continue - don't mark complete yet
            }

            if ((subtask.type === 'find_squad_page' || subtask.type === 'find_match_page') && result.navigated) {
                completed = true;
                break;
            }

            if (subtask.type === 'create_squad' && (decision.type === 'fill' || decision.type === 'click')) {
                completed = true;
                break;
            }

            if ((subtask.type === 'start_match' || subtask.type === 'complete_match') && decision.type === 'click') {
                completed = true;
                break;
            }

            if (step === maxSteps - 1) {
                failure = { type: 'timeout', reason: 'Max steps reached' };
            }
        }

        return { completed, failure, state: await this.observe() };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HYPER EXPLORER — Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

class HyperExplorer {
    constructor(config = {}) {
        const fileCreds = this._loadCredentialsFile();
        this.config = {
            startUrl: config.startUrl || 'http://localhost:5173',
            goals: config.goals || ['explore_max_coverage'],
            maxSubtaskSteps: config.maxSubtaskSteps || 8,
            maxReplans: config.maxReplans || 3,
            credentials: {
                email: config.email ?? fileCreds.email ?? `explorer${Date.now()}@test.local`,
                password: config.password ?? fileCreds.password ?? 'SecurePass123!',
                name: config.name ?? fileCreds.name ?? 'Test Explorer'
            }
        };

        this.graph = new KnowledgeGraph();
        this.planner = new Planner(this.config.goals, this.graph);
        this.browser = null;
        this.page = null;
        this.executor = null;
        this.startTime = Date.now();
        this.consoleErrors = []; // Buffer for current state's console errors
    }

    _loadCredentialsFile() {
        if (!fs.existsSync(CREDENTIALS_FILE)) return {};
        try {
            const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
            return { email: data.email, password: data.password, name: data.name };
        } catch (e) {
            return {};
        }
    }

    async _sendTelemetry(phase, extra = {}) {
        try {
            const coverage = this.graph.getCoverageStats();
            updatePlayerDashboard({
                taskId: `Hyper: ${this.config.goals[0]}`,
                startTime: this.startTime,
                latestThought: extra.latestThought || phase,
                metrics: {
                    cost: '0.00',
                    loops: this.graph.surprises.length,
                    quality: extra.quality || 'Good'
                },
                phases: {
                    outer: { status: phase },
                    coverage: `${coverage.explored}/${coverage.total} (${coverage.percent}%)`
                }
            });
        } catch (e) {
            log(`Telemetry error: ${e.message}`, 'ERROR');
        }
    }

    async init() {
        log('🚀 Hyper-Explorer V1 booting...');

        fs.mkdirSync(MEMORY_DIR, { recursive: true });

        this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        this.page = await this.browser.newPage({ viewport: { width: 1280, height: 720 } });

        // Initialize console error buffer on page for cross-module access
        this.page._consoleErrors = [];

        // Capture console errors
        this.page.on('console', (msg) => {
            if (msg.type() === 'error') {
                const text = msg.text();
                this.page._consoleErrors.push({
                    timestamp: Date.now(),
                    text: text,
                    location: msg.location() || ''
                });
                log(`[Console Error] ${text.substring(0, 100)}`, 'WARNING');
            }
        });

        this.executor = new TacticalExecutor(this.page, this.graph, this.config.credentials);

        log('✅ Ready', 'SUCCESS');
    }

    async run() {
        await this.init();

        log(`
╔════════════════════════════════════════════════════════╗
║  HYPER-EXPLORER V1 — Goal-Directed Graph Navigation     ║
║  Target: ${this.config.startUrl.padEnd(42)} ║
║  Goals: ${this.config.goals.join(', ').padEnd(36)} ║
╚════════════════════════════════════════════════════════╝
        `);

        try {
            await this.page.goto(this.config.startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            // Clear initial navigation errors
            this.page._consoleErrors = [];

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

    async executeGoal(goal) {
        let replans = 0;
        let completed = false;
        const initialObservation = await this.executor.observe();
        // Set current goal in executor for goal-aware decisions
        this.executor.currentGoal = goal;
        let plan = this.planner.generatePlan(initialObservation.state, goal);

        while (!completed && replans < this.config.maxReplans) {
            log(`\nPlan: ${plan.map(p => p.type).join(' → ')}`, 'PLAN');

            let completedSubtasks = 0;
            const failures = [];

            for (const subtask of plan) {
                const result = await this.executor.execute(subtask, this.config.maxSubtaskSteps);

                if (result.completed) {
                    this.planner.markCompleted(subtask);
                    completedSubtasks++;
                    log(`✅ Subtask complete: ${subtask.type}`, 'SUCCESS');
                } else {
                    failures.push({ subtask, failure: result.failure });
                    break;
                }

                const currentObservation = await this.executor.observe();
                if (this.planner.checkGoalAchieved(goal, currentObservation.state)) {
                    completed = true;
                    log(`🎉 Goal achieved: ${goal}`, 'SUCCESS');
                    break;
                }
            }

            if (!completed && failures.length > 0) {
                const failure = failures[0].failure;
                const observation = await this.executor.observe();
                plan = this.planner.replan(observation.state, failure, completedSubtasks);
                replans++;
                log(`Replan #${replans}: ${plan.map(p => p.type).join(' → ')}`, 'PLAN');

                await this._sendTelemetry(`Replanning (${replans}/${this.config.maxReplans})`);
            } else {
                break;
            }
        }

        if (!completed) {
            log(`Goal not achieved: ${goal}`, 'WARNING');
        } else if (goal.includes('register')) {
            // Save credentials after successful registration for subsequent tests
            const creds = this.executor.credentials;
            fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
            log(`💾 Saved credentials: ${creds.email}`, 'INFO');
        }

        await this._sendTelemetry(completed ? 'Goal Complete' : 'Goal Incomplete', {
            quality: completed ? 'Success' : 'Partial'
        });
    }

    async shutdown() {
        if (this.page) await this.page.screenshot({ path: path.join(MEMORY_DIR, 'hyper_final.png'), fullPage: true });

        const coverage = this.graph.getCoverageStats();
        log(`\n✅ Shutdown`, 'SUCCESS');
        log(`📊 Coverage: ${coverage.explored}/${coverage.total} (${coverage.percent}%)`);
        log(`🔷 Nodes: ${coverage.total} | Surprises: ${this.graph.surprises.length}`);
        log(`📝 Graph: ${KNOWLEDGE_GRAPH_FILE}`);
        log(`📋 Plan trace: ${PLAN_TRACE_FILE}`);
        log(`⚙️ Execution log: ${EXECUTION_LOG_FILE}`);

        // Export console errors for Player Agent consumption
        this.exportConsoleErrors();

        if (this.browser) await this.browser.close();
    }

    exportConsoleErrors() {
        const errorsFile = path.join(MEMORY_DIR, 'console_errors.json');
        const entries = [];
        for (const [key, node] of this.graph.nodes) {
            if (node.consoleErrors && node.consoleErrors.length > 0) {
                entries.push({
                    state: key,
                    url: node.url,
                    errors: node.consoleErrors
                });
            }
        }
        fs.writeFileSync(errorsFile, JSON.stringify(entries, null, 2));
        log(`📋 Console errors: ${entries.length} states with errors`, 'INFO');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const explorer = new HyperExplorer({
    startUrl: args[0] || 'http://localhost:5173',
    goals: args.slice(1) || ['explore_max_coverage']
});

explorer.run().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
