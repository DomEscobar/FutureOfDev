# Autonomous Agency V10.0 (Ralph Wiggum Edition)

A self-healing, benchmark-driven task orchestration system with persistent failure recovery and smart error resolution.

---

## What's New in V10.0

- **Ralph Wiggum Loop**: Persistent iteration until external verification passes (max 7 iterations)
- **State Persistence**: `progress.txt` (append-only failure memory) + `prd.json` (structured stories)
- **Smart Error Resolution**: Detects common Go/TS errors and provides specific fix instructions
- **External Verification Gates**: NEVER declares "DONE" without passing all KPIs
- **Failure Re-injection**: Each iteration receives previous failure context with specific guidance

---

## Quick Start

```bash
# Start the Agency Stack
node orchestrator.cjs &      # Task dispatcher
node chronos.cjs &           # Self-healing guardian
node telegram-control.cjs &  # Remote control (optional)

# Run a benchmark task (one-shot mode)
node orchestrator.cjs --task bench-001

# Check Ralph Wiggum loop progress
cat /root/Erp_dev_bench-1/progress.txt
cat /root/Erp_dev_bench-1/prd.json | jq '.stories[] | {id, title, status}'

# Check status
tail -50 .run/agency.log
```

---

## Core Components

### orchestrator.cjs (V10.0 - Ralph Wiggum Edition)
- **Ralph Wiggum Loop**: Iterates until external verification passes (MAX_ITERATIONS=7)
- **State Persistence**: Creates `progress.txt` and `prd.json` for cross-iteration memory
- **Failure Re-injection**: Prepends failure context + smart resolution hints to next iteration
- **One-Shot Mode**: `--task <id>` for benchmark runs
- **Memory Bridge**: Injects previous rejections into next prompt

### dev-unit.cjs (Iron Dome V3.0)
- **Ghost-Pad Strategy**: Persists technical scratchpad across turns
- **Multi-Stage Execution**: Planning → Execution → Verification
- **Internal KPI Loop**: Up to 5 fix attempts per iteration
- **Flaw Detection**: Zero-change detection for CREATE/MODIFY tasks
- **Infrastructure Awareness**: Detects missing DB/services and warns agent

### pm.cjs (V1.0)
- **Task Analysis**: Transforms vague requests into structured tasks
- **File Discovery**: Finds affected files via keyword search
- **Plan Generation**: Outputs specific files to create/modify

### chronos.cjs (V2.5)
- **Self-Healing**: Restarts crashed processes
- **Log Rotation**: Caps logs at 30 lines
- **Cooldown**: 30s between task retries

---

## Ralph Wiggum Loop

### The Core Principle

**"Failure is data, not death."**

The Ralph Wiggum Loop is a persistent execution cycle that:

1. **NEVER** declares "DONE" based on LLM judgment alone
2. **NEVER** commits code that fails verification
3. **ALWAYS** appends failure context to `progress.txt`
4. **ALWAYS** re-injects failures into the next iteration
5. **STOPS** only when external verification passes OR MAX_ITERATIONS reached

### Loop Flow

```
┌─────────────────────────────────────────────────────────────┐
│  ITERATION 1/7                                               │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐            │
│  │ PM Plan  │ → │ dev-unit │ → │ KPI Verify   │            │
│  └──────────┘   └──────────┘   └──────────────┘            │
│                                      │                       │
│                         ┌────────────┴────────────┐        │
│                         ▼                         ▼        │
│                    ✅ PASS                  ❌ FAIL        │
│                       │                         │          │
│                       ▼                         ▼          │
│                   COMMIT         Append to progress.txt    │
│                   DONE!          Re-inject failure         │
│                                      │                      │
│                                      ▼                      │
│                            ┌──────────────────┐            │
│                            │ ITERATION 2/7    │            │
│                            │ (with context)   │            │
│                            └──────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### State Files

#### progress.txt (Append-Only Memory)

```txt
# RALPH WIGGUM PROGRESS LOG
# Task: Items CRUD API + Frontend
# Started: 2026-02-23T22:41:20.268Z
# Max Iterations: 7
========================================

[2026-02-23T22:43:50.079Z]
ITERATION 1: FAILED
KPIs: TypeScript=true, Lint=false, Build=false, Tests=true
Failures:
Build Errors:
internal/handlers/items.go:33:11: undefined: models
---
---

[2026-02-23T22:47:14.352Z]
ITERATION 2: FAILED
KPIs: TypeScript=true, Lint=false, Build=false, Tests=true
Failures:
Build Errors:
internal/handlers/items.go:38:40: cannot convert id (string) to uint
---
---
```

#### prd.json (Structured Stories)

```json
{
  "taskId": "bench-001",
  "taskName": "Items CRUD API + Frontend",
  "stories": [
    {
      "id": "STORY-1",
      "title": "Create Item Model",
      "type": "backend",
      "status": "PENDING",
      "acceptance_criteria": [
        "Model file exists in backend/internal/models/",
        "Model has all required fields with correct types"
      ]
    }
  ]
}
```

---

## Smart Error Resolution

The Ralph Wiggum Loop detects common errors and provides specific fix instructions:

### Go Import Errors

**Error:** `undefined: models`

**Resolution:**
```
⚠️  SPECIFIC FIX NEEDED: "undefined: models" error
→ The error means you're trying to use `models.Item` but haven't imported the package.
→ Add this import at the top of your Go file:

```go
import "github.com/DomEscobar/erp-dev-bench/internal/models"
```

→ Make sure the import path matches your go.mod module name.
```

### Go Type Conversion Errors

**Error:** `cannot convert id (variable of type string) to type uint`

**Resolution:**
```
⚠️  SPECIFIC FIX NEEDED: "cannot convert string to uint" error
→ Go's ID fields in handlers come as strings from the HTTP request.
→ You must convert them to uint before using them:

```go
import "strconv"

idUint, err := strconv.ParseUint(id, 10, 64)
if err != nil {
    c.JSON(400, gin.H{"error": "Invalid ID"})
    return
}
```
```

### How It Works

The orchestrator scans KPI failure output for known error patterns and appends specific resolution hints to the failure context. This breaks "Loops of Insanity" where agents repeatedly make the same mistake.

---

## KPI Verification System

### 6 KPIs (Frontend + Backend)

| KPI | Command | Scope |
|-----|---------|-------|
| TypeScript | `vue-tsc --noEmit` | Frontend |
| Lint | `eslint` | Frontend |
| Build | `npm run build` + `go build` | Both |
| Tests | `npm test` + `go test` | Both |

### KPI Verification Flow

```javascript
// orchestrator.cjs - External Oracle
const kpis = {
    typescript: await checkTypeScript(workspace),
    lint: await checkLint(workspace),
    build: await checkBuild(workspace),
    tests: await checkTests(workspace)
};

// NEVER pass without external verification
if (kpis.typescript && kpis.lint && kpis.build && kpis.tests) {
    console.log("✅ ALL KPIs PASSED - Committing...");
    return { success: true };
}
```

### Flaw Detection

The agent cannot "game the system" by doing nothing:

```javascript
// If CREATE/MODIFY task has 0 file changes:
if (!hasAnyChanges && isCreateOrModify) {
    log("FLAW DETECTED: No file changes - this is FAILURE");
    // Mark all KPIs as failed
}
```

---

## Benchmark Mode

### Running Benchmarks

```bash
# From benchmark directory
cd /root/Erp_dev_bench-1/benchmark
node runner.cjs run tasks/bench-001.json

# Or directly via orchestrator
cd /root/FutureOfDev/opencode
node orchestrator.cjs --task bench-001
```

### Benchmark Flow

1. **Initialize** progress.txt + prd.json
2. **Loop** (max 7 iterations):
   - PM Planning
   - dev-unit Execution
   - KPI Verification (External Oracle)
   - If FAIL: Append to progress.txt, re-inject failure
   - If PASS: Commit with story IDs, DONE
3. **Report** success or escalation

### Benchmark Tasks

| Task | Category | Description |
|------|----------|-------------|
| bench-001 | fullstack | Items CRUD API + Frontend |
| bench-002 | fullstack | Categories CRUD |
| bench-003 | backend | Request Logger |

---

## File Structure

```
opencode/
├── orchestrator.cjs       # Main dispatcher (V10.0 - Ralph Wiggum)
├── dev-unit.cjs           # Iron Dome executor (V3.0)
├── pm.cjs                 # Planning agent
├── chronos.cjs            # Self-healing guardian
├── telegram-control.cjs   # Telegram remote control
├── validate.cjs           # Pre-flight checks
├── opencode.json          # Agent configurations
├── tasks.json             # Task backlog
├── config.json            # Telegram credentials
├── ALIGNMENT.md           # Engineering standards
└── .run/
    ├── agency.log         # Dispatcher log
    ├── dev_unit_*_debug.log  # Cognitive traces
    ├── ghostpad_*.md      # Active task plans
    └── snapshots/         # Workspace snapshots

