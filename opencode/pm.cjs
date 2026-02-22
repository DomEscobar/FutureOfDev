#!/usr/bin/env node
/**
 * PM Agent V4.0 - Pure Planning Layer
 * Refactored: No file discovery (delegated to dev-unit)
 * Outputs: Intent, Keywords, Subtask Skeletons, Dependencies
 */

const fs = require('fs');
const path = require('path');

// === CONFIG ===
const SUGGESTIONS_PATH = '/root/FutureOfDev/opencode/SUGGESTIONS.md';
const TASKS_PATH = '/root/FutureOfDev/opencode/tasks.json';

const CONFIG = {
  maxSubtasksPerSuggestion: 5,
  planningModel: 'openrouter/google/gemini-2.5-flash-lite'
};

async function notifyTelegram(msg) {
  try {
    const control = require('./telegram-control.cjs');
    if (control.sendTelegram) await control.sendTelegram(msg);
  } catch (e) { console.error('[PM] Telegram error:', e.message); }
}

// === INTENT ANALYSIS ===
function analyzeSuggestion(text) {
  const lower = text.toLowerCase();
  const intent = { type: 'unknown', keywords: [] };
  
  // Intent detection
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('purge')) intent.type = 'delete';
  else if (lower.includes('fix') || lower.includes('bug') || lower.includes('error')) intent.type = 'fix';
  else if (lower.includes('add') || lower.includes('create') || lower.includes('implement')) intent.type = 'create';
  else if (lower.includes('refactor') || lower.includes('improve') || lower.includes('optimize')) intent.type = 'refactor';
  
  // Domain keywords
  const viewKeywords = ['shop', 'attunement', 'attunements', 'roster', 'inventory', 'leagues', 'leaderboard', 'rankings', 'matches', 'squads', 'guilds', 'dashboard', 'home', 'login', 'register', 'profile', 'settings', 'mastery', 'daily', 'payment', 'checkout', 'cart', 'bundle', 'gold'];
  const techKeywords = ['oauth', 'jwt', 'auth', 'api', 'database', 'migration', 'test', 'config', 'middleware', 'handler', 'service', 'model', 'component', 'page'];
  
  const misspellings = { 'attunments': 'attunement', 'attunment': 'attunement' };
  for (const [m, c] of Object.entries(misspellings)) if (lower.includes(m)) intent.keywords.push(c);
  for (const kw of viewKeywords) if (lower.includes(kw)) intent.keywords.push(kw);
  for (const kw of techKeywords) if (lower.includes(kw)) intent.keywords.push(kw);
  
  // Capitalized terms (likely identifiers)
  const idMatches = text.matchAll(/\b([A-Z][a-z]+[A-Z][a-z]+|\b[A-Z][a-z]+\b)/g);
  for (const m of idMatches) {
    const w = m[1];
    if (w.length > 3 && !intent.keywords.includes(w.toLowerCase())) intent.keywords.push(w.toLowerCase());
  }
  
  // Pattern keywords (for dev-unit to search)
  const patterns = ['console.log', 'debugger', 'todo', 'fixme', 'any type', 'as any', 'var '];
  for (const p of patterns) if (lower.includes(p)) intent.keywords.push(`[PATTERN:${p}]`);
  
  return intent;
}

// === LAYER INFERENCE ===
function inferLayersFromKeywords(keywords, suggestion) {
  const layers = [];
  const lower = suggestion.toLowerCase();
  
  // Backend layers
  if (keywords.includes('middleware') || /middleware|jwt|auth|token/i.test(lower)) layers.push({ layer: 'middleware', keywords: keywords.filter(k => /jwt|auth|token|middleware/i.test(k)) });
  if (keywords.includes('handler') || /handler|route|endpoint|api/i.test(lower)) layers.push({ layer: 'handler', keywords: keywords.filter(k => /handler|route|api/i.test(k)) });
  if (keywords.includes('service') || /service|logic|business/i.test(lower)) layers.push({ layer: 'service', keywords: keywords.filter(k => /service/i.test(k)) });
  if (keywords.includes('model') || /model|entity|schema|database/i.test(lower)) layers.push({ layer: 'model', keywords: keywords.filter(k => /model|entity|schema/i.test(k)) });
  
  // Frontend layers
  if (keywords.includes('page') || /page|view|route/i.test(lower)) layers.push({ layer: 'page', keywords: keywords.filter(k => /page|view/i.test(k)) });
  if (keywords.includes('component') || /component|widget|ui/i.test(lower)) layers.push({ layer: 'component', keywords: keywords.filter(k => /component/i.test(k)) });
  if (keywords.includes('composable') || /composable|hook|use/i.test(lower)) layers.push({ layer: 'composable', keywords: keywords.filter(k => /composable|use/i.test(k)) });
  
  // If no specific layers detected, add a default
  if (layers.length === 0) {
    layers.push({ layer: 'unspecified', keywords });
  }
  
  return layers;
}

