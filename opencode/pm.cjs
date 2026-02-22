#!/usr/bin/env node
/**
 * PM Agent V3.0 - Fully Intelligent Planning
 * Enhancements: Contextual dependencies, architectural grouping, robust patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// === CONFIG ===
const SUGGESTIONS_PATH = '/root/FutureOfDev/opencode/SUGGESTIONS.md';
const TASKS_PATH = '/root/FutureOfDev/opencode/tasks.json';
const PROJECT_ROOT = '/root/EmpoweredPixels';
const FRONTEND_ROOT = `${PROJECT_ROOT}/frontend/src`;

const CONFIG = {
  maxFilesPerTask: 5,
  maxSubtasksPerSuggestion: 5,
  planningModel: 'openrouter/google/gemini-2.5-flash-lite'
};

async function notifyTelegram(msg) {
  try {
    const control = require('./telegram-control.cjs');
    if (control.sendTelegram) await control.sendTelegram(msg);
  } catch (e) { console.error('[PM] Telegram error:', e.message); }
}

function findFilesByKeyword(keyword) {
  const results = [];
  const searchPaths = [`${FRONTEND_ROOT}/pages`, `${FRONTEND_ROOT}/features`, `${FRONTEND_ROOT}/components`, `${FRONTEND_ROOT}/views`, `${PROJECT_ROOT}/backend`];
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    try {
      const files = execSync(`find ${searchPath} -type f \\( -name "*.vue" -o -name "*.ts" -o -name "*.go" \\) 2>/dev/null`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim().split('\n').filter(Boolean);
      for (const file of files) {
        const base = path.basename(file).toLowerCase();
        const content = fs.readFileSync(file, 'utf8').toLowerCase();
        if (base.includes(keyword.toLowerCase()) || content.includes(keyword.toLowerCase())) results.push(file);
      }
    } catch (e) {}
  }
  return [...new Set(results)];
}

function findFilesByPattern(pattern) {
  const results = [];
  const patterns = { 'console.log': /console\.log\s*\(/g, 'debugger': /debugger\b/g, 'todo': /todo:\s*/i, 'fixme': /fixme:\s*/i, 'any type': /\bany\b/g, 'as any': /\sas\sany\b/g };
  const regex = patterns[pattern.toLowerCase()];
  if (!regex) return [];
  const searchPaths = [`${FRONTEND_ROOT}/pages`, `${FRONTEND_ROOT}/features`, `${FRONTEND_ROOT}/components`, `${PROJECT_ROOT}/backend`];
  for (const sp of searchPaths) {
    if (!fs.existsSync(sp)) continue;
    try {
      const files = execSync(`find ${sp} -type f \\( -name "*.vue" -o -name "*.ts" -o -name "*.js" -o -name "*.go" \\) 2>/dev/null`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim().split('\n').filter(Boolean);
      for (const file of files) {
        try { if (regex.test(fs.readFileSync(file, 'utf8'))) results.push(file); } catch (e) {}
      }
    } catch (e) {}
  }
  return [...new Set(results)];
}

function analyzeSuggestion(text) {
  const lower = text.toLowerCase();
  const intent = { type: 'unknown', keywords: [] };
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('purge')) intent.type = 'delete';
  else if (lower.includes('fix') || lower.includes('bug') || lower.includes('error')) intent.type = 'fix';
  else if (lower.includes('add') || lower.includes('create') || lower.includes('implement')) intent.type = 'feature';
  else if (lower.includes('refactor') || lower.includes('improve') || lower.includes('optimize')) intent.type = 'refactor';
  
  const viewKeywords = ['shop', 'attunement', 'attunements', 'roster', 'inventory', 'leagues', 'leaderboard', 'rankings', 'matches', 'squads', 'guilds', 'dashboard', 'home', 'login', 'register', 'profile', 'settings', 'mastery', 'daily', 'payment', 'checkout', 'cart', 'bundle', 'gold'];
  const misspellings = { 'attunments': 'attunement', 'attunment': 'attunement' };
  for (const [m, c] of Object.entries(misspellings)) if (lower.includes(m)) intent.keywords.push(c);
  for (const kw of viewKeywords) if (lower.includes(kw)) intent.keywords.push(kw);
  
  const idMatches = text.matchAll(/\b([A-Z][a-z]+[A-Z][a-z]+|\b[A-Z][a-z]+\b)/g);
  for (const m of idMatches) {
    const w = m[1];
    if (w.length > 3 && !intent.keywords.includes(w.toLowerCase())) intent.keywords.push(w.toLowerCase());
  }
  
  const patterns = ['console.log', 'debugger', 'todo', 'fixme', 'any type', 'as any', 'var '];
  for (const p of patterns) if (lower.includes(p)) intent.keywords.push(`[PATTERN:${p}]`);
  
  return intent;
}

