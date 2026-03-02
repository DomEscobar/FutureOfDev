# Hyper-Explorer

Goal-directed autonomous web exploration agent with hierarchical ReAct architecture.

## Quick Start

```bash
# Register new user
./explore.js http://localhost:5173 register_new_user_complete_flow

# Login with saved credentials
./explore.js http://localhost:5173 login_existing_user_successful_login

# Create squad
./explore.js http://localhost:5173 create_fighter_squad

# Play match
./explore.js http://localhost:5173 start_and_complete_match

# Run full flow test
npm run flow
```

## Structure

```
hyper-explorer/
├── src/
│   ├── hyper-explorer.mjs      # Main explorer (use this)
│   └── hyper-explorer-mcp.mjs  # MCP version (distributed)
├── memory/                      # State persistence
│   ├── credentials.json        # Saved login credentials
│   ├── knowledge_graph.json    # Page graph
│   ├── execution_log.jsonl     # Execution trace
│   └── *.png                   # Screenshots
├── explore.js                  # CLI entry point
├── run-flow.js                 # Full test orchestrator
├── package.json
└── README.md
```

## Goals Supported

| Goal | Description |
|------|-------------|
| `register_new_user_complete_flow` | Register and save credentials to memory/ |
| `login_existing_user_successful_login` | Login using saved credentials |
| `create_fighter_squad` | Navigate to squad/roster page |
| `start_and_complete_match` | Join and play through a match |

## How It Works

1. **Mission Control** (`HyperExplorer` class): Orchestrates goal execution
2. **Planner**: Decomposes goals into subtasks (find_auth_page → fill_form → submit)
3. **Tactical Executor**: ReAct loop (Observe → Decide → Act)
4. **Knowledge Graph**: Remembers page transitions
5. **Credential Persistence**: Saves/loads credentials across sessions

## Architecture

```
explore.js (CLI)
  ↓
hyper-explorer.mjs (Mission Control)
  ↓
Planner.generatePlan(goal) → [subtasks]
  ↓
TacticalExecutor.execute(subtask)
  ↓
  observe() → snapshot page
  decide()  → what action?
  act()     → execute via Playwright
  repeat until goal achieved
```