// === DEPENDENCY INFERENCE ===
function inferDependencies(keywords, suggestion) {
  const deps = [];
  const lower = suggestion.toLowerCase();
  
  if (/oauth|google.*auth|jwt.*replace/i.test(lower)) {
    deps.push({ type: 'go-get', packages: ['golang.org/x/oauth2'], reason: 'OAuth2 integration' });
  }
  if (/migration|database.*change|new.*table/i.test(lower)) {
    deps.push({ type: 'go-get', packages: ['github.com/golang-migrate/migrate/v4'], reason: 'Database migrations' });
  }
  if (/test|mock|spec/i.test(lower)) {
    deps.push({ type: 'go-get', packages: ['github.com/stretchr/testify'], reason: 'Testing requires testify' });
  }
  if (/jwt|token/i.test(lower)) {
    deps.push({ type: 'go-get', packages: ['github.com/golang-jwt/jwt/v5'], reason: 'JWT handling' });
  }
  
  return deps;
}

// === COMPLEXITY SCORING ===
function calculateComplexity(suggestion, intent) {
  let score = 0;
  
  // Keyword complexity
  if (intent.keywords.length > 3) score += 2;
  if (intent.keywords.length > 5) score += 3;
  
  // Intent weight
  const weights = { create: 2, refactor: 1.5, fix: 1, delete: 0.5, unknown: 1 };
  score *= weights[intent.type] || 1;
  
  // Indicator keywords
  if (/dependency|library|package|install|import new/i.test(suggestion)) score += 2;
  if (/multiple|several|across|all|every/i.test(suggestion)) score += 2;
  if (/migration|schema|database/i.test(suggestion)) score += 2;
  if (/api|endpoint|route/i.test(suggestion)) score += 1;
  
  return Math.min(10, Math.round(score));
}

// === SPLIT DECISION ===
function shouldAutoSplit(complexity, intent, suggestion) {
  if (intent.type === 'delete') return false;
  if (complexity >= 7) return true;
  
  const lower = suggestion.toLowerCase();
  if (/multiple|several|across|all|every/i.test(lower)) return true;
  if (/migration|oauth|integration/i.test(lower)) return true;
  
  return false;
}

// === TASK GENERATION ===
function generateTaskSkeleton(suggestion, intent, taskId, complexity, deps) {
  const title = generateTitle(suggestion, intent);
  
  let priority = 'medium';
  if (intent.type === 'fix') priority = 'high';
  if (complexity > 7) priority = 'high';
  
  const task = {
    id: taskId,
    status: 'pending',
    title,
    description: suggestion,
    intent: intent.type,
    keywords: intent.keywords,
    files: [],  // Filled by dev-unit during discovery
    priority,
    complexity,
    discovery_status: 'pending',  // pending, done, ambiguous
    source_suggestion: suggestion,
    created_at: new Date().toISOString()
  };
  
  if (deps.length > 0) {
    task.requires_dependencies = deps;
    task.description += `\n\n**Dependencies:** ${deps.map(d => d.packages ? d.packages.join(', ') : d.message).join(', ')}`;
  }
  
  return task;
}

function generateTitle(suggestion, intent) {
  const words = suggestion.split(/\s+/).slice(0, 8).join(' ');
  const prefix = { 'delete': '🗑️ Delete', 'fix': '🔧 Fix', 'create': '✨ Create', 'refactor': '♻️ Refactor', 'unknown': '📝' };
  return `${prefix[intent.type] || '📝'} ${words}${words.length < suggestion.length ? '...' : ''}`;
}

