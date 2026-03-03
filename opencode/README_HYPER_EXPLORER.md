# 🧠 HYPER-EXPLORER — Goal-Directed Graph-Based Web Exploration

**Canonical Player explorer.** The legacy Universal Explorer has been removed; use this for all web app exploration.

**V1.0 — Hierarchical ReAct with Knowledge Graph and Fast-Fail Replanning**

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  OUTER LOOP: Mission Control (Planner)                            │
│  ─────────────────────────────────────────                       │
│  for each goal:                                                   │
│      plan ← decomposeGoal(goal)                                   │
│      for subtask in plan:                                         │
│          result ← INNER_LOOP.execute(subtask)                    │
│          if failure: plan ← replan()                               │
│      goalAchieved ← verifyGoal()                                   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  INNER LOOP: Tactical ReAct (Executor + Graph)                    │
│  ─────────────────────────────────────────                       │
│  while (!subtask.complete):                                       │
│      observation ← observe(page)                                  │
│      decision ← decide(observation, subtask.intent)                │
│      outcome ← act(decision)                                      │
│      graph.recordTransition(observation, decision, outcome)        │
│      if stuck: backtrack()                                         │
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd /root/FutureOfDev/opencode

# Basic exploration (default goal: explore_max_coverage)
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173

# Goal-directed
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 explore_max_coverage
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 complete_registration login
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 --journeys
```

## Goals Supported

| Goal Pattern | Behavior |
|-------------|----------|
| `register`, `signup` | Find form → Fill → Submit → Verify dashboard |
| `login`, `signin` | Find form → Fill credentials → Submit → Verify |
| `explore`, `discover` | Maximize graph coverage (80%+) |
| `find <target>` | Navigate and locate specific element |
| `*` (custom) | Deep exploration with backtracking |

## User journeys (`user-journey.md`)

Explorations are defined in **`hyper-explorer/user-journey.md`**. Each journey has a **Goal** (string passed to the planner), **Priority**, and **Description**. Use `--journeys` to run all journeys from the file, or pass goal names explicitly.

```bash
# Run all journeys defined in user-journey.md (MCP explorer)
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 --journeys

# Override journey file path
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 --journeys --journeys-file /path/to/user-journey.md

# Run specific goals only
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 complete_registration login
```

## Components

### 1. KnowledgeGraph
- **Nodes**: Screens/states (urlKey → metadata)
- **Edges**: Transitions (from → action → to)
- **Frontier**: Unexplored nodes
- **Surprises**: Unexpected navigation outcomes

### 2. Planner
- Decomposes high-level goals into subtasks
- Replans on failures (fast-fail)
- Tracks completed subtasks
- Verifies goal achievement

### 3. TacticalExecutor
- Observe → Decide → Act loop
- Graph-guided action selection
- Smart form filling
- Stuck detection and recovery

## Output Files

- **hyper-explorer/memory/** — knowledge_graph.json, plan_trace.jsonl, execution_log.jsonl, hyper_final.png (explorer-local state).
- **roster/player/memory/findings.md** — Unified findings file (all types: goal failures, console errors, runtime/nav issues, UX). The explorer appends failed-goal and other findings here; the player-finding-watcher reads this file and triggers the Agency to fix each new finding.

## Example Execution Log

```jsonl
{"t":1740823200000,"event":"plan_generated","goal":"complete_registration","subtasks":4}
{"t":1740823201000,"event":"replan","reason":"stuck_on_form","newPlan":3}
{"t":1740823205000,"action":"click","ref":"e12","source":"goal","from":"http://.../","to":"http://.../register","navigated":true}
```

## Key Features

### Graph-Guided Navigation
- BFS to nearest unexplored frontier
- Prefers known successful paths
- Avoids repeating stuck states

### Fast-Fail Replanning
- Detects stuck after 3 consecutive non-navigations
- Immediately backtracks to previous state
- Tries alternative actions

### Surprise Detection
- Predicts URL before navigation
- Compares prediction vs actual
- Stores surprises for pattern learning

### Coverage Metrics
- Total nodes discovered
- Explored vs frontier
- Percentage complete

## Comparison: Legacy vs Hyper

| Feature | Legacy Explorer (removed) | Hyper-Explorer |
|---------|-------------------|---------------|
| Navigation | Random/greedy walk | Graph-guided paths |
| Goals | Max steps only | Objective-driven |
| Replanning | None | Fast-fail with backtracking |
| Coverage | No metrics | Graph-based % |
| State tracking | Basic app_memory | Full knowledge graph |

## Configuration

Edit the config in `hyper-explorer/src/hyper-explorer-mcp.mjs` or pass CLI args:

```javascript
{
    startUrl: 'http://localhost:5173',
    goals: ['complete_registration', 'explore_dashboard'],
    maxSubtaskSteps: 10,
    maxReplans: 3,
    credentials: {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
    }
}
```

## Findings and Agency

The explorer pushes **findings** (all types: goal failures, console errors, runtime/nav issues, and when applicable UX) to `roster/player/memory/findings.md`. Each block includes **Category:** (e.g. GOAL_FAILURE, CONSOLE_ERROR, NAVIGATION_BUG, UX_ISSUE). The player-finding-watcher polls this file and triggers the Agency for each new finding; the Agency runs and writes back to `agency_feedback.md`.

## Telemetry

All runs stream to Telegram via `telemetry-player.cjs`:
- Current phase (Planning/Executing/Replanning)
- Coverage percentage
- Surprise count
- Goal completion status

## Next Steps

1. **Adversarial Input Generation** — Fuzz forms during `fill_form` subtasks
2. **Cross-App Pattern Library** — Learn auth/checkout patterns from multiple apps
3. **Semantic Element Understanding** — LLM-based element classification for novelty detection

---

**Status**: ✅ Production Ready  
**Version**: 1.0  
**Part of**: OpenCode Agency System
