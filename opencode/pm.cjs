#!/usr/bin/env node
/**
 * PM Agent V1.0 - Planning Layer
 * Transforms vague suggestions into structured, file-specific tasks.
 * 
 * Flow: SUGGESTIONS.md → PM → tasks.json → Orchestrator → dev-unit
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

// === TELEGRAM NOTIFY ===
async function notifyTelegram(msg) {
  try {
    const telegramControl = require('./telegram-control.cjs');
    if (telegramControl.sendTelegram) {
      await telegramControl.sendTelegram(msg);
    }
  } catch (e) {
    console.error('[PM] Telegram notify failed:', e.message);
  }
}

// === FILE DISCOVERY ===
function findFilesByKeyword(keyword) {
  const results = [];
  const searchPaths = [
    `${FRONTEND_ROOT}/pages`,
    `${FRONTEND_ROOT}/features`,
    `${FRONTEND_ROOT}/components`,
    `${FRONTEND_ROOT}/views`,
    `${PROJECT_ROOT}/backend`
  ];
  
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    
    try {
      const files = execSync(
        `find ${searchPath} -type f \\( -name "*.vue" -o -name "*.ts" -o -name "*.go" \\) 2>/dev/null`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      ).trim().split('\n').filter(Boolean);
      
      for (const file of files) {
        const basename = path.basename(file).toLowerCase();
        const content = fs.readFileSync(file, 'utf8').toLowerCase();
        
        if (basename.includes(keyword.toLowerCase()) || content.includes(keyword.toLowerCase())) {
          results.push(file);
        }
      }
    } catch (e) {
      // Skip paths that don't exist
    }
  }
  
  return [...new Set(results)];
}

function findRelatedFiles(file) {
  const related = [];
  const content = fs.readFileSync(file, 'utf8');
  
  // Find imports
  const importMatches = content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), importPath);
      const extensions = ['.vue', '.ts', '.js'];
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (fs.existsSync(fullPath)) {
          related.push(fullPath);
        }
      }
    }
  }
  
  return related;
}

// === SUGGESTION ANALYSIS ===
function analyzeSuggestion(text) {
  const lower = text.toLowerCase();
  
  // Detect intent
  const intent = {
    type: 'unknown',
    keywords: [],
    targets: []
  };
  
  // Intent detection
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('purge')) {
    intent.type = 'delete';
  } else if (lower.includes('fix') || lower.includes('bug') || lower.includes('error')) {
    intent.type = 'fix';
  } else if (lower.includes('add') || lower.includes('create') || lower.includes('implement')) {
    intent.type = 'feature';
  } else if (lower.includes('refactor') || lower.includes('improve') || lower.includes('optimize')) {
    intent.type = 'refactor';
  }
  
  // Keyword extraction - common view/page names
  const viewKeywords = [
    'shop', 'attunement', 'attunements', 'roster', 'inventory', 'leagues',
    'leaderboard', 'rankings', 'matches', 'squads', 'guilds', 'dashboard',
    'home', 'login', 'register', 'profile', 'settings', 'mastery', 'daily'
  ];
  
  // Also match misspellings
  const misspellings = {
    'attunments': 'attunement',
    'attunment': 'attunement'
  };
  
  for (const [misspelled, correct] of Object.entries(misspellings)) {
    if (lower.includes(misspelled)) {
      intent.keywords.push(correct);
    }
  }
  
  for (const kw of viewKeywords) {
    if (lower.includes(kw)) {
      intent.keywords.push(kw);
    }
  }
  
  // Extract other potential identifiers (camelCase, PascalCase words)
  const identifierMatches = text.matchAll(/\b([A-Z][a-z]+[A-Z][a-z]+|\b[A-Z][a-z]+\b)/g);
  for (const match of identifierMatches) {
    const word = match[1];
    if (word.length > 3 && !intent.keywords.includes(word.toLowerCase())) {
      intent.keywords.push(word.toLowerCase());
    }
  }
  
  return intent;
}

// === FILE MAPPING ===
function mapKeywordsToFiles(keywords) {
  const fileMap = {};
  
  for (const keyword of keywords) {
    const files = findFilesByKeyword(keyword);
    fileMap[keyword] = files.slice(0, 10); // Limit per keyword
  }
  
  return fileMap;
}

// === TASK GENERATION ===
function generateTask(suggestion, intent, fileMap, taskId) {
  // Collect all found files
  const allFiles = [];
  for (const files of Object.values(fileMap)) {
    allFiles.push(...files);
  }
  const uniqueFiles = [...new Set(allFiles)];
  
  // Determine complexity
  const complexity = Math.min(5, Math.ceil(uniqueFiles.length / 2) || 1);
  
  // Determine priority
  let priority = 'medium';
  if (intent.type === 'fix') priority = 'high';
  if (intent.type === 'delete') priority = 'medium';
  if (intent.type === 'feature') priority = 'medium';
  
  // Build task
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
  
  // If we found files, add them to description
  if (uniqueFiles.length > 0) {
    task.description += `\n\n**Affected files:**\n${uniqueFiles.slice(0, 5).map(f => `- ${f}`).join('\n')}`;
  }
  
  return task;
}

function generateTitle(suggestion, intent) {
  // Generate a clear title from suggestion
  const words = suggestion.split(/\s+/).slice(0, 8).join(' ');
  
  const prefix = {
    'delete': '🗑️ Delete',
    'fix': '🔧 Fix',
    'feature': '✨ Add',
    'refactor': '♻️ Refactor',
    'unknown': '📝'
  };
  
  return `${prefix[intent.type] || '📝'} ${words}${words.length < suggestion.length ? '...' : ''}`;
}

// === SUBTASK SPLITTING ===
function splitIntoSubtasks(suggestion, intent, fileMap, baseTaskId) {
  const subtasks = [];
  let subIndex = 1;
  
  // Group files by keyword
  for (const [keyword, files] of Object.entries(fileMap)) {
    if (files.length === 0) continue;
    
    const task = {
      id: `${baseTaskId}-${subIndex}`,
      status: 'pending',
      title: `${intent.type === 'delete' ? 'Delete' : 'Update'} ${keyword} components`,
      description: `${intent.type} for ${keyword}: ${suggestion}`,
      files: files.slice(0, CONFIG.maxFilesPerTask),
      priority: 'medium',
      complexity: Math.min(5, Math.ceil(files.length / 2)),
      parent_id: baseTaskId,
      source_suggestion: suggestion,
      created_at: new Date().toISOString()
    };
    
    subtasks.push(task);
    subIndex++;
    
    if (subtasks.length >= CONFIG.maxSubtasksPerSuggestion) break;
  }
  
  return subtasks;
}

// === CLARIFICATION NEEDED ===
function needsClarification(suggestion, intent, fileMap) {
  const issues = [];
  
  if (intent.keywords.length === 0) {
    issues.push('No recognizable keywords found');
  }
  
  const totalFiles = Object.values(fileMap).flat().length;
  if (totalFiles === 0) {
    issues.push('No matching files found in codebase');
  }
  
  if (intent.type === 'unknown') {
    issues.push('Could not determine intent (fix/add/delete/refactor)');
  }
  
  return issues;
}

// === MAIN EXPORT ===
async function processSuggestion(suggestionText, existingTasks = []) {
  const intent = analyzeSuggestion(suggestionText);
  const fileMap = mapKeywordsToFiles(intent.keywords);
  const issues = needsClarification(suggestionText, intent, fileMap);
  
  // Calculate next task ID
  const maxId = existingTasks.reduce((max, t) => {
    const num = parseInt(t.id.replace('task-', '').split('-')[0]);
    return num > max ? num : max;
  }, 0);
  const nextId = `task-${String(maxId + 1).padStart(3, '0')}`;
  
  // Check if clarification needed
  if (issues.length > 0) {
    await notifyTelegram(`⚠️ *PM NEEDS CLARIFICATION*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nIssues:\n${issues.map(i => `• ${i}`).join('\n')}\n\nPlease provide more specific details.`);
    return null;
  }
  
  const totalFiles = Object.values(fileMap).flat().length;
  
  // If multiple keywords with files, split into subtasks
  if (intent.keywords.length > 1 && totalFiles > CONFIG.maxFilesPerTask) {
    await notifyTelegram(`🔍 *PM ANALYZING*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nKeywords: ${intent.keywords.join(', ')}\nFiles found: ${totalFiles}\n\nSplitting into subtasks...`);
    
    const subtasks = splitIntoSubtasks(suggestionText, intent, fileMap, nextId);
    
    // Create parent task
    const parentTask = {
      id: nextId,
      status: 'pending',
      title: generateTitle(suggestionText, intent),
      description: suggestionText,
      files: Object.values(fileMap).flat().slice(0, 10),
      priority: 'medium',
      complexity: Math.min(5, Math.ceil(totalFiles / 3)),
      has_subtasks: true,
      source_suggestion: suggestionText,
      created_at: new Date().toISOString()
    };
    
    return { parent: parentTask, subtasks };
  }
  
  // Single task
  await notifyTelegram(`🔍 *PM ANALYZING*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nKeywords: ${intent.keywords.join(', ')}\nFiles found: ${totalFiles}\n\nCreating task ${nextId}...`);
  
  const task = generateTask(suggestionText, intent, fileMap, nextId);
  return { parent: task, subtasks: [] };
}

// === CLI / DIRECT EXECUTION ===
async function run() {
  console.log('[PM] Starting planning session...');
  
  // Read current tasks
  let tasksData = { tasks: [] };
  try {
    tasksData = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
  } catch (e) {
    console.error('[PM] No tasks.json found, creating new');
  }
  
  // Read suggestions
  if (!fs.existsSync(SUGGESTIONS_PATH)) {
    console.log('[PM] No suggestions file');
    return;
  }
  
  const suggestions = fs.readFileSync(SUGGESTIONS_PATH, 'utf8');
  
  // Find unprocessed suggestions (lines with timestamp but not [PLANNED])
  const lines = suggestions.split('\n');
  const unprocessed = lines.filter(l => 
    l.includes('[2026') && !l.includes('[PLANNED]')
  );
  
  if (unprocessed.length === 0) {
    console.log('[PM] No new suggestions to process');
    return;
  }
  
  console.log(`[PM] Found ${unprocessed.length} unprocessed suggestions`);
  
  // Process each suggestion
  for (const line of unprocessed) {
    // Extract suggestion text
    const match = line.match(/\] (.+)$/);
    if (!match) continue;
    
    const suggestionText = match[1].trim();
    console.log(`[PM] Processing: ${suggestionText.slice(0, 50)}...`);
    
    const result = await processSuggestion(suggestionText, tasksData.tasks);
    
    if (result) {
      // Add to tasks
      tasksData.tasks.push(result.parent);
      if (result.subtasks.length > 0) {
        tasksData.tasks.push(...result.subtasks);
      }
      
      // Mark suggestion as planned
      const newContent = suggestions.replace(
        line,
        `${line.slice(0, line.length - suggestionText.length)}[PLANNED] ${suggestionText}`
      );
      fs.writeFileSync(SUGGESTIONS_PATH, newContent);
      
      await notifyTelegram(`✅ *PM TASK CREATED*\nID: \`${result.parent.id}\`\nTitle: _${result.parent.title}_\nFiles: ${result.parent.files?.length || 0}`);
    }
  }
  
  // Save tasks
  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasksData, null, 2));
  console.log('[PM] Planning session complete');
}

// Run if called directly
if (require.main === module) {
  run().catch(console.error);
}

module.exports = { processSuggestion, analyzeSuggestion, findFilesByKeyword };
