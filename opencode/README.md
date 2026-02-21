# 🏛️ Autonomous Agency V7.1

A self-healing, protocol-aware task orchestration system that drives AI agents to build software autonomously.

---

## 🎯 What This Does

1. **Dispatches tasks** from `tasks.json` to specialized AI agents
2. **Parses verdicts** from agent stdout (APPROVED/PASS/FAIL keywords)
3. **Updates task status** automatically (pending → in_progress → completed/blocked)
4. **Self-heals** when processes crash or stall

---

## 🚀 Quick Start

```bash
# Start all services
node orchestrator.cjs &      # Task dispatcher
node chronos.cjs &           # Self-healing guardian
node telegram-control.cjs &  # Remote control (optional)

# Check status
cat tasks.json
tail -20 .run/agency.log
```

---

## 📁 File Structure

```
opencode/
├── orchestrator.cjs       # Main dispatcher (V7.1)
├── chronos.cjs            # Self-healing guardian (V2.5)
├── telegram-control.cjs   # Telegram remote control
├── opencode.json          # Agent configurations
├── tasks.json             # Task backlog
├── config.json            # Telegram credentials
└── .run/
    ├── agency.log         # Dispatcher log (30-line cap)
    ├── chronos_healing.log
    ├── orchestrator.out   # Raw stdout
    └── context/           # Agent verdict files
        └── <task-id>-context.json
```

---

## 🤖 Agents

Defined in `opencode.json`:

| Agent | Model | Purpose |
|-------|-------|---------|
| `dev-unit` | minimax-m2.5 | Write code, fix bugs, implement features |
| `code-reviewer` | claude-3.5-sonnet | Review code, approve/reject |
| `test-unit` | gemini-2.0-flash | Run tests, report pass/fail |
| `ceo` | minimax-m2.5 | Strategic decisions |
| `project-manager` | minimax-m2.5 | Task breakdown |

### Agent Routing

```
backend/frontend/api/feature/bug/fix → dev-unit
review → code-reviewer
test → test-unit
```

---

## 📋 tasks.json Schema

```json
{
  "tasks": [
    {
      "id": "unique-task-id",
      "content": "Short description",
      "description": "Detailed instructions for the agent",
      "status": "pending|in_progress|completed|blocked",
      "priority": "high|medium|low",
      "retry_count": 0,
      "started_at": "ISO timestamp",
      "completed_at": "ISO timestamp",
      "last_error": "Error message if failed"
    }
  ]
}
```

---

## 🔄 Task Lifecycle

```
pending → in_progress → completed
    │          │
    │          └─→ timeout/reject → pending (retry++)
    │                           │
    │                           └─→ blocked (retry >= 3)
    │
    └─→ blocked (manually via Telegram)
```

---

## 🛡️ Safety Features

### Circuit Breaker (Rule of Three)
Tasks are **blocked** after 3 consecutive failures to prevent infinite loops.

### Timeout Guard
Tasks exceeding **180 seconds** are killed and status is updated immediately.

### Cooldown
**30 second** wait between dispatching the same task again.

### Auto-Recovery
Chronos restarts the orchestrator if:
- No log activity for 5 minutes
- Orchestrator process dies

### Log Rotation
All logs capped at **30 lines** to prevent disk bloat.

---

## 📡 Telegram Commands

| Command | Description |
|---------|-------------|
| `/status` | Task summary + process status |
| `/top` | Active processes |
| `/logs` | Last 20 lines of agency log |
| `/agents` | List agents and models |
| `/start` | Start orchestrator + chronos |
| `/stop` | Kill all agency processes |
| `/unblock <id>` | Reset blocked task to pending |
| `/setmodel <agent> <model>` | Change agent model |
| `/run <cmd>` | Execute shell command |

---

## 🔧 Configuration

### opencode.json

```json
{
  "agents": {
    "dev-unit": {
      "mode": "primary",
      "model": "openrouter/minimax/minimax-m2.5",
      "prompt": "You are the Developer...",
      "steps": 100
    }
  }
}
```

### config.json

```json
{
  "telegram": {
    "token": "YOUR_BOT_TOKEN",
    "chatId": "YOUR_CHAT_ID"
  }
}
```

---

## 🐛 Troubleshooting

### Task stuck in `in_progress`

```bash
# Check if agent process is running
ps aux | grep opencode

# If not, reset manually
jq '.tasks[] | select(.id=="task-id") | .status="pending"' tasks.json
```

### Orchestrator won't start

```bash
# Check for stuck processes
pkill -f orchestrator.cjs
pkill -f chronos.cjs

# Clear locks and restart
rm -f .run/*.lock
node orchestrator.cjs &
```

### Chronos keeps restarting orchestrator

Check the `CHRONOS_DISABLED` flag:
```bash
# Disable Chronos temporarily
touch CHRONOS_DISABLED

# Re-enable
rm CHRONOS_DISABLED
```

---

## 📊 Monitoring

### Live logs
```bash
tail -f .run/agency.log
tail -f .run/chronos_healing.log
```

### Context files (verdicts)
```bash
cat .run/context/*.json
```

### Process status
```bash
ps aux | grep -E "(orchestrator|chronos|telegram)"
```

---

## 🔐 Safety Lock

To prevent Chronos from restarting the agency:

```bash
touch CHRONOS_DISABLED   # Enable safety lock
rm CHRONOS_DISABLED      # Disable safety lock
```

---

## Version History

| Version | Changes |
|---------|---------|
| V7.1 | Timeout handler updates status immediately; fixed agent prompts |
| V7.0 | Protocol-aware parsing (stdout keywords); 180s timeout; task recovery |
| V6.0 | MCP-Memory integration; Oracle audit |
| V5.0 | Telegram remote control |
| V2.5 | Chronos auto-start, log purge |

---

## License

MIT

---

*Last updated: 2026-02-21*