# OpenCode Agency

An autonomous AI development agency powered by [OpenCode](https://opencode.ai). A human writes a feature request, and a pipeline of specialized AI agents handles planning, implementation, testing, and security -- without manual intervention.

## How It Works

The agency runs as a background process that watches two files: `SUGGESTIONS.md` (human input) and `tasks.json` (machine state). When either changes, it triggers the appropriate agent.

```
 You edit SUGGESTIONS.md
        |
        v
 CEO agent reviews, creates tasks in tasks.json (status: pending)
        |
        v
 PM agent adds technical spec, assigns to dev (status: in_progress)
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
├── control.sh                      # Orchestrator: start/stop/status
├── tasks.json                      # State machine (source of truth)
├── SUGGESTIONS.md                  # Human input file
├── opencode.json                   # Agent definitions
├── config.json                     # Workspace path + credentials
├── .gitignore
├── scripts/
│   ├── evaluate-state.js           # Routes tasks to agents based on status
│   ├── gatekeeper.sh               # Pre-push secret detection scan
│   └── test-harness.js             # Structural + npm test runner
└── plugins/
    └── telegram-notifier.ts        # Sends Telegram messages on task events
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
3. Telegram bot token + chat ID (optional, for notifications)
4. App URL (optional, for the visual-analyst to browse)

Then start the agency:

```bash
./control.sh start
```

Write a feature request and the pipeline begins within 5 seconds:

```bash
echo "- Add dark mode toggle to settings page" >> SUGGESTIONS.md
```

## Commands

```bash
./control.sh start    # Start the agency monitor
./control.sh stop     # Stop the agency monitor
./control.sh status   # Check if running
```

## Task Lifecycle

Each task in `tasks.json` moves through these statuses:

```
pending --> assigned_to_dev --> in_progress --> in_dev --> ready_for_test --> testing --> completed
                                   ^                                           |
                                   |__________ (on failure) ___________________|
```

- `pending` -- CEO created the task
- `assigned_to_dev` -- evaluate-state picked it up, PM is adding details
- `in_progress` -- PM finished, evaluate-state routes to Dev
- `in_dev` -- Dev is implementing
- `ready_for_test` -- Dev finished, evaluate-state routes to Test
- `testing` -- Test is running gatekeeper + harness
- `completed` -- all passed

## Telegram Notifications

If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in `config.json`, the agency sends real-time notifications on every agent success or failure via the `telegram-notifier.ts` plugin.

## Requirements

- Node.js 18+
- [OpenCode CLI](https://opencode.ai) installed at `/usr/bin/opencode`
- Bash shell
- Telegram Bot (optional, for notifications)
