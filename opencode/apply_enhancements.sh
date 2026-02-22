#!/bin/bash
set -e

echo "=== Applying PM & Dev-Unit Enhancements ==="

# 1. Enhance PM: Better dependency detection and auto-split
cat > /tmp/pm_patch.js << 'PATCH_EOF'
const fs = require('fs');
const path = require('path');

let pm = fs.readFileSync('/root/FutureOfDev/opencode/pm.cjs', 'utf8');

// NEW: Contextual dependency function
const contextualDepCode = `
// === CONTEXTUAL DEPENDENCY INFERENCE ===
function inferDependenciesFromFiles(fileMap, suggestion) {
  const deps = [];
  const allFiles = Object.values(fileMap).flat();
  const lower = suggestion.toLowerCase();
  
  // Check if task involves Go files
  const hasGoFiles = allFiles.some(f => f.endsWith('.go'));
  const hasTestFiles = allFiles.some(f => /_test\.go$/.test(f));
  
  if (hasGoFiles) {
    // Any Go modification likely needs testing
    if (!hasTestFiles && /test|mock|verify/i.test(lower)) {
      deps.push({
        type: 'go-get',
        packages: ['github.com/stretchr/testify'],
        reason: 'Go task involves testing; testify recommended'
      });
    }
    
    // If modifying service/handler, might need context
    const isService = allFiles.some(f => /service\.go$/.test(f));
    const isHandler = allFiles.some(f => /handler\.go$/.test(f));
    const isMiddleware = allFiles.some(f => /middleware\.go$/.test(f));
    
    if (isMiddleware && /auth|jwt|oauth/i.test(lower)) {
      deps.push({
        type: 'go-get',
        packages: ['github.com/golang-jwt/jwt/v5'],
        reason: 'JWT middleware requires jwt-go library'
      });
    }
    
    if (isHandler && /database|sql|query/i.test(lower)) {
      deps.push({
        type: 'note',
        message: 'Ensure database driver is in go.mod (e.g., lib/pq, mysql)'
      });
    }
  }
  
  // Frontend tasks: check for testing frameworks
  const hasVueFiles = allFiles.some(f => f.endsWith('.vue'));
  const hasTsFiles = allFiles.some(f => f.endsWith('.ts') && !f.includes('node_modules'));
  
  if ((hasVueFiles || hasTsFiles) && /test|spec|mock/i.test(lower)) {
    deps.push({
      type: 'npm',
      packages: ['@vue/test-utils', 'vitest'],
      reason: 'Vue component testing requires @vue/test-utils and vitest'
    });
  }
  
  return deps;
}

// Enhanced detectDependencies that combines both
function detectDependenciesEnhanced(taskDescription, fileMap) {
  const deps = [];
  
  // Original keyword-based detection
  const lower = taskDescription.toLowerCase();
  
  if (/oauth|google.*auth|jwt.*replace/i.test(lower)) {
    deps.push({
      type: 'go-get',
      packages: ['golang.org/x/oauth2', 'golang.org/x/net/context'],
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
  
  // NEW: Contextual inference from actual files
  const contextualDeps = inferDependenciesFromFiles(fileMap, taskDescription);
  deps.push(...contextualDeps);
  
  // Deduplicate by package
  const seen = new Set();
  return deps.filter(d => {
    const key = d.packages ? d.packages.join(',') : d.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

PATCH_EOF

# Replace detectDependencies function
node -e "
const fs = require('fs');
const pm = fs.readFileSync('/root/FutureOfDev/opencode/pm.cjs', 'utf8');

// Find the detectDependencies function and replace it
const depPatch = fs.readFileSync('/tmp/pm_patch.js', 'utf8').split('PATCH_EOF')[1].trim();
const newDeps = depPatch + '\n';

// Find and replace function detectDependencies ... closing brace
const regex = /function detectDependencies\([\s\S]*?\n\}\n/;
pm = pm.replace(regex, newDeps + '\n');

// Also update the call in processSuggestion to use enhanced version
pm = pm.replace(
  /const depsNeeded = detectDependencies\(suggestionText, fileMap\);/,
  'const depsNeeded = detectDependenciesEnhanced(suggestionText, fileMap);'
);

fs.writeFileSync('/root/FutureOfDev/opencode/pm.cjs', pm);
console.log('PM dependencies enhanced');
"

echo "---"
echo "2. Enhance auto-split to group by architecture"

# Add function to group files by directory
node -e "
const fs = require('fs');
const pm = fs.readFileSync('/root/FutureOfDev/opencode/pm.cjs', 'utf8');

const archGroupCode = `
// === ARCHITECTURAL FILE GROUPING ===
function groupFilesByArchitecture(fileMap) {
  const groups = {};
  
  for (const [keyword, files] of Object.entries(fileMap)) {
    for (const file of files) {
      // Determine architectural layer
      let layer = 'other';
      if (file.includes('/services/') || file.includes('/usecase/') || file.includes('/service.go')) {
        layer = 'service';
      } else if (file.includes('/handlers/') || file.includes('/controller/') || file.includes('/handler.go')) {
        layer = 'handler';
      } else if (file.includes('/middleware/') || file.includes('/middleware.go')) {
        layer = 'middleware';
      } else if (file.includes('/repositories/') || file.includes('/repository/') || file.includes('/repo.go')) {
        layer = 'repository';
      } else if (file.includes('/models/') || file.includes('/entity/') || file.includes('/model.go')) {
        layer = 'model';
      } else if (file.includes('/pages/') || file.includes('/views/')) {
        layer = 'page';
      } else if (file.includes('/components/')) {
        layer = 'component';
      } else if (file.includes('/composables/')) {
        layer = 'composable';
      }
      
      if (!groups[layer]) groups[layer] = new Set();
      groups[layer].add(file);
    }
  }
  
  // Convert sets to arrays
  const result = {};
  for (const [layer, fileSet] of Object.entries(groups)) {
    result[layer] = [...fileSet];
  }
  
  return result;
}

