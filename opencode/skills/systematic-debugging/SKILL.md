---
name: Systematic Debugging
trigger:
  intent: [fix]
  tags: [bug, error, fix, broken, crash, failing, undefined]
inject: [planning, execution]
---

# Systematic Debugging

## When to Apply
Use when the task involves fixing bugs, build errors, test failures, or runtime crashes.

## Four-Phase Process

### Phase 1: Reproduce
- Read the error message carefully -- every word matters
- Identify the exact file and line number from the error
- Understand what the code was trying to do when it failed

### Phase 2: Isolate
- Trace the error to its root cause (not just the symptom)
- Check imports, type definitions, and function signatures
- For build errors: check if the module/package exists and is properly imported
- For runtime errors: check null/undefined access, type mismatches, missing props

### Phase 3: Fix
- Make the smallest possible change that fixes the root cause
- Do NOT refactor surrounding code while fixing a bug
- If the fix requires changing multiple files, list them all in the plan

### Phase 4: Verify
- Run the relevant check (build, lint, type-check, test) to confirm the fix
- Check that the fix didn't break adjacent functionality
- If verification fails, go back to Phase 2 with the new error

## Common Patterns in This Agency

### Go Build Errors
- `undefined: X` → missing import (add the import)
- `cannot convert X to type Y` → type mismatch (use strconv or type assertion)
- `not in GOROOT` → wrong import path (check go.mod module name)

### Frontend Build Errors
- `Cannot find module` → missing dependency or wrong import path
- `Type X is not assignable to type Y` → TypeScript type mismatch
- `Undefined variable` in SCSS → missing variable definition or import

## Critical Rule
If after 3 fix attempts the same error persists, output FAILED with the exact error text so the orchestrator can escalate.