// === SUBTASK SKELETON GENERATION ===
function generateSubtaskSkeletons(suggestion, intent, baseTaskId, deps) {
  const layers = inferLayersFromKeywords(intent.keywords, suggestion);
  const subtasks = [];
  
  // If single layer, no subtasks needed
  if (layers.length <= 1) {
    return [];
  }
  
  // Create subtask skeleton for each layer
  let subIndex = 1;
  for (const layerInfo of layers) {
    if (subtasks.length >= CONFIG.maxSubtasksPerSuggestion) break;
    
    subtasks.push({
      id: `${baseTaskId}-${subIndex}`,
      status: 'pending',
      title: `${intent.type === 'delete' ? 'Delete' : 'Update'} ${layerInfo.layer} layer`,
      description: `${intent.type} for ${layerInfo.layer}: ${suggestion}`,
      intent: intent.type,
      keywords: layerInfo.keywords.length > 0 ? layerInfo.keywords : intent.keywords,
      layer: layerInfo.layer,
      files: [],  // Filled by dev-unit during discovery
      priority: 'medium',
      parent_id: baseTaskId,
      discovery_status: 'pending',
      source_suggestion: suggestion,
      created_at: new Date().toISOString()
    });
    
    subIndex++;
  }
  
  // Add dependencies to all subtasks
  if (deps.length > 0) {
    subtasks.forEach(st => {
      st.requires_dependencies = deps;
    });
  }
  
  return subtasks;
}

// === CLARIFICATION CHECK ===
function needsClarification(suggestion, intent) {
  const issues = [];
  
  if (intent.keywords.length === 0) {
    issues.push('No recognizable keywords found');
  }
  
  if (intent.type === 'unknown') {
    issues.push('Could not determine intent (fix/create/delete/refactor)');
  }
  
  // Check for ambiguous CREATE (might be MODIFY if feature exists)
  if (intent.type === 'create') {
    // dev-unit will check existence, but we flag it
    intent.needs_existence_check = true;
  }
  
  return issues;
}

// === MAIN PROCESSING ===
async function processSuggestion(suggestionText, existingTasks = []) {
  console.log('[PM] Analyzing suggestion...');
  
  const intent = analyzeSuggestion(suggestionText);
  const complexity = calculateComplexity(suggestionText, intent);
  const deps = inferDependencies(intent.keywords, suggestionText);
  
  const issues = needsClarification(suggestionText, intent);
  
  const maxId = existingTasks.reduce((max, t) => {
    const num = parseInt(t.id.replace('task-', '').split('-')[0]);
    return num > max ? num : max;
  }, 0);
  const nextId = `task-${String(maxId + 1).padStart(3, '0')}`;
  
  if (issues.length > 0) {
    await notifyTelegram(`⚠️ *PM NEEDS CLARIFICATION*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nIssues:\n${issues.map(i => `• ${i}`).join('\n')}\n\nPlease provide more specific details.`);
    return null;
  }
  
  const autoSplit = shouldAutoSplit(complexity, intent, suggestionText);
  
  // Notify about analysis
  await notifyTelegram(`🔍 *PM ANALYSIS*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nIntent: ${intent.type}\nKeywords: ${intent.keywords.join(', ') || 'none'}\nComplexity: ${complexity}/10\nDependencies: ${deps.length > 0 ? deps.map(d => d.packages?.join('+') || d.message).join(', ') : 'none'}\n${autoSplit ? '\n⚠️ Will split into subtasks' : ''}`);
  
  if (autoSplit) {
    const subtasks = generateSubtaskSkeletons(suggestionText, intent, nextId, deps);
    
    const parentTask = {
      id: nextId,
      status: 'pending',
      title: generateTitle(suggestionText, intent),
      description: suggestionText,
      intent: intent.type,
      keywords: intent.keywords,
      files: [],  // No file discovery in PM
      priority: complexity > 7 ? 'high' : 'medium',
      complexity,
      has_subtasks: true,
      requires_discovery: true,  // Flag for dev-unit
      discovery_status: 'pending',
      source_suggestion: suggestionText,
      created_at: new Date().toISOString()
    };
    
    if (deps.length > 0) {
      parentTask.requires_dependencies = deps;
    }
    
    console.log(`[PM] Created parent task ${nextId} with ${subtasks.length} subtask skeletons`);
    return { parent: parentTask, subtasks };
  }
  
  // Single task
  const task = generateTaskSkeleton(suggestionText, intent, nextId, complexity, deps);
  task.requires_discovery = true;
  
  console.log(`[PM] Created task ${nextId} (discovery pending)`);
  return { parent: task, subtasks: [] };
}