# Generated by Ralph Wiggum Loop (in workspace root):
/workspace/
├── progress.txt           # Append-only failure memory
└── prd.json               # Structured stories with PASS/FAIL status
```

---

## Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| `PM Agent` | Gemini 2.5 Flash Lite | Task analysis, file discovery |
| `dev-unit` | Gemini 2.0 Flash Lite | Multi-stage coding & KPI verification |
| `code-reviewer` | Gemini 2.0 Flash Lite | Quality gate & critique |

---

## Task Lifecycle

```
pending → in_progress → Ralph Wiggum Loop (max 7 iterations)
                            │
                            ├─→ KPI FAIL → Append progress.txt → Re-inject → Continue loop
                            │
                            └─→ KPI PASS → Commit → completed
                                 │
                                 └─→ MAX_ITERATIONS reached → blocked (escalate to human)
```

---

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/status` | Task summary + process status + Ralph Wiggum iterations |
| `/top` | Active processes |
| `/logs` | Last 20 lines of agency log |
| `/agents` | List agents and models |
| `/start` | Start orchestrator + chronos |
| `/stop` | Kill all agency processes |
| `/unblock <id>` | Reset blocked task to pending |

---

## Safety Features

| Feature | Description |
|---------|-------------|
| Circuit Breaker | MAX_ITERATIONS=7 prevents infinite loops |
| Timeout Guard | Kill tasks exceeding 180 seconds |
| Cooldown | 30s wait between same task retries |
| Auto-Recovery | Chronos restarts crashed processes |
| Log Rotation | Caps logs at 30 lines |
| Flaw Detection | Zero-change detection for CREATE/MODIFY |
| Progress Memory | progress.txt prevents repeating same mistakes |

---

## Master Spec V1.0 Compliance

| Requirement | Implementation |
|-------------|----------------|
| NEVER declare DONE without external verifier | ✅ KPI gates require actual verification |
| NEVER commit with failing test/lint/error | ✅ All KPIs must pass before commit |
| Persistent loop until success | ✅ Ralph Wiggum Loop (max 7 iterations) |
| Append-only progress memory | ✅ progress.txt |
| Structured story tracking | ✅ prd.json with PASS/FAIL status |
| Failure re-injection | ✅ Prepended to next iteration prompt |
| Smart error resolution | ✅ Pattern detection + specific hints |

---

## Troubleshooting

### Task stuck in `in_progress`

```bash
# Check Ralph Wiggum loop status
cat /root/Erp_dev_bench-1/progress.txt

# Check agent process
ps aux | grep opencode

# Reset task
jq '.tasks[] | select(.id=="task-id") | .status="pending"' tasks.json
```

### Agent in "Loop of Insanity" (same error repeatedly)

```bash
# Check progress.txt for repeated failures
cat /root/Erp_dev_bench-1/progress.txt | grep "ITERATION"

# Smart error resolution should detect common patterns
# If not, check orchestrator.cjs for error pattern detection
```

### Orchestrator won't start

```bash
pkill -f orchestrator.cjs
pkill -f chronos.cjs
rm -f .run/*.lock
node orchestrator.cjs &
```

### Chronos keeps restarting

```bash
touch CHRONOS_DISABLED   # Disable
rm CHRONOS_DISABLED      # Re-enable
```

---

## Version History

| Version | Feature | Date |
|---------|---------|------|
| V10.0 | Ralph Wiggum Loop + Smart Error Resolution | 2026-02-24 |
| V9.0 | Iron Dome Benchmark System | 2026-02-23 |
| V3.0 | General KPI Fix Prompt | 2026-02-23 |
| V2.9 | Flaw Detection (0 changes) | 2026-02-23 |
| V2.8 | Go 1.23 + Dep Fixes | 2026-02-23 |
| V7.1 | Protocol-aware parsing | 2026-02-21 |

---

## License

MIT

---

*Last updated: 2026-02-24*
