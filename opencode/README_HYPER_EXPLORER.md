# 🧠 HYPER-EXPLORER — Goal-Directed Graph-Based Web Exploration

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

# Basic exploration
node hyper-explorer.mjs http://localhost:5173 explore_max_coverage

# Goal-directed
node hyper-explorer.mjs http://localhost:5173 complete_registration
node hyper-explorer.mjs http://localhost:5173 login_and_explore
```

## Goals Supported

| Goal Pattern | Behavior |
|-------------|----------|
| `register`, `signup` | Find form → Fill → Submit → Verify dashboard |
| `login`, `signin` | Find form → Fill credentials → Submit → Verify |
| `explore`, `discover` | Maximize graph coverage (80%+) |
| `find <target>` | Navigate and locate specific element |
| `*` (custom) | Deep exploration with backtracking |

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

```
roster/player/memory/
├── knowledge_graph.json       # Live graph, updates each transition
├── plan_trace.jsonl           # Planning decisions (one line per plan/replan)
├── execution_log.jsonl        # Every action with outcomes
└── hyper_final.png           # Final screenshot
```

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

## Comparison: Original vs Hyper

| Feature | Universal Explorer | Hyper-Explorer |
|---------|-------------------|---------------|
| Navigation | Random/greedy walk | Graph-guided paths |
| Goals | Max steps only | Objective-driven |
| Replanning | None | Fast-fail with backtracking |
| Coverage | No metrics | Graph-based % |
| State tracking | Basic app_memory | Full knowledge graph |

## Configuration

Edit the config in `hyper-explorer.mjs` or pass CLI args:

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