// === CLI ENTRYPOINT ===
async function run() {
  console.log('[PM] Starting planning session...');
  
  let tasksData = { tasks: [] };
  try {
    tasksData = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
  } catch (e) {
    console.error('[PM] No tasks.json found, creating new');
  }
  
  // FIX #2: Handle tasks that need splitting
  const needsSplitTasks = tasksData.tasks.filter(t => t.needs_split === true || t.status === 'needs_split');
  if (needsSplitTasks.length > 0) {
    console.log(`[PM] Found ${needsSplitTasks.length} tasks needing split`);
    
    for (const task of needsSplitTasks) {
      console.log(`[PM] Splitting task ${task.id}...`);
      
      // Create subtasks based on original task
      const intent = { type: task.intent || 'unknown', keywords: task.keywords || [] };
      const deps = task.requires_dependencies || [];
      const subtasks = generateSubtaskSkeletons(task.description || task.source_suggestion, intent, task.id, deps);
      
      if (subtasks.length > 0) {
        // Update parent task
        task.has_subtasks = true;
        task.needs_split = false;
        task.status = 'pending';
        delete task.split_reason;
        
        // Add subtasks
        tasksData.tasks.push(...subtasks);
        
        await notifyTelegram(`✂️ *PM TASK SPLIT*\nParent: \`${task.id}\`\nSubtasks: ${subtasks.length}\n${subtasks.map(s => `• ${s.id}: ${s.layer}`).join('\n')}`);
        
        console.log(`[PM] Created ${subtasks.length} subtasks for ${task.id}`);
      } else {
        // Could not split - reset to pending
        task.status = 'pending';
        task.needs_split = false;
        console.log(`[PM] Could not split task ${task.id}, returning to pending`);
      }
    }
    
    fs.writeFileSync(TASKS_PATH, JSON.stringify(tasksData, null, 2));
  }
  
  if (!fs.existsSync(SUGGESTIONS_PATH)) {
    console.log('[PM] No suggestions file');
    return;
  }
  
  const suggestions = fs.readFileSync(SUGGESTIONS_PATH, 'utf8');
  const lines = suggestions.split('\n');
  const unprocessed = lines.filter(l => l.includes('[2026') && !l.includes('[PLANNED]'));
  
  if (unprocessed.length === 0) {
    console.log('[PM] No new suggestions');
    return;
  }
  
  console.log(`[PM] Found ${unprocessed.length} unprocessed suggestions`);
  
  for (const line of unprocessed) {
    const match = line.match(/\] (.+)$/);
    if (!match) continue;
    
    const suggestionText = match[1].trim();
    console.log(`[PM] Processing: ${suggestionText.slice(0, 50)}...`);
    
    const result = await processSuggestion(suggestionText, tasksData.tasks);
    
    if (result) {
      tasksData.tasks.push(result.parent);
      if (result.subtasks.length > 0) {
        tasksData.tasks.push(...result.subtasks);
      }
      
      // Mark as planned
      const newContent = suggestions.replace(line, `${line.slice(0, line.length - suggestionText.length)}[PLANNED] ${suggestionText}`);
      fs.writeFileSync(SUGGESTIONS_PATH, newContent);
      
      await notifyTelegram(`✅ *PM TASK CREATED*\nID: \`${result.parent.id}\`\nIntent: ${result.parent.intent}\nKeywords: ${result.parent.keywords?.join(', ') || 'none'}\nDiscovery: pending`);
    }
  }
  
  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasksData, null, 2));
  console.log('[PM] Planning session complete');
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { 
  processSuggestion, 
  analyzeSuggestion, 
  inferLayersFromKeywords,
  calculateComplexity,
  shouldAutoSplit
};