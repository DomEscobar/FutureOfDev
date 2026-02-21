# Future of Dev 2026-2030 | Intelligence Dashboard

**Live URL:** [http://v2202502215330313077.supersrv.de:49300/](http://v2202502215330313077.supersrv.de:49300/)

---

## 🏛️ Autonomous Agency V7.1 (Protocol-Aware Edition)

A fully operational **Governed Autonomous Agency** that orchestrates specialized AI agents to build and maintain software systems.

### 🧬 Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ tasks.json      │────►│ orchestrator.cjs │────►│ opencode run    │
│ (pending)       │     │ (15s poll)       │     │ --agent dev-unit│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌─────────────┐          ┌─────────────────┐
                        │ Chronos     │          │ stdout parsing  │
                        │ (1min poll) │          │ APPROVED/PASS   │
                        └─────────────┘          └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │ context.json    │
                                               │ status:completed│
                                               └─────────────────┘
```

---

## ⚡ Core Components

### 🎯 Orchestrator V7.1 (`orchestrator.cjs`)
- **Task Dispatch**: Routes tasks to correct agents (backend → dev-unit, test → test-unit)
- **Circuit Breaker**: Rule of Three - blocks tasks after 3 failures
- **Cooldown**: 30s between same-task dispatches
- **Timeout Handling**: 180s max, with immediate status update on timeout
- **Verdict Parsing**: Detects APPROVED/PASS/FAIL keywords in agent output

### 🛡️ Chronos V2.5 (`chronos.cjs`)
- **Stall Detection**: Restarts orchestrator if no activity for 5 minutes
- **Auto-Purge**: Deletes agent logs older than 24 hours
- **Disk Monitor**: Warns at 90% disk usage
- **Auto-Start**: Ensures orchestrator is always running

### 📡 Telegram Control (`telegram-control.cjs`)
- **Surveillance**: `/status`, `/top`, `/logs`, `/agents`
- **Operations**: `/start`, `/stop`, `/unblock <id>`
- **Intelligence**: `/setmodel <agent> <model>`, `/run <cmd>`

---

## 🤖 Agent Roster

| Agent | Model | Purpose | Steps |
|-------|-------|---------|-------|
| `dev-unit` | minimax-m2.5 | Write code, fix bugs | 100 |
| `code-reviewer` | claude-3.5-sonnet | Quality gate | 30 |
| `test-unit` | gemini-2.0-flash | Run tests | 20 |
| `ceo` | minimax-m2.5 | Strategic decisions | 20 |
| `project-manager` | minimax-m2.5 | Task breakdown | 20 |

---

## 🔧 Quick Start

```bash
# Start all services
cd /root/FutureOfDev/opencode
node orchestrator.cjs &   # Task dispatcher
node chronos.cjs &        # Self-healing guardian
node telegram-control.cjs &  # Remote control

# Check status
cat tasks.json
cat .run/agency.log | tail -20
```

---

## 📡 Telegram Commands

| Command | Description |
|---------|-------------|
| `/status` | Show task summary and process status |
| `/top` | List active processes |
| `/logs` | Last 20 lines of agency log |
| `/agents` | List configured agents and models |
| `/start` | Start orchestrator and chronos |
| `/stop` | Kill all agency processes |
| `/unblock <id>` | Reset a blocked task to pending |
| `/setmodel <agent> <model>` | Change agent model |

---

## 🛡️ Safety Features

| Feature | Implementation |
|---------|---------------|
| **Circuit Breaker** | Tasks blocked after 3 failures |
| **Timeout Guard** | 180s max runtime per task |
| **Cooldown** | 30s between same-task dispatches |
| **Auto-Recovery** | Chronos restarts dead orchestrator |
| **Log Rotation** | 30-line cap on main logs |
| **Graceful Shutdown** | SIGTERM/SIGINT handlers |

---

## 📁 File Structure

```
opencode/
├── orchestrator.cjs      # Task dispatcher (V7.1)
├── chronos.cjs           # Self-healing guardian (V2.5)
├── telegram-control.cjs  # Remote control bot
├── opencode.json         # Agent configurations
├── tasks.json            # Task backlog
├── config.json           # Telegram credentials
└── .run/
    ├── agency.log        # Dispatcher log
    ├── chronos_healing.log
    └── context/          # Agent verdict files
```

---

## Reports & Research

- **[FUTURE_OUTLOOK_REPORT.md](FUTURE_OUTLOOK_REPORT.md)** | 2026-2030 Strategic Forecast
- **[COMPARISON_MATRIX.md](COMPARISON_MATRIX.md)** | 10 AI tools rated
- **[SOCIAL_SENTIMENT_AUDIT.md](SOCIAL_SENTIMENT_AUDIT.md)** | Community consensus

---

## Tech Stack

- **Engine:** OpenCode AI (Protocol-Aware V7.1)
- **Meta-Agent:** Chronos V2.5 (Self-Healing)
- **Remote Management:** Telegram Bot API
- **State:** JSON persistence with stdout-based verdict parsing

---

## Last Verified
**2026-02-21 | STAMP: V7.1 PROTOCOL-AWARE**

---

*This repository is a self-evolving system. Do not modify orchestrator.cjs unless Safety Lock is engaged.*