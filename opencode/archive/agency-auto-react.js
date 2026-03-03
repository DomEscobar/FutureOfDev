#!/usr/bin/env node
/**
 * Agency Auto-Reaction System
 * Reads explorer reports and automatically assigns tasks
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = '/root/FutureOfDev/opencode';
const AGENCY_DIR = path.join(WORKSPACE, '.opencode');
const HYPER_EXPLORER = path.join(WORKSPACE, 'hyper-explorer');

// Agency task templates
const TASK_TEMPLATES = {
  critical_bug: {
    type: 'backend_fix',
    assignee: 'doer',
    priority: 'P0', 
    sla: '4h',
    auto_assign: true
  },
  ui_bug: {
    type: 'frontend_fix',
    assignee: 'doer',
    priority: 'P1',
    sla: '24h',
    auto_assign: true
  },
  test_failure: {
    type: 'test_fix',
    assignee: 'guardian',
    priority: 'P2',
    sla: '48h',
    auto_assign: false
  }
};

async function readExplorerReport() {
  const findingsPath = path.join(HYPER_EXPLORER, 'memory', 'fullflow_results.json');
  const criticalPath = path.join(WORKSPACE, 'roster', 'player', 'memory', 'CRITICAL_BUG.json');
  
  console.log('Looking for critical bug at:', criticalPath);
  
  try {
    const results = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
    let critical = null;
    try {
      if (fs.existsSync(criticalPath)) {
        critical = JSON.parse(fs.readFileSync(criticalPath, 'utf8'));
        console.log('✅ Found critical bug:', critical.type);
      }
    } catch (e) {
      console.log('⚠️ No critical bug file');
    }
    return { results, critical };
  } catch (e) {
    console.error('❌ No explorer report found at:', findingsPath);
    return null;
  }
}

async function createAgencyTask(report) {
  const taskId = `AUTO-${Date.now()}`;
  
  // Determine task type
  let taskType = 'test_failure';
  if (report.critical?.type === 'FOREIGN_KEY_VIOLATION') {
    taskType = 'critical_bug';
  }
  
  const template = TASK_TEMPLATES[taskType];
  
  const task = {
    id: taskId,
    title: `[AUTO] ${report.critical?.type || 'Backend Error'} - Match Flow Failure`,
    description: `## Explorer Discovery

**Error Type:** ${report.critical?.type || 'Unknown'}

**Summary:**
- Fighter Created: ${report.results.fighterCreated ? '✅' : '❌'}
- Match Joined: ${report.results.matchJoined ? '✅' : '❌'}
- Match Completed: ${report.results.matchCompleted ? '✅' : '❌'}
- Rewards Claimed: ${report.results.rewardsClaimed ? '✅' : '❌'}

**Root Cause:**
Foreign key constraint violation in \`match_score_fighters\` table prevents new fighters from completing matches.

**Error:**
\`\`\`
violates foreign key constraint "match_score_fighters_fighter_id_fkey"
\`\`\`

**Evidence:**
- Screenshot: /root/FutureOfDev/opencode/hyper-explorer/memory/finalflow_04_complete.png
- Full Report: /root/FutureOfDev/opencode/hyper-explorer/CRITICAL_BUG_REPORT.md

## Required Action
Ensure fighter creation transaction is fully committed before allowing match join.

## Acceptance Criteria
- [ ] New user can create fighter
- [ ] New user can join & complete match
- [ ] Rewards are claimable after match
- [ ] No FK constraint errors in logs

## Test Command
\`\`\`bash
cd /root/FutureOfDev/opencode/hyper-explorer
npm run full-flow
\`\`\``,
    type: template.type,
    assignee: template.assignee,
    priority: template.priority,
    sla: template.sla,
    auto_assign: template.auto_assign,
    source: 'explorer_agent',
    created_at: new Date().toISOString(),
    status: 'pending_assignment'
  };
  
  return task;
}

async function assignToAgency(task) {
  // Save to agency task queue
  const taskQueuePath = path.join(WORKSPACE, 'agency-tasks.json');
  let tasks = [];
  try {
    tasks = JSON.parse(fs.readFileSync(taskQueuePath, 'utf8'));
  } catch {}
  
  // Check for duplicate
  const exists = tasks.some(t => t.title === task.title && t.status !== 'completed');
  if (exists) {
    console.log('⚠️ Task already exists in queue');
    return null;
  }
  
  tasks.push(task);
  fs.writeFileSync(taskQueuePath, JSON.stringify(tasks, null, 2));
  console.log(`✅ Task ${task.id} added to agency queue`);
  
  // Try to auto-assign via opencode
  if (task.auto_assign) {
    try {
      const opencodeBin = '/root/.opencode/bin/opencode';
      const cmd = `${opencodeBin} run "${task.title}. ${task.description.substring(0, 200)}... Fix in ${WORKSPACE}"`;
      console.log(`🚀 Auto-assigning to opencode agency...`);
      console.log(`   Command: ${cmd.substring(0, 80)}...`);
      
      // Note: In real implementation, would execute or queue this
      fs.writeFileSync(
        path.join(WORKSPACE, 'pending-opencode-tasks', `${task.id}.sh`),
        `#!/bin/bash\n# Auto-generated task\ncd ${WORKSPACE}\n${cmd}\n`
      );
      
      return { task, auto_assigned: true };
    } catch (e) {
      console.error('❌ Auto-assignment failed:', e.message);
      return { task, auto_assigned: false };
    }
  }
  
  return { task, auto_assigned: false };
}

async function notifyKanban(task) {
  // Add to kanban if exists
  const kanbanPath = path.join(WORKSPACE, '.openclaw', 'kanban.json');
  try {
    let kanban = JSON.parse(fs.readFileSync(kanbanPath, 'utf8'));
    
    kanban.tasks.push({
      id: task.id,
      title: task.title,
      description: task.description.substring(0, 200) + '...',
      assignee: task.assignee,
      priority: task.priority === 'P0' ? 'critical' : 'high',
      column: 'backlog',
      labels: ['auto-generated', 'backend', 'critical', 'explorer'],
      source: 'explorer_agent',
      created_at: task.created_at
    });
    
    fs.writeFileSync(kanbanPath, JSON.stringify(kanban, null, 2));
    console.log(`📋 Added to kanban: ${task.id}`);
    return true;
  } catch (e) {
    console.log('⚠️ Kanban not found, skipping');
    return false;
  }
}

async function main() {
  console.log('🤖 Agency Auto-Reaction System\n');
  
  // 1. Read explorer report
  const report = await readExplorerReport();
  if (!report) {
    console.log('❌ No explorer data to process');
    return;
  }
  
  console.log('📊 Explorer Report:');
  console.log(`  Fighter: ${report.results.fighterCreated ? '✅' : '❌'}`);
  console.log(`  Match: ${report.results.matchJoined ? '✅' : '❌'}`);
  console.log(`  Complete: ${report.results.matchCompleted ? '✅' : '❌'}`);
  console.log(`  Rewards: ${report.results.rewardsClaimed ? '✅' : '❌'}`);
  
  // 2. Check if action needed
  if (report.results.matchCompleted) {
    console.log('\n✅ All tests passed - no action needed');
    return;
  }
  
  // 3. Create task
  console.log('\n🚨 Match completion failed - creating agency task');
  const task = await createAgencyTask(report);
  console.log(`  Task ID: ${task.id}`);
  console.log(`  Type: ${task.type}`);
  console.log(`  Priority: ${task.priority}`);
  console.log(`  Assignee: ${task.assignee}`);
  
  // 4. Assign to agency
  const assignment = await assignToAgency(task);
  if (assignment?.auto_assigned) {
    console.log('✅ Auto-assigned to opencode agency');
  } else {
    console.log('⏳ Queued for manual assignment');
  }
  
  // 5. Update kanban
  await notifyKanban(task);
  
  // 6. Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 AGENCY REACTION COMPLETE');
  console.log('='.repeat(50));
  console.log(`Task: ${task.id}`);
  console.log(`Assignee: ${task.assignee}`);
  console.log(`Priority: ${task.priority}`);
  console.log(`Status: ${assignment?.auto_assigned ? 'Auto-assigned' : 'Pending'}`);
  console.log(`Next Step: ${task.assignee} should acknowledge and begin fix`);
}

main().catch(console.error);
