# Hyper-Explorer

Goal-directed autonomous web exploration agent. Works against **any web app**: point it at a URL and optional goals; it builds a knowledge graph, replans on stuck, and writes findings for integration with the Agency finding watcher.

## Quick Start

From the opencode root (or set `AGENCY_HOME` to the opencode directory):

```bash
# Single goal (default: explore_max_coverage)
node hyper-explorer/src/hyper-explorer-mcp.mjs <APP_URL>

# Specific goals
node hyper-explorer/src/hyper-explorer-mcp.mjs <APP_URL> login complete_registration

# All journeys from user-journey.md
node hyper-explorer/src/hyper-explorer-mcp.mjs <APP_URL> --journeys

# Custom journey file
node hyper-explorer/src/hyper-explorer-mcp.mjs <APP_URL> --journeys --journeys-file /path/to/journeys.md
```

Replace `<APP_URL>` with any reachable origin (e.g. `http://localhost:3000`, `https://app.example.com`). Goals are strings you define; the planner decomposes them into subtasks.

## Structure

```
hyper-explorer/
├── src/
│   ├── hyper-explorer-mcp.mjs  # Main entry (MCP + Playwright)
│   └── telemetry.mjs           # Optional Telegram reporting
├── user-journey.md             # Optional: goal definitions for --journeys
├── memory/                     # Generated state (gitignored in parent)
│   ├── credentials.json        # Optional: saved login credentials
│   ├── knowledge_graph.json    # Page graph
│   ├── plan_trace.jsonl        # Planning decisions
│   └── execution_log.jsonl     # Action trace
├── explore.js                  # CLI wrapper
├── run-flow.js                 # Multi-goal orchestrator
└── package.json
```

## How It Works

1. **Target**: Any web app URL. No app-specific code; the explorer uses a browser (Playwright via MCP) and structural navigation (landmarks, content hashes).
2. **Goals**: Free-form strings (e.g. `login`, `checkout`, `explore_max_coverage`). The planner turns them into subtasks; you can define journeys in `user-journey.md` and load them with `--journeys`.
3. **Execution**: Observe → Decide → Act. Clicks and navigation update a knowledge graph; replanning runs when the agent gets stuck (no structural change after several steps).
4. **Output**: Findings (goal failures, console issues) are appended to `roster/player/memory/findings.md` in the opencode repo, so the player-finding-watcher can trigger the Agency to fix them.

## Integration with Agency

- **Findings path**: `AGENCY_HOME/roster/player/memory/findings.md`. The watcher polls this file and spawns the Agency for each new finding.
- **Run explorer then watcher**: From opencode root, `node run-explore-and-watch.cjs <APP_URL> [goals...]` (or `--journeys` / `--yolo`).

## Optional: Auth and Telegram

- **Login flows**: For apps that require auth, add `hyper-explorer/memory/credentials.json` with `email`, `password`, and optional `name` so the explorer can reuse credentials across runs.
- **Telemetry**: Configure `config.json` in the opencode root (or env) with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`; `telemetry.mjs` will report runs and results.

## npm Scripts

From the `hyper-explorer/` directory:

```bash
npm run explore          # Default URL (localhost:5173), single goal
npm run flow             # run-flow.js: multiple goals in sequence
npm run register         # Goal: register_new_user_complete_flow (example)
npm run login            # Goal: login_existing_user_successful_login (example)
npm test                 # Unit, smoke, integration tests
```

Override the URL by running the node command above with your `<APP_URL>`.
