# OpenCode Agency

An autonomous AI development agency powered by [OpenCode](https://opencode.ai). A human writes a feature request, and a pipeline of specialized AI agents handles planning, architecture, implementation, code review, testing, security auditing, and visual QA -- without manual intervention.

## How It Works

A Node.js orchestrator (`orchestrator.js`) runs a graph-based pipeline with parallel execution (up to 3 concurrent agents). It watches `SUGGESTIONS.md` for new requests and drives tasks through a multi-stage lifecycle.

```
 You edit SUGGESTIONS.md
        │
        ▼
 CEO ─── creates tasks in tasks.json (status: pending)
        │
        ▼
 PM ──── breaks down task, writes implementation plan
        │
        ├── simple/moderate ──▶ implementation
        └── complex ──────────▶ architecture
                                    │
 Architect ── designs file          │
   structure, APIs, data models     │
        │                           │
        ▼                           ▼
 Dev ──── implements code in target workspace
        │
        ▼
 Code Reviewer ── inspects changes
        │
        ├── approved ──▶ testing
        └── rejected ──▶ back to Dev (with feedback)
                          │
        ┌────────────────┘
        ▼
 Gatekeeper (script, no LLM) ── secret scan, lint
        │
        ▼
 QA Agent ── verifies functionality
        │
        ▼
 Post-test checks (parallel, conditional):
        ├── needs_security_audit? ──▶ Shadow Tester
        └── needs_visual_check?  ──▶ Visual Analyst
        │
        ▼
   completed (or blocked after 2 retries)
```

## Agents

| Agent | Role | Triggered By |
|-------|------|--------------|
| **CEO** | Reviews suggestions, classifies tasks with type/complexity/audit flags | `SUGGESTIONS.md` changes |
| **Project Manager** | Breaks down tasks into numbered implementation steps | Status `pending` |
| **Architect** | Designs file structure, API contracts, data models | Status `architecture` (complex tasks) |
| **Dev Unit** | Writes code in the target workspace | Status `implementation` |
| **Code Reviewer** | Reviews implementation for bugs, quality, and spec adherence | Status `code_review` |
| **Test Unit** | Runs gatekeeper + LLM-driven verification | Status `testing` |
| **Shadow Tester** | Adversarial security red-teaming (OWASP Top 10) | Post-test, if `needs_security_audit` |
| **Visual Analyst** | UX/accessibility audit via Playwright | Post-test, if `needs_visual_check` |

## MCP Servers

Registered in `opencode.json` and available to all agents:

| Server | Purpose |
|--------|---------|
| **memory** | Knowledge graph for sharing context between agents across stages |
| **sequential-thinking** | Structured step-by-step reasoning for planning and architecture |
| **exa** | Web and code search for documentation and examples |

## Skills

Installed skills that agents reference in their prompts:

| Skill | Used By |
|-------|---------|
| `webapp-testing` | Test Unit -- browser-based functional testing |
| `requesting-code-review` / `receiving-code-review` | Code Reviewer, Dev Unit -- review protocol |
| `web-design-guidelines` / `frontend-design` | Dev Unit, Visual Analyst -- UI quality standards |
| `security-review` | Shadow Tester -- vulnerability audit methodology |
| `audit-website` | Visual Analyst -- comprehensive site quality checks |
| `api-design-principles` | Architect -- REST/API contract design |
| `performance` | Test Unit -- performance baseline checks |

## Project Structure

```
opencode/
├── setup.sh                        # Interactive first-time setup
├── control.sh                      # Start/stop/reset/status wrapper
├── orchestrator.js                 # Graph-based pipeline with parallel execution
├── tasks.json                      # Task state machine
├── SUGGESTIONS.md                  # Human input file
├── opencode.json                   # Agent definitions + MCP server config
├── config.json                     # Workspace path + credentials
├── .run/                           # Runtime artifacts (gitignored)
│   ├── agency.log                  # Orchestrator log
│   ├── context/<task-id>/          # Per-task context files (review.json, testing.json, etc.)
│   └── <agent>-<timestamp>.log     # Individual agent run logs
├── scripts/
│   └── gatekeeper.sh               # Pre-push secret/lint scan (no LLM cost)
└── plugins/
    └── telegram-notifier.ts        # OpenCode plugin for Telegram notifications
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

Write a feature request and the pipeline begins:

```bash
echo "- Add dark mode toggle to settings page" >> SUGGESTIONS.md
```

## Commands

```bash
./control.sh start    # Start the orchestrator
./control.sh stop     # Stop the orchestrator
./control.sh reset    # Stop, wipe tasks + logs + context, keep config
./control.sh status   # Check if running
```

## Task Schema

Each task in `tasks.json` carries metadata that controls pipeline routing:

```json
{
  "id": "kebab-case-id",
  "title": "Short description",
  "description": "Implementation plan (filled by PM)",
  "status": "pending",
  "type": "frontend|backend|fullstack|docs|config",
  "complexity": "simple|moderate|complex",
  "needs_security_audit": false,
  "needs_visual_check": false,
  "retry_count": 0
}
```

## Task Lifecycle

```
pending ──▶ implementation ──▶ code_review ──▶ testing ──▶ completed
   │              ▲                │               │
   │              │ (on rejection  │               │
   │              │  or failure)   │               │
   │              └────────────────┘               │
   │                                               │
   └──▶ architecture ──▶ implementation            │
        (complex only)                             │
                                                   ▼
                                          post-test checks
                                          (security + visual)
                                                   │
                                                   ▼
                                        completed or blocked
```

- **pending** -- CEO created the task, orchestrator dispatches PM
- **architecture** -- complex tasks go through Architect before Dev
- **implementation** -- Dev writes code in the target workspace
- **code_review** -- Reviewer inspects; approved advances, rejected loops back
- **testing** -- Gatekeeper script + QA agent verify correctness
- **completed** -- all checks passed
- **blocked** -- task failed after 2 retries, requires human attention

## Error Recovery

Every failure loops the task back to `implementation` with the failure context appended to the task description, so the Dev agent sees what went wrong. After 2 failed retries, the task is marked `blocked` and a Telegram alert is sent.

## Telegram Notifications

If `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in `config.json`, the orchestrator sends real-time Telegram messages on every agent dispatch, completion, failure, and blocked task. The `telegram-notifier.ts` plugin additionally hooks into OpenCode's internal task events.

## Requirements

- Node.js 18+
- [OpenCode CLI](https://opencode.ai) installed
- Bash shell
- Telegram Bot (optional, for notifications)
