// Enhancements for pm.cjs

function detectDependencies(suggestion, fileMap) {
  const deps = [];
  const lower = suggestion.toLowerCase();
  
  if (/oauth|google.*auth|jwt.*replace/i.test(lower)) {
    deps.push({
      type: 'go-get',
      packages: ['golang.org/x/oauth2'],
      reason: 'OAuth2 integration'
    });
  }
  
  if (/migration|database.*change|new.*table/i.test(lower)) {
    deps.push({
      type: 'go-get',
      packages: ['github.com/golang-migrate/migrate/v4'],
      reason: 'Database migrations'
    });
  }
  
  return deps;
}

function calculateComplexity(suggestion, intent, fileMap) {
  let score = 0;
  const totalFiles = Object.values(fileMap).flat().length;
  
  score += Math.min(5, Math.ceil(totalFiles / 2));
  
  const weights = { feature: 2, refactor: 1.5, fix: 1, delete: 0.5 };
  score *= weights[intent.type] || 1;
  
  if (intent.keywords.length > 3) score += 2;
  if (/multiple|several|across/i.test(suggestion)) score += 2;
  
  return Math.min(10, Math.round(score));
}

function shouldAutoSplit(complexity, totalFiles, intent) {
  if (intent.type === 'delete') return false;
  if (complexity >= 7) return true;
  if (totalFiles > 8) return true;
  return false;
}

// Updated processSuggestion (replace existing function)
async function processSuggestion(suggestionText, existingTasks = []) {
  const intent = analyzeSuggestion(suggestionText);
  const fileMap = mapKeywordsToFiles(intent.keywords);
  const totalFiles = Object.values(fileMap).flat().length;
  
  const depsNeeded = detectDependencies(suggestionText, fileMap);
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
        st.description += `\n\n**Dependencies required:**\n${depsNeeded.map(d => `- ${d.type}: ${d.packages.join(', ')} (${d.reason})`).join('\n')}`;
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
      parentTask.description += `\n\n**Dependencies required:**\n${depsNeeded.map(d => `- ${d.type}: ${d.packages.join(', ')} (${d.reason})`).join('\n')}`;
      parentTask.requires_dependencies = depsNeeded;
    }
    
    return { parent: parentTask, subtasks };
  }
  
  await notifyTelegram(`🔍 *PM ANALYZING*\nSuggestion: _${suggestionText.slice(0, 50)}..._\n\nKeywords: ${intent.keywords.join(', ')}\nFiles found: ${totalFiles}\nComplexity: ${complexity}/10\n\nCreating task ${nextId}...`);
  
  const task = generateTask(suggestionText, intent, fileMap, nextId, depsNeeded);
  return { parent: task, subtasks: [] };
}
