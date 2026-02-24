---
name: Verification Before Completion
trigger:
  intent: [create, fix, refactor]
  tags: ["*"]
inject: [execution, verification]
---

# Verification Before Completion

## Iron Law
Never declare a task complete without evidence. "I believe it works" is not evidence.

## Verification Checklist

### For File Creation Tasks
- [ ] File exists at the specified path (run `ls` to confirm)
- [ ] File is not empty
- [ ] File has correct syntax (no unclosed brackets, missing imports)

### For Modification Tasks
- [ ] The target file was actually modified (not just read)
- [ ] The modification matches what the plan specified
- [ ] No accidental deletions of existing code

### For Bug Fix Tasks
- [ ] The specific error from the task description no longer occurs
- [ ] Related functionality still works
- [ ] The fix addresses the root cause, not just the symptom

## Gate Function
Before outputting your final summary, answer these questions:
1. Did I create/modify the files I said I would?
2. Can I prove it? (file listing, build output, test output)
3. Would a reviewer looking at my changes understand what I did and why?

If any answer is "no", you are NOT done. Go back and fix it.

## Output Format
End your work with a concrete summary:
```
Summary: Created X files, modified Y files.
- Created: /path/to/new/file.ext (description)
- Modified: /path/to/existing/file.ext (what changed)
Verification: [build passed | tests passed | files confirmed]
```
