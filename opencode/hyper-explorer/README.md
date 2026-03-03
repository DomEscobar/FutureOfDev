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

# Full test flow
npm run flow
```

## Structure

```
hyper-explorer/
├── src/
│   ├── hyper-explorer-mcp.mjs  # Explorer (MCP Playwright)
│   └── telemetry.mjs           # Telegram reporting
├── memory/                      # State persistence (self-contained)
│   ├── credentials.json        # Saved login credentials
│   ├── knowledge_graph.json    # Page graph
│   └── execution_log.jsonl     # Execution trace
├── explore.js                  # CLI entry point
├── run-flow.js                 # Full test orchestrator
└── package.json
```

## How It Works

1. **Mission Control** (`HyperExplorer` class): Orchestrates goal execution
2. **Planner**: Decomposes goals into subtasks
3. **Tactical Executor**: ReAct loop (Observe → Decide → Act)
4. **Knowledge Graph**: Remembers page transitions
5. **Credential Persistence**: Saves/loads credentials across sessions

## Telegram Integration

Set environment variables to enable Telegram reporting:

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"

# Now run with telemetry
npm run flow
```

Each goal completion and full flow results are reported to Telegram automatically.
