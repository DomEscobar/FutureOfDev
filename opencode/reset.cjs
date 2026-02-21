const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * AGENCY RESET SCRIPT
 * Clears all tasks, logs, and contexts.
 */

const AGENCY_ROOT = __dirname;
const TASKS_PATH = path.join(AGENCY_ROOT, 'tasks.json');
const RUN_DIR = path.join(AGENCY_ROOT, '.run');
const CONTEXT_DIR = path.join(RUN_DIR, 'context');
const SUGGESTIONS_PATH = path.join(AGENCY_ROOT, 'SUGGESTIONS.md');

console.log("🧹 [RESET] Starting full agency cleanup...");

// 1. Reset tasks.json to empty state
const emptyTasks = { tasks: [] };
fs.writeFileSync(TASKS_PATH, JSON.stringify(emptyTasks, null, 2));
console.log("✅ [TASKS] Backlog cleared.");

// 2. Clear context files
if (fs.existsSync(CONTEXT_DIR)) {
    const files = fs.readdirSync(CONTEXT_DIR);
    for (const file of files) {
        fs.unlinkSync(path.join(CONTEXT_DIR, file));
    }
    console.log(`✅ [CONTEXT] ${files.length} verdict files deleted.`);
}

// 3. Reset SUGGESTIONS.md
const suggestionHeader = "# CEO & PM Suggestions\nThis file contains instructions and ideas added via Telegram for the agency to process.\n\n- [" + new Date().toISOString() + "] System reset performed.\n";
fs.writeFileSync(SUGGESTIONS_PATH, suggestionHeader);
console.log("✅ [SUGGESTIONS] Instructions reset.");

// 4. Clear/Truncate main logs in .run
if (fs.existsSync(RUN_DIR)) {
    const files = fs.readdirSync(RUN_DIR);
    for (const file of files) {
        const filePath = path.join(RUN_DIR, file);
        if (fs.lstatSync(filePath).isFile()) {
            if (file.endsWith('.log') || file.endsWith('.out')) {
                fs.writeFileSync(filePath, ''); // Truncate
            }
        }
    }
    console.log("✅ [LOGS] Operational logs truncated.");
}

console.log("✨ [CLEANUP] Agency is now at factory settings.");
