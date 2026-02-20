# OpenCode Agency

An autonomous AI development agency powered by [OpenCode](https://opencode.ai). A human writes a feature request, and a pipeline of specialized AI agents handles planning, implementation, testing, and security -- without manual intervention.

## How It Works

A single Node.js orchestrator (`orchestrator.js`) watches two files using `fs.watch`:

- `SUGGESTIONS.md` -- when you edit this, the CEO agent wakes up
- `tasks.json` -- when any agent writes a status change, the orchestrator dispatches the next agent

The orchestrator never writes to `tasks.json` itself. Agents are the sole writers. An in-memory dispatch map prevents duplicate triggers.

```
 You edit SUGGESTIONS.md
        |
        v
 CEO agent reviews, creates tasks in tasks.json (status: pending)
        |
        v
 PM agent adds technical spec (status: in_progress)
        |
        v
 Dev agent implements the code in the target workspace (status: ready_for_test)
        |
        v
 Test agent runs gatekeeper + test-harness
        |
   pass |         | fail
        v         v
   completed    back to in_progress (with failure logs)
```

## Agents

| Agent | Role | Trigger |
|-------|------|---------|
| **CEO** | Reviews suggestions, creates tasks | `SUGGESTIONS.md` changes |
| **Project Manager** | Breaks down tasks, assigns technical details | Task status `pending` |
| **Dev Unit** | Writes code in the target workspace | Task status `in_progress` |
| **Test Unit** | Runs security scan + test harness | Task status `ready_for_test` |
| **Shadow Tester** | Adversarial red-teaming (injection, crashes) | Spawned by Test Unit |
| **Visual Analyst** | UX/accessibility audit via browser | Spawned by CEO on demand |

## Project Structure

```
opencode/
├── setup.sh                        # Interactive first-time setup
├── control.sh                      # Thin start/stop/status wrapper
├── orchestrator.js                 # Core: watches files, dispatches agents
├── tasks.json                      # State machine (source of truth)
├── SUGGESTIONS.md                  # Human input file
├── opencode.json                   # Agent definitions
├── config.json                     # Workspace path + credentials
├── .gitignore
├── scripts/
│   ├── gatekeeper.sh               # Pre-push secret detection scan
│   └── test-harness.js             # Structural + npm test runner
└── plugins/
    └── telegram-notifier.ts        # OpenCode plugin for task event notifications
```

## Setup

Run the interactive setup script:

```bash
cd opencode
./setup.sh
```

It walks you through:

1. Prerequisite checks (Node 18+, OpenCode CLI, curl)
2. Target workspace path (the project your agents will work on)
3. Telegram bot token + handshake (optional, for notifications)
4. App URL (optional, for the visual-analyst to browse)

Then start the agency:

```bash
./control.sh start
```

Write a feature request and the pipeline begins instantly:

```bash
echo "- Add dark mode toggle to settings page" >> SUGGESTIONS.md
```

## Commands

```bash
./control.sh start    # Start the orchestrator
./control.sh stop     # Stop the orchestrator
./control.sh reset    # Stop, wipe tasks + logs, keep config
./control.sh status   # Check if running
```

## Task Lifecycle

Each task in `tasks.json` moves through these statuses:

```
pending --> in_progress --> ready_for_test --> completed
               ^                                  |
               |_________ (on failure) ___________|
```

- `pending` -- CEO created the task, orchestrator dispatches PM
- `in_progress` -- PM enriched it, orchestrator dispatches Dev
- `ready_for_test` -- Dev finished, orchestrator dispatches Test
- `completed` -- all checks passed

## Telegram Notifications

If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in `config.json`, the orchestrator sends real-time Telegram notifications on every agent dispatch, completion, and failure. The `telegram-notifier.ts` plugin additionally hooks into OpenCode's internal task events.

## Requirements

- Node.js 18+
- [OpenCode CLI](https://opencode.ai) installed at `/usr/bin/opencode`
- Bash shell
- Telegram Bot (optional, for notifications)