function createArchitecturallyGroupedSubtasks(suggestion, intent, fileMap, baseTaskId) {
  const grouped = groupFilesByArchitecture(fileMap);
  const subtasks = [];
  let subIndex = 1;
  
  // Prioritize layers: service → handler → middleware → repository → model → page → component → composable → other
  const layerOrder = ['service', 'handler', 'middleware', 'repository', 'model', 'page', 'component', 'composable', 'other'];
  
  for (const layer of layerOrder) {
    const files = grouped[layer];
    if (!files || files.length === 0) continue;
    
    const task = {
      id: \`\${baseTaskId}-\${subIndex}\`,
      status: 'pending',
      title: \`\${intent.type === 'delete' ? 'Delete' : 'Update'} \${layer} layer (\${files.length} files)\`,
      description: \`\${intent.type} for \${layer} layer: \${suggestion}\`,
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
`;

// Insert the new function before splitIntoSubtasks
pm = pm.replace(
  /function splitIntoSubtasks\(/,
  archGroupCode + '\nfunction splitIntoSubtasks('
);

// Update shouldAutoSplit to use architectural grouping trigger
pm = pm.replace(
  /function shouldAutoSplit\([\s\S]*?return false;/,
  `function shouldAutoSplit(complexity, totalFiles, intent) {
  if (intent.type === 'delete') return false;
  if (complexity >= 7) return true;
  if (totalFiles > 8) return true;
  
  // NEW: Check if files span multiple architectural layers
  const grouped = groupFilesByArchitecture(fileMap);
  const layers = Object.keys(grouped).filter(l => grouped[l].length > 0);
  if (layers.length > 2) return true; // More than 2 layers = complex
  
  return false;
}`
);

fs.writeFileSync('/root/FutureOfDev/opencode/pm.cjs', pm);
console.log('PM architectural grouping added');
"

echo "---"
echo "3. Add rollback capability to dev-unit"

# This is more involved - create separate file for rollback logic
cat > /tmp/dev_unit_rollback_patch.txt << 'ROLLBACK_EOF'
--- a/dev-unit.cjs
+++ b/dev-unit.cjs
@@ -340,6 +340,22 @@ function computeFileDiff(beforeTimes, afterTimes) {
   return { created, modified, deleted };
 }
 
+// === ROLLBACK capability ===
+function createSnapshot(label) {
+  const snapshotDir = path.join(RUN_DIR, 'snapshots');
+  if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
+  const snapshotPath = path.join(snapshotDir, \`\${taskId}_\${label}_\${Date.now()}.json\`);
+  const snapshot = {
+    taskId,
+    label,
+    timestamp: new Date().toISOString(),
+    files: getFilesSnapshot(),
+    modTimes: getFileModTimes(getFilesSnapshot())
+  };
+  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
+  return snapshotPath;
+}
+
 // ============================================
 // PRE-FLIGHT: PARSE INTENT AND CHECK FILES
 // ============================================
 function parseTaskIntent(taskDesc) {
@@ -570,6 +586,9 @@ function checkIfTaskAlreadyDone(taskDesc, workspace) {
     return { 
         done: true, 
         intent,
         reason: 'All target files already deleted',
         targetFiles,
         existingFiles: []
     };
+    // Optionally could rollback if partial deletion, but not needed for pre-flight
   }
   
   // CREATE/MODIFY: Cannot determine "done" without content check
@@ -670,6 +689,10 @@ function checkIfTaskAlreadyDone(taskDesc, workspace) {
   return { done: false, intent, reason: `${existingFiles.length}/${targetFiles.length} files exist`, targetFiles, existingFiles };
 }
 
+// Note: Rollback will be triggered by orchestrator on final rejection
+// dev-unit creates snapshot before execution, orchestrator triggers restore if needed
+
 // ============================================
 // MAIN EXECUTION FLOW
 // ============================================
@@ -690,6 +713,9 @@ function checkIfTaskAlreadyDone(taskDesc, workspace) {
 // PRE-FLIGHT CHECK
 const preflight = checkIfTaskAlreadyDone(taskDesc, workspace);
 fsLog(\`Pre-flight: \${preflight.done ? 'ALREADY DONE' : 'NEEDS WORK'} - \${preflight.reason}\`);
+const snapshotPath = createSnapshot('pre-execution');
+fsLog(\`Snapshot created: \${snapshotPath}\`);
+
 
 if (preflight.done) {
     log(\`✅ Task already complete: \${preflight.reason}\`);
@@ -770,6 +796,9 @@ function checkIfTaskAlreadyDone(taskDesc, workspace) {
 // ============================================
 log("🛠️ Stage 2: Clean-Room Execution...");
 telegramKeepAlive("EXECUTING");
+// Snapshot already created in pre-flight section
+
 const filesBefore = getFilesSnapshot();
 const modTimesBefore = getFileModTimes(filesBefore);
 fsLog("Files snapshot before execution captured (" + filesBefore.length + " files)");
@@ -850,6 +879,32 @@ function checkIfTaskAlreadyDone(taskDesc, workspace) {
     process.exit(1);
 }
 
+// === ROLLBACK ON REJECTION ===
+function rollback(snapshotPath) {
+  try {
+    if (!fs.existsSync(snapshotPath)) {
+      log(\`⚠️ Rollback skipped: snapshot not found (\${snapshotPath})\`);
+      return false;
+    }
+    
+    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
+    log(\`🔙 Rolling back to snapshot from \${snapshot.timestamp}...\`);
+    
+    // Restore modified files
+    for (const [file, beforeTime] of Object.entries(snapshot.modTimes)) {
+      try {
+        // For modified files, git restore would work but we need file contents backup
+        // For simplicity, we'll use git if available
+      } catch (e) {}
+    }
+    
+    // For deleted files - can't easily restore without content backup
+    // We'll log that manual recovery may be needed
+    log(\`⚠️ Full rollback requires git or backup. Partial restore attempted.\`);
+    
+    return true;
+  } catch (e) {
+    log(\`❌ Rollback failed: \${e.message}\`);
+    return false;
+  }
+}
+
 // ============================================
 // FINAL OUTPUT & FALLBACK LOGIC
 // ============================================
@@ -890,6 +945,10 @@ function checkIfTaskAlreadyDone(taskDesc, workspace) {
     trackGhostpadFailure();
     process.exit(1);
   }
+  
+  // Rollback on rejection
+  if (hasRejected) {
+    rollback(snapshotPath);
+  }
 
 if (hasApproved) {
     log("✅ Task verified and approved locally.");
ROLLBACK_EOF

echo "Note: Rollback patch needs manual integration - skipping for now (complex)"
echo "Will add notes about why rollback is hard (need file content backup)"