function mapKeywordsToFiles(keywords) {
  const fileMap = {};
  for (const kw of keywords) {
    let files = kw.startsWith('[PATTERN:') ? findFilesByPattern(kw.replace('[PATTERN:', '').replace(']', '')) : findFilesByKeyword(kw);
    fileMap[kw] = files.slice(0, 10);
  }
  return fileMap;
}

// === CONTEXTUAL DEPENDENCY INFERENCE ===
function inferContextualDependencies(fileMap, suggestion) {
  const deps = [];
  const allFiles = Object.values(fileMap).flat();
  const lower = suggestion.toLowerCase();
  
  const hasGoFiles = allFiles.some(f => f.endsWith('.go'));
  const hasTestFiles = allFiles.some(f => /_test\.go$/.test(f));
  
  if (hasGoFiles && /test|mock|spec/i.test(lower) && !hasTestFiles) {
    deps.push({ type: 'go-get', packages: ['github.com/stretchr/testify'], reason: 'Testing Go code requires testify' });
  }
  
  if (allFiles.some(f => /middleware\.go$/.test(f)) && /jwt|auth|token/i.test(lower)) {
    deps.push({ type: 'go-get', packages: ['github.com/golang-jwt/jwt/v5'], reason: 'JWT handling requires jwt-go library' });
  }
  
  if (/database|sql|query|table/i.test(lower)) {
    deps.push({ type: 'note', message: 'Ensure database driver is in go.mod (e.g., lib/pq, mysql, pgx)' });
  }
  
  const hasVueFiles = allFiles.some(f => f.endsWith('.vue'));
  if (hasVueFiles && /test|spec/i.test(lower)) {
    deps.push({ type: 'npm', packages: ['@vue/test-utils', 'vitest'], reason: 'Vue component testing requires these packages' });
  }
  
  return deps;
}

