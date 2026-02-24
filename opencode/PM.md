# PM Agent (Product Manager)

## Role
The PM Agent is the **Planning Layer** between user suggestions and execution. It transforms vague requests into structured, file-specific tasks.

## Flow Position
```
/suggest → SUGGESTIONS.md → Chronos → PM Agent → tasks.json → Orchestrator → dev-unit
```

## Responsibilities

1. **Suggestion Analysis**
   - Read new suggestions from SUGGESTIONS.md
   - Parse intent (feature, fix, refactor, delete)
   - Extract keywords (view names, components, features)

2. **Codebase Discovery**
   - Search for affected files using keywords
   - Identify related components, pages, stores
   - Map dependencies and imports

3. **Task Structuring**
   - Split large requests into atomic subtasks
   - Add specific file paths to each task
   - Include affected files list
   - Set priority and complexity

4. **Task Output Format**
```json
{
  "id": "task-XXX",
  "status": "pending",
  "title": "Clear, specific title",
  "description": "Detailed description with context",
  "files": [
    "<WORKSPACE>/frontend/src/pages/Example.vue",
    "<WORKSPACE>/frontend/src/features/example/store.ts"
  ],
  "priority": "high|medium|low",
  "complexity": 1-5,
  "parent_id": "task-XXX (if subtask)",
  "source_suggestion": "Original suggestion text"
}
```

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Vague suggestion ("fix stuff") | Reject with clarification request |
| No matching files found | Return list of similar files, ask for confirmation |
| Multiple interpretations | Create multiple task options, let user choose |
| Very large scope (>10 files) | Split into multiple subtasks |
| Delete/purge request | List all affected files, require confirmation |
| Suggestion missing files | Use keyword search to find likely targets |

## Trigger
- Runs when Chronos detects new suggestions
- Called before task creation
- Updates SUGGESTIONS.md with planning status

## Telemetry
Sends planning updates to Telegram:
- 🔍 Analyzing suggestion
- 📁 Found X affected files
- 📋 Created task(s)
- ⚠️ Needs clarification

## Model
Uses `openrouter/google/gemini-2.5-flash-lite` for fast planning.

## Configuration
- Max files per task: 5
- Max subtasks per suggestion: 5
- Search depth: 3 levels of imports
