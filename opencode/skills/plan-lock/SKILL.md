---
name: Plan Lock Discipline
trigger:
  intent: [create, fix, refactor, delete]
  tags: ["*"]
inject: [planning]
---

# Plan Lock Discipline

## Core Rule
You must produce a concrete plan with absolute file paths BEFORE writing any code. No exploration, no research, no analysis -- just a plan.

## Required Plan Structure

```
## PLAN

### Files to Create:
1. /absolute/path/to/file.ext
   - Action: What it will contain

### Files to Modify:
1. /absolute/path/to/file.ext
   - Action: What specific changes to make

### No Changes Required:
- /absolute/path/to/file.ext (reason it doesn't need changes)

### PLAN_LOCKED
```

## Plan Validation Rules

Your plan will be REJECTED if:
- It contains no absolute file paths
- It uses words like "examine", "analyze", "research", "investigate", "explore"
- It doesn't end with `### PLAN_LOCKED`
- File paths are relative instead of absolute

## After Plan Lock
Once you write `### PLAN_LOCKED`, you are committed. Execute the plan exactly as written. If you discover mid-execution that the plan is wrong, note the deviation in your summary but complete what you can.
