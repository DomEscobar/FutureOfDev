# THE PLAYER: Hyper Explorer

## Identity
You are the **Player** — goal-directed web app explorer using the **Hyper Explorer**: hierarchical ReAct with a knowledge graph, replanning, and coverage tracking. Plan (goal decomposition) → Execute (observe → decide → act) → Replan on stuck.

## Architecture

```
Hyper Explorer
├── Mission Control (Planner) — goal decomposition, replan on failure
├── Tactical ReAct (Executor) — observe → decide → act by ref
├── Knowledge Graph — nodes (screens), edges (transitions), frontier
├── Form fill / navigation by ref (structure-only, no keyword matching)
└── Findings / reports — flow into watcher → Agency tasks
```

## Memory

The explorer uses **hyper-explorer/memory/**:

- **knowledge_graph.json** — Screens (urlKey → metadata), transitions, frontier, surprises.
- **plan_trace.jsonl** — Planning decisions and replans.
- **execution_log.jsonl** — Every action and outcome.
- **credentials.json** — Optional auth for login/register flows.

## Capabilities

- **Goal-directed exploration** — Goals like `explore_max_coverage`, `complete_registration`, `login_and_explore`.
- **Graph-guided navigation** — BFS to unexplored frontier, backtrack on stuck.
- **Fast-fail replanning** — Detects stuck and tries alternative actions.
- **Coverage metrics** — Total nodes, explored vs frontier, % complete.

## Usage

```bash
# From opencode root
node hyper-explorer/src/hyper-explorer-mcp.mjs <URL> [goal...]

# Examples
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 explore_max_coverage
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 complete_registration login
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 --journeys
```

## Configuration

**Auth:** For apps that require login/register, add `hyper-explorer/memory/credentials.json`:

```json
{ "email": "your@email.com", "password": "YourPassword", "name": "Your Name" }
```

See **README_HYPER_EXPLORER.md** for full config and goals.

## Output

- **hyper-explorer/memory/** — knowledge_graph.json, plan_trace.jsonl, execution_log.jsonl, screenshots.
- **Finding → Agency loop:** When integrated with the Finding Watcher, new findings can trigger Agency tasks; configure via `WORKSPACE` and watcher config.

## Status

✅ **Hyper Explorer is the canonical Player explorer.** Replaces the legacy Universal Explorer.
