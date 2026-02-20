import { onFileChange, runTask } from '@opencode/agent';

/**
 * OpenCode Neural Core: File-Driven Event Loop
 * This plugin creates reactive triggers between agents based on file state changes.
 * This removes polling latency and enables real-time collaboration.
 */

// 1. PROJECT-MANAGER Trigger: React when CEO approves a suggestion
onFileChange('SUGGESTIONS.md', async (content) => {
  if (content.match(/\[x\]\s+(.+)/i)) {
    console.log('CEO detected as Approved. Signaling Project-Manager.');
    await runTask('project-manager', 'The CEO has approved new features in SUGGESTIONS.md. Sync these to the DEV_KANBAN.md backlog immediately.');
  }
});

// 2. DEV-UNIT Trigger: React when PM pins a task to In Progress
onFileChange('DEV_KANBAN.md', async (content) => {
  // If there's an unchecked task in the In Progress section
  if (content.match(/## 🏗️ IN_PROGRESS\n- \[ \]/)) {
    console.log('New Dev Task detected. Signaling Dev-Unit.');
    await runTask('dev-unit', 'New implementation task detected in DEV_KANBAN.md. Execute step-by-step and move to Ready-for-Test upon completion.');
  }

  // 3. TEST-UNIT Trigger: React when Dev moves task to Ready for Test
  if (content.match(/## 🧪 READY_FOR_TEST\n- \[ \]/)) {
    console.log('New Test Task detected. Signaling Test-Unit.');
    await runTask('test-unit', 'Code is ready for verification. Perform logic and E2E tests for the latest task in READY_FOR_TEST. If passed, push to main and close.');
  }
  
  // 4. PM FEEDBACK Loop: React when Test-Unit sends a task back to Dev (Fix required)
  if (content.match(/## 🏗️ IN_PROGRESS\n- \[ \] .*\(FIX REQUIRED\)/i)) {
    console.log('Test Failure detected. Signaling Dev-Unit for bugfix.');
    await runTask('dev-unit', 'A task was sent back from testing with failures. Review the failure logs in the ticket comment and implement the fix.');
  }
});
