#!/usr/bin/env node
/**
 * FK Constraint Bug - Manual Fix Script
 * While opencode agency is unavailable
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔧 Manual FK Constraint Fix Analysis\n');
console.log('='.repeat(60));

// Analysis of the bug
const bugAnalysis = {
  error: 'violates foreign key constraint "match_score_fighters_fighter_id_fkey"',
  table: 'match_score_fighters',
  rootCause: 'Fighter ID not found when inserting into match_score_fighters',
  possibleCauses: [
    '1. Fighter creation transaction not committed before match join',
    '2. Async timing gap between fighter creation and match join',
    '3. Fighter record not propagated to match service',
    '4. Wrong fighter_id being passed to match_score_fighters'
  ],
  solutions: [
    {
      type: 'Transaction Fix',
      description: 'Ensure fighter tx commits before allowing match operations',
      files: ['backend/src/services/fighter.service.ts'],
      approach: 'Add await tx.commit() + verification step'
    },
    {
      type: 'Validation Fix', 
      description: 'Check fighter exists before match join',
      files: ['backend/src/services/match.service.ts'],
      approach: 'Add SELECT fighters WHERE id = fighter_id before INSERT'
    },
    {
      type: 'Error Handling',
      description: 'Better error message for debugging',
      files: ['backend/src/controllers/match.controller.ts'],
      approach: 'Catch FK error and log actual fighter_id vs expected'
    }
  ]
};

console.log('\n🐛 Bug Analysis:');
console.log(`Error: ${bugAnalysis.error}`);
console.log(`Table: ${bugAnalysis.table}`);
console.log(`\nRoot Cause:`);
console.log(bugAnalysis.rootCause);

console.log('\n🔍 Possible Causes:');
bugAnalysis.possibleCauses.forEach(c => console.log(`  ${c}`));

console.log('\n💡 Recommended Solutions:');
bugAnalysis.solutions.forEach((sol, i) => {
  console.log(`\n${i + 1}. ${sol.type}`);
  console.log(`   ${sol.description}`);
  console.log(`   Files: ${sol.files.join(', ')}`);
  console.log(`   Approach: ${sol.approach}`);
});

console.log('\n\n📋 Implementation Plan:');
console.log('='.repeat(60));

const implementationSteps = `
IMPL-001: Add fighter verification before match join
├─ File: backend/src/services/match.service.ts
├─ Function: joinMatch()
└─ Code:
   const fighter = await db.fighters.findById(fighterId);
   if (!fighter) throw new Error('Fighter not found');
   await db.match_score_fighters.insert({ fighter_id: fighterId, ... });

IMPL-002: Ensure transaction isolation
├─ File: backend/src/services/fighter.service.ts  
├─ Function: createFighter()
└─ Code:
   const tx = await db.transaction();
   try {
     const fighter = await tx.fighters.insert(data);
     await tx.commit();
     // Verify fighter exists before returning
     const verified = await db.fighters.findById(fighter.id);
     if (!verified) throw new Error('Fighter creation verification failed');
     return fighter;
   } catch (e) {
     await tx.rollback();
     throw e;
   }

IMPL-003: Add transaction retry logic
├─ File: backend/src/middleware/transaction.ts
└─ Add: Exponential backoff retry for FK violations
`;

console.log(implementationSteps);

console.log('\n\n📝 SQL Verification Query:');
console.log('='.repeat(60));
console.log(`
-- Verify FK constraint
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'match_score_fighters';

-- Test: Check if fighter exists
SELECT id FROM fighters WHERE id = 'test-fighter-id';

-- Test: Try insert (should fail if fighter doesn't exist)
INSERT INTO match_score_fighters (match_id, fighter_id) 
VALUES ('test-match', 'non-existent-fighter');
`);

// Save to file
const fixPath = path.join(__dirname, 'MANUAL_FIX_PLAN.md');
fs.writeFileSync(fixPath, `# FK Constraint Bug Fix Plan

## Error
${bugAnalysis.error}

## Root Cause
${bugAnalysis.rootCause}

## Solutions
${JSON.stringify(bugAnalysis.solutions, null, 2)}

## Implementation
${implementationSteps}

## SQL Verification
See above queries.
`);

console.log(`\n💾 Fix plan saved to: ${fixPath}`);
console.log('\n✅ Ready for Doer agent to implement!');