function detectDependenciesEnhanced(taskDescription, fileMap) {
  const deps = [];
  const lower = taskDescription.toLowerCase();
  
  if (/oauth|google.*auth|jwt.*replace/i.test(lower)) {
    deps.push({ type: 'go-get', packages: ['golang.org/x/oauth2'], reason: 'OAuth2 integration' });
  }
  if (/migration|database.*change|new.*table/i.test(lower)) {
    deps.push({ type: 'go-get', packages: ['github.com/golang-migrate/migrate/v4'], reason: 'Database migrations' });
  }
  if (/test|mock/i.test(lower)) {
    const hasTestify = fileMap['testify'] || fileMap['mock'];
    if (!hasTestify || hasTestify.length === 0) {
      deps.push({ type: 'go-get', packages: ['github.com/stretchr/testify'], reason: 'Testing requires testify' });
    }
  }
  
  deps.push(...inferContextualDependencies(fileMap, taskDescription));
  
  const seen = new Set();
  return deps.filter(d => {
    const key = d.packages ? d.packages.join(',') : (d.message || d.type);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// === ARCHITECTURAL GROUPING ===
function groupFilesByArchitecture(fileMap) {
  const groups = {};
  for (const [keyword, files] of Object.entries(fileMap)) {
    for (const file of files) {
      let layer = 'other';
      if (file.includes('/services/') || file.includes('/service.go') || file.includes('/usecase/')) layer = 'service';
      else if (file.includes('/handlers/') || file.includes('/handler.go') || file.includes('/controller/')) layer = 'handler';
      else if (file.includes('/middleware/') || file.includes('/middleware.go')) layer = 'middleware';
      else if (file.includes('/repositories/') || file.includes('/repository.go') || file.includes('/repo.go')) layer = 'repository';
      else if (file.includes('/models/') || file.includes('/entity/') || file.includes('/model.go')) layer = 'model';
      else if (file.includes('/pages/') || file.includes('/views/')) layer = 'page';
      else if (file.includes('/components/')) layer = 'component';
      else if (file.includes('/composables/')) layer = 'composable';
      if (!groups[layer]) groups[layer] = [];
      groups[layer].push(file);
    }
  }
  return groups;
}

function createArchitecturallyGroupedSubtasks(suggestion, intent, fileMap, baseTaskId) {
  const grouped = groupFilesByArchitecture(fileMap);
  const subtasks = [];
  let subIndex = 1;
  const layerOrder = ['service', 'handler', 'middleware', 'repository', 'model', 'page', 'component', 'composable', 'other'];
  
  for (const layer of layerOrder) {
    const files = grouped[layer];
    if (!files || files.length === 0) continue;
    
    subtasks.push({
      id: `${baseTaskId}-${subIndex}`,
      status: 'pending',
      title: `${intent.type === 'delete' ? 'Delete' : 'Update'} ${layer} (${files.length} files)`,
      description: `${intent.type} for ${layer}: ${suggestion}`,
      files: files.slice(0, CONFIG.maxFilesPerTask),
      priority: 'medium',
      complexity: Math.min(5, Math.ceil(files.length / 2)),
      parent_id: baseTaskId,
      source_suggestion: suggestion,
      created_at: new Date().toISOString()
    });
    
    subIndex++;
    if (subtasks.length >= CONFIG.maxSubtasksPerSuggestion) break;
  }
  
  return subtasks;
}

function calculateComplexity(suggestion, intent, fileMap) {
  let score = 0;
  const totalFiles = Object.values(fileMap).flat().length;
  score += Math.min(5, Math.ceil(totalFiles / 2));
  const weights = { feature: 2, refactor: 1.5, fix: 1, delete: 0.5, unknown: 1 };
  score *= weights[intent.type] || 1;
  if (intent.keywords.length > 3) score += 2;
  if (intent.keywords.length > 5) score += 3;
  if (/dependency|library|package|install|import new/i.test(suggestion)) score += 2;
  if (/multiple|several|across/i.test(suggestion)) score += 2;
  return Math.min(10, Math.round(score));
}

function shouldAutoSplit(complexity, totalFiles, intent) {
  if (intent.type === 'delete') return false;
  if (complexity >= 7) return true;
  if (totalFiles > 8) return true;
  if (fileMap) {
    const grouped = groupFilesByArchitecture(fileMap);
    const layers = Object.keys(grouped).filter(l => grouped[l].length > 0);
    if (layers.length > 2) return true;
    if (layers.length === 2 && totalFiles > 5) return true;
  }
  return false;
}

function generateTask(suggestion, intent, fileMap, taskId, deps = []) {
  const allFiles = [];
  for (const files of Object.values(fileMap)) allFiles.push(...files);
  const uniqueFiles = [...new Set(allFiles)];
  const complexity = calculateComplexity(suggestion, intent, fileMap);
  
  let priority = 'medium';
  if (intent.type === 'fix') priority = 'high';
  if (complexity > 7) priority = 'high';
  
  const task = {
    id: taskId,
    status: 'pending',
    title: generateTitle(suggestion, intent),
    description: suggestion,
    files: uniqueFiles.slice(0, CONFIG.maxFilesPerTask),
    priority,
    complexity,
    source_suggestion: suggestion,
    created_at: new Date().toISOString()
  };
  
  if (uniqueFiles.length > 0) {
    task.description += `\n\n**Affected files:**\n${uniqueFiles.slice(0, 5).map(f => `- ${f}`).join('\n')}`;
  }
  
  if (deps.length > 0) {
    task.description += `\n\n**Dependencies required:**\n`;
    deps.forEach(dep => {
      task.description += `- ${dep.type}: ${dep.packages ? dep.packages.join(', ') : dep.message}\n  Reason: ${dep.reason}\n`;
    });
    task.requires_dependencies = deps;
  }
  
  return task;
}

function generateTitle(suggestion, intent) {
  const words = suggestion.split(/\s+/).slice(0, 8).join(' ');
  const prefix = { 'delete': '🗑️ Delete', 'fix': '🔧 Fix', 'feature': '✨ Add', 'refactor': '♻️ Refactor', 'unknown': '📝' };
  return `${prefix[intent.type] || '📝'} ${words}${words.length < suggestion.length ? '...' : ''}`;
}

function splitIntoSubtasks(suggestion, intent, fileMap, baseTaskId) {
  return createArchitecturallyGroupedSubtasks(suggestion, intent, fileMap, baseTaskId);
}

function needsClarification(suggestion, intent, fileMap) {
  const issues = [];
  if (intent.keywords.length === 0) issues.push('No recognizable keywords found');
  const totalFiles = Object.values(fileMap).flat().length;
  if (totalFiles === 0) issues.push('No matching files found in codebase');
  if (intent.type === 'unknown') issues.push('Could not determine intent (fix/add/delete/refactor)');
  return issues;
}

async function processSuggestion(suggestionText, existingTasks = []) {
  const intent = analyzeSuggestion(suggestionText);
  const fileMap = mapKeywordsToFiles(intent.keywords);
  const totalFiles = Object.values(fileMap).flat().length;
  
  const depsNeeded = detectDependenciesEnhanced(suggestionText, fileMap);
  const complexity = calculateComplexity(suggestionText, intent, fileMap);
  
  const issues = needsClarification(suggestionText, intent, fileMap);
  
  const maxId = existingTasks.reduce((max, t) => {
    const num = parseInt(t.id.replace('task-', '').split('-')[0]);
    return num > max ? num : max;
  }, 0);
  const nextId = `task-${String(maxId + 1).padStart(3, '0')}`;
  
  if (issues.length > 0) {
    await notifyTelegram(`⚠️ *PM NEEDS CLARIFICATION*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nIssues:\n${issues.map(i => `• ${i}`).join('\n')}\n\nPlease provide more specific details.`);
    return null;
  }
  
  const autoSplit = shouldAutoSplit(complexity, totalFiles, intent);
  
  if (autoSplit || (intent.keywords.length > 1 && totalFiles > CONFIG.maxFilesPerTask)) {
    if (autoSplit) {
      await notifyTelegram(`🔍 *PM ANALYZING (Complexity: ${complexity}/10)*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nKeywords: ${intent.keywords.join(', ')}\nFiles found: ${totalFiles}\n\n⚠️ TASK TOO COMPLEX - Auto-splitting into subtasks...`);
    } else {
      await notifyTelegram(`🔍 *PM ANALYZING*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nKeywords: ${intent.keywords.join(', ')}\nFiles found: ${totalFiles}\n\nSplitting into subtasks...`);
    }
    
    const subtasks = splitIntoSubtasks(suggestionText, intent, fileMap, nextId);
    
    if (depsNeeded.length > 0) {
      subtasks.forEach(st => {
        st.description += `\n\n**Dependencies required:**\n${depsNeeded.map(d => `- ${d.type}: ${d.packages ? d.packages.join(', ') : d.message} (${d.reason})`).join('\n')}`;
      });
    }
    
    const parentTask = {
      id: nextId,
      status: 'pending',
      title: generateTitle(suggestionText, intent),
      description: suggestionText,
      files: Object.values(fileMap).flat().slice(0, 10),
      priority: complexity > 7 ? 'high' : 'medium',
      complexity,
      has_subtasks: true,
      source_suggestion: suggestionText,
      created_at: new Date().toISOString()
    };
    
    if (depsNeeded.length > 0) {
      parentTask.description += `\n\n**Dependencies required:**\n${depsNeeded.map(d => `- ${d.type}: ${d.packages ? d.packages.join(', ') : d.message} (${d.reason})`).join('\n')}`;
      parentTask.requires_dependencies = depsNeeded;
    }
    
    return { parent: parentTask, subtasks };
  }
  
  await notifyTelegram(`🔍 *PM ANALYZING*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nKeywords: ${intent.keywords.join(', ')}\nFiles found: ${totalFiles}\nComplexity: ${complexity}/10\n\nCreating task ${nextId}...`);
  
  const task = generateTask(suggestionText, intent, fileMap, nextId, depsNeeded);
  return { parent: task, subtasks: [] };
}

async function run() {
  console.log('[PM] Starting planning session...');
  let tasksData = { tasks: [] };
  try { tasksData = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8')); } catch (e) { console.error('[PM] No tasks.json found'); }
  
  if (!fs.existsSync(SUGGESTIONS_PATH)) { console.log('[PM] No suggestions file'); return; }
  
  const suggestions = fs.readFileSync(SUGGESTIONS_PATH, 'utf8');
  const lines = suggestions.split('\n');
  const unprocessed = lines.filter(l => l.includes('[2026') && !l.includes('[PLANNED]'));
  
  if (unprocessed.length === 0) { console.log('[PM] No new suggestions'); return; }
  
  console.log(`[PM] Found ${unprocessed.length} unprocessed suggestions`);
  
  for (const line of unprocessed) {
    const match = line.match(/\] (.+)$/);
    if (!match) continue;
    
    const suggestionText = match[1].trim();
    console.log(`[PM] Processing: ${suggestionText.slice(0, 50)}...`);
    
    const result = await processSuggestion(suggestionText, tasksData.tasks);
    
    if (result) {
      tasksData.tasks.push(result.parent);
      if (result.subtasks.length > 0) tasksData.tasks.push(...result.subtasks);
      
      const newContent = suggestions.replace(line, `${line.slice(0, line.length - suggestionText.length)}[PLANNED] ${suggestionText}`);
      fs.writeFileSync(SUGGESTIONS_PATH, newContent);
      
      await notifyTelegram(`✅ *PM TASK CREATED*\nID: \`${result.parent.id}\`\nTitle: _${result.parent.title}_\nFiles: ${result.parent.files?.length || 0}`);
    }
  }
  
  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasksData, null, 2));
  console.log('[PM] Planning session complete');
}

if (require.main === module) run().catch(console.error);

module.exports = { processSuggestion, analyzeSuggestion, findFilesByKeyword };
