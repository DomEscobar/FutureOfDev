# Autonomous Agency V9.0 (Iron Dome Edition)

A self-healing, benchmark-driven task orchestration system with dynamic problem-solving capabilities.

---

## What's New in V9.0

- **Iron Dome KPI System**: 6 KPIs (TypeScript, Lint, Build, Tests, Go Build, Go Tests)
- **General Problem-Solving**: Agent investigates root causes, not just code fixes
- **Flaw Detection**: "Passing with 0 changes" detected as FAILURE
- **Benchmark Mode**: One-shot task execution for quality testing
- **Toolchain Awareness**: Agent can fix go.mod, dependencies, versions

---

## Quick Start

```bash
# Start the Agency Stack
node orchestrator.cjs &      # Task dispatcher
node chronos.cjs &           # Self-healing guardian
node telegram-control.cjs &  # Remote control (optional)

# Run a benchmark task
node orchestrator.cjs --task bench-001

# Check status
cat tasks.json
tail -20 .run/agency.log
```

---

## Core Components

### orchestrator.cjs (V9.0)
- **One-Shot Mode**: `--task <id>` for benchmark runs
- **Memory Bridge**: Injects previous rejections into next prompt
- **Governance Lock**: Max 5 retry loops before blocking
- **Circuit Breaker**: Auto-blocks after 5 total failures

### dev-unit.cjs (Iron Dome V3.0)
- **Ghost-Pad Strategy**: Persists technical scratchpad across turns
- **Multi-Stage Execution**: Planning → Execution → Verification
- **KPI Verification Loop**: Up to 3 fix attempts with general problem-solving
- **Flaw Detection**: Zero-change detection for CREATE/MODIFY tasks

### pm.cjs (V1.0)
- **Task Analysis**: Transforms vague requests into structured tasks
- **File Discovery**: Finds affected files via keyword search
- **Plan Generation**: Outputs specific files to create/modify

### chronos.cjs (V2.5)
- **Self-Healing**: Restarts crashed processes
- **Log Rotation**: Caps logs at 30 lines
- **Cooldown**: 30s between task retries

---

## File Structure

```
opencode/
├── orchestrator.cjs       # Main dispatcher (V9.0)
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
```

---

## KPI Verification System

### 6 KPIs (Frontend + Backend)

| KPI | Command | Scope |
|-----|---------|-------|
| TypeScript | `vue-tsc --noEmit` | Frontend |
| Lint | `eslint` | Frontend |
| Build | `npm run build` | Frontend |
| Tests | `npm test` | Frontend |
| Go Build | `go build ./...` | Backend |
| Go Tests | `go test ./...` | Backend |

### KPI Fix Loop

When KPIs fail, the agent receives a general problem-solving prompt:

```
[BUILD FAILED - INVESTIGATE AND FIX]

[INVESTIGATION STEPS]
1. Read error messages carefully
2. Run diagnostic commands (go version, npm list, etc.)
3. Common root causes:
   - Missing imports or wrong import paths
   - Toolchain mismatch (go.mod vs system version)
   - Missing files that are imported
   - Package version incompatibilities

[YOU HAVE FULL FREEDOM]
- Use `exec` to run ANY diagnostic command
- Use `read` to inspect ANY file
- Fix the ROOT CAUSE, not just symptoms
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
```

### Benchmark Flow

1. **Reset** workspace to `benchmark-baseline` tag
2. **Run** PM → dev-unit with simplified prompt
3. **Verify** all 6 KPIs pass
4. **Fix Loop**: Up to 3 attempts
5. **Report**: Success or failure with metrics

### Benchmark Tasks

| Task | Category | Description |
|------|----------|-------------|
| bench-001 | fullstack | Items CRUD API + Frontend |
| bench-002 | fullstack | Categories CRUD |
| bench-003 | backend | Request Logger |

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
pending → in_progress → completed
    │          │
    │          └─→ KPI fail → fix loop (max 3)
    │                           │
    │                           └─→ blocked (all loops failed)
    │
    └─→ blocked (manually)
```

---

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/status` | Task summary + process status |
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
| Circuit Breaker | Block tasks after 3 consecutive failures |
| Timeout Guard | Kill tasks exceeding 180 seconds |
| Cooldown | 30s wait between same task retries |
| Auto-Recovery | Chronos restarts crashed processes |
| Log Rotation | Caps logs at 30 lines |
| Flaw Detection | Zero-change detection for CREATE/MODIFY |

---

## Troubleshooting

### Task stuck in `in_progress`

```bash
ps aux | grep opencode
jq '.tasks[] | select(.id=="task-id") | .status="pending"' tasks.json
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
| V9.0 | Iron Dome Benchmark System | 2026-02-23 |
| V3.0 | General KPI Fix Prompt | 2026-02-23 |
| V2.9 | Flaw Detection (0 changes) | 2026-02-23 |
| V2.8 | Go 1.23 + Dep Fixes | 2026-02-23 |
| V7.1 | Protocol-aware parsing | 2026-02-21 |

---

## License

MIT

---

*Last updated: 2026-02-23*