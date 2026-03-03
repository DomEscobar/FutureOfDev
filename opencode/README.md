# 🏛️ Agency Governed Roster (V16.0)

The **Agency** is a high-fidelity, autonomous multi-agent orchestration framework designed for professional software engineering. It transforms a team of specialized AI agents into a **Global System Command** that builds, audits, and self-heals codebases under strict architectural governance.

**Canonical explorer:** `hyper-explorer/src/hyper-explorer-mcp.mjs` only. Legacy explorers and Playwright flows are in `archive/` (see `archive/README.md`).

## 🚀 Quick Start (Portable Setup)

The Agency is now a portable system. To install it on any machine:

1. **Clone & Link**:
   ```bash
   cd /path/to/FutureOfDev/opencode
   chmod +x agency.js
   sudo ln -sf $(pwd)/agency.js /usr/local/bin/agency
   ```

2. **Initialize a Project**:
   Go to any codebase you want to govern and run:
   ```bash
   agency init
   ```
   This creates an `agency.json` and a local `.run/` directory to track telemetry.

3. **Execute a Mission**:
   ```bash
   agency run "Implement a hierarchical category model for the product catalog"
   ```

## 🏛️ Architecture: The Physical Desk Model (V11.0+)

Unlike traditional "one-bot" systems, the Agency uses a **Specialized Roster** located in the `roster/` directory. Each role is a "Jailable Persona" with its own:
- **SOUL.md**: Behavioral constraints and core identity.
- **TOOLBOX.json**: Hard-restricted list of allowed tools (e.g., Architects cannot write code).
- **Clean-Room Spawning**: Agents are spawned in isolated processes. Between every turn, the process is killed to prevent "Context Bleeding."

### The Active Roster:
- **📐 ARCHITECT**: Designs the contract (`contract.md`). Forbidden from implementation.
- **⚙️ HAMMER**: The high-velocity executor. Implements the Architect's contract.
- **🧐 AUDITOR**: The "Zealot" of the Universal Scientific Gate (V15.0). Verifies Proof-of-Failure before any code is written.
- **🩹 MEDIC**: Self-healing agent. Runs builds/tests and fixes errors in a "Ralph Wiggum Loop."
- **🕹️ PLAYER**: Hyper Explorer (MCP). Goal-directed discovery; findings in `roster/player/memory/findings.md`; optional **player-finding-watcher.cjs** triggers Agency per finding and appends to `agency_feedback.md`. Also supports legacy **Player-OS** / Hero's Journal mode.

## 🧪 V15.0 "THE OBELISK" - Universal Scientific Gate (USG)

All tasks now follow the **Scientific Method**:

```
Task → Scientist Mode → Proof-of-Failure (Red Test) → Implementation → Proof-of-Success (Green Test)
```

- **Red Test**: A failing test/script that proves the bug exists or the feature is missing.
- **Green Test**: The same test passing after implementation.
- **No "Feature Mode"**: Both bugs and features require technical proof before code is written.

## 📊 V16.0 KPI Gates (Definition of DONE)

The Hammer cannot mark a task as DONE without passing all checks:

### Scientific Process (Mandatory)
- [ ] **Red Test** — Proof-of-Failure script in `.run/red-test.*`
- [ ] **Green Test** — Proof-of-Success script passes
- [ ] **Regression** — Existing tests still pass

### Code Quality (Mandatory)
- [ ] **Coverage ≥ 80%** — `go tool cover` or `npm run test:coverage`
- [ ] **Linting** — `gofmt -l .` / `eslint .` with no errors
- [ ] **Security** — No hardcoded secrets, no OWASP Top 10 issues

### Performance (Mandatory for DB/API)
- [ ] **No N+1 Queries** — Verify no lazy-loading loops
- [ ] **Response Time** — API < 200ms

### Safety / Governance (Mandatory)
- [ ] **Blast Radius** — Document dependent files in `.run/contract.md`
- [ ] **VETO_LOG Check** — Avoid repeating past failures
- [ ] **ARCHITECTURE.md** — Update if schema changes

The Orchestrator enforces these gates via `enforceKPIGate()` in `orchestrator.cjs`.

## 🕹️ PLAYER: Hyper Explorer & Finding → Fix Loop

The **Player** discovers web apps via goal-directed graph-based exploration (Hyper Explorer MCP), records findings to `roster/player/memory/findings.md`, and the optional **Finding Watcher** turns each new finding into an Agency task. Flow:

```
Explorer (hyper-explorer-mcp.mjs) → findings.md → player-finding-watcher.cjs → agency.js → orchestrator.cjs
```

Two entry styles: **one-shot** (`run-explore-and-watch.cjs` or `run-extended-and-fix.cjs`) or **full loop** (`start-loop.js`: telegram + watcher in background, then explorer in foreground).

### Hyper Explorer (`hyper-explorer/src/hyper-explorer-mcp.mjs`)

**Single canonical explorer.** MCP + Playwright; knowledge graph, replanning, coverage. Flow: **Plan** (goal decomposition) → **Execute** (observe → decide → act) → **Replan** on stuck.

- **Memory**: `hyper-explorer/memory/` — `knowledge_graph.json`, `plan_trace.jsonl`, `execution_log.jsonl` (generated; see `.gitignore`).
- **Findings**: Appends to `roster/player/memory/findings.md` (goal failures, console errors, etc.).

**Auth:** For apps that require login, add `hyper-explorer/memory/credentials.json` or pass credentials in config.

```bash
# From opencode root
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 explore_max_coverage
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 complete_registration login
node hyper-explorer/src/hyper-explorer-mcp.mjs http://localhost:5173 --journeys
```

### Player Finding Watcher (`player-finding-watcher.cjs`)

Polls `roster/player/memory/findings.md`; for each new finding (fingerprinted), builds a task payload, optionally classifies with `classifier.cjs`, and spawns `agency.js` with `AGENCY_TASK_JSON` and `WORKSPACE`. Agency runs the orchestrator; result is appended to `roster/player/memory/agency_feedback.md`.

- **Config**: `roster/player/memory/watcher_config.json` — `workspace`, optional `pollMs`, `skipAgencyForTaskTypes`. CLI: `--no-semantic-dedup` to process same goal name again (e.g. reruns).
- **State**: `roster/player/memory/watcher_state.json` — processed fingerprints and titles.

**Continuous watch:**
```bash
node player-finding-watcher.cjs
```

**Single pass:**
```bash
node player-finding-watcher.cjs --once
# Rerun same goals: node player-finding-watcher.cjs --once --no-semantic-dedup
```

Watcher uses `workspace` from config (or `WORKSPACE` env when set); ensure `AGENCY_HOME` points to opencode when running from elsewhere.

### Explorer + watcher one-shot (`run-explore-and-watch.cjs`)

Runs the Hyper Explorer (MCP), then the watcher once so new findings trigger Agency. Default: watcher `--once`. Use `--yolo` for full journeys and daemon watcher.

```bash
node run-explore-and-watch.cjs [URL] [goal1 goal2 ...]
node run-explore-and-watch.cjs http://localhost:5173 explore_max_coverage login --once
node run-explore-and-watch.cjs http://localhost:5173 --journeys
node run-explore-and-watch.cjs http://localhost:5173 --yolo   # --journeys + --max-steps 20, watcher daemon
```

### Extended run + proactive fix (`run-extended-and-fix.cjs`) (`run-extended-and-fix.cjs`)

Runs the Hyper Explorer with goal `explore_max_coverage`, then runs the watcher once so new findings are turned into Agency tasks and fixed in sequence.

```bash
node run-extended-and-fix.cjs [URL]
# Default URL: EXPLORER_URL or http://localhost:5173
# Watcher workspace from roster/player/memory/watcher_config.json or WORKSPACE.
```

### Full loop launcher (`start-loop.js`)

Kills stale processes (orchestrator, watcher, explorer, telegram-control), clears watcher state, starts **telegram-control.cjs** and **player-finding-watcher.cjs** in background (watcher with `--watch --health-port 9999`), then runs the **Hyper Explorer MCP** in foreground.

```bash
node start-loop.js [explorer_url] [goal_or_--journeys]
# Default: http://localhost:5173, goal explore_max_coverage
# e.g. node start-loop.js http://localhost:5173 --journeys
```

After the explorer exits, the watcher keeps running; use Telegram or `curl http://localhost:9999/health` for status.

### Player-OS: Decoupled UX Auditing (legacy / alternate)

The **Player-OS** path uses an isolated runtime with no shared state with the Agency pipeline:

- **Dynamic Brain** (`roster/player/dynamic_brain.py`): MCP-equivalent Playwright bridge.
- **Visual Telemetry** (`telemetry-player.cjs`): Player-only session reporting.
- **Hero's Journal** (`roster/player/memory/HERO_JOURNAL.md`): UX findings log.

```bash
node player-os.cjs "Describe your UX audit mission"
```

## 🛠️ Universal CLI Command Reference

| Command | Action |
|:---|:---|
| `agency run <task_id>` | Runs a formal benchmark (Resets workspace to baseline). |
| `agency run "<prompt>"` | **Ad-Hoc Mode**: Executes any natural language mission. Finding tasks: pass `AGENCY_TASK_JSON` and `WORKSPACE` (watcher does this). |
| `agency status` | Displays real-time telemetry from the last run (Tokens, Cost, Tests). |
| `agency roster` | Lists all active agent souls currently inhabiting the desks. |
| `agency init` | Bootstraps the current directory for Agency governance. |
| `node hyper-explorer/src/hyper-explorer-mcp.mjs <URL> [goal...]` | Goal-directed exploration. Default goal: `explore_max_coverage`. Use `--journeys` for all journeys. Writes to `hyper-explorer/memory/` and `roster/player/memory/findings.md`. |
| `node player-finding-watcher.cjs` | Watch `findings.md`; on new finding, trigger Agency; append to `agency_feedback.md`. Uses `roster/player/memory/watcher_config.json` for `workspace`. |
| `node player-finding-watcher.cjs --once` | Process new findings once, trigger Agency for each, then exit. Add `--no-semantic-dedup` to reprocess same goal name. |
| `node run-explore-and-watch.cjs [URL] [goals...]` | Run explorer then watcher once. Optional `--journeys`, `--yolo` (full journeys + daemon watcher). |
| `node run-extended-and-fix.cjs [URL]` | Run Hyper Explorer (goal: explore_max_coverage), then watcher --once. |
| `node start-loop.js [URL] [goal|--journeys]` | Start telegram + watcher in background, run explorer in foreground. Default goal: `explore_max_coverage`. |

## 🌍 Environment & Portability

The Agency (V16.0) uses **Environment-Aware Pathing**.

- **`AGENCY_HOME`**: Points to `opencode/` directory. Used by watcher, explorer (findings path), agency, and scripts when run from elsewhere.
- **`WORKSPACE`**: Target repo for Agency runs. Set in `roster/player/memory/watcher_config.json` for the watcher, or pass env for one-off runs. Agency prefers `WORKSPACE` env when set for `agency run`.
- **`EXPLORER_URL`**: Default URL for `run-extended-and-fix.cjs` (default: `http://localhost:5173`).
- **`config.json`** (gitignored): Telegram bot token/chat ID and optional project settings; used by `telegram-control.cjs`, telemetry, classifier.
- **Clean Sweep Protocol**: Formal benchmarks use `git reset --hard benchmark-baseline` at the start to ensure scientific isolation. In persistent mode, the final implementation remains in the workspace for review.

## 📊 Live Pulse Dashboard

Runs are streamed via **Telegram** (token/chat in `config.json`). Start the control bot with `node telegram-control.cjs` for `/status`, `/start`, `/stop`, `/logs`, explorer trigger (runs `hyper-explorer-mcp.mjs`), verify-fix, and mute. High-fidelity economics (Token/Cost) and quality KPIs are reported.

## 🧪 Testing

The test suite covers orchestrator core, classifier, agency smoke, and Telegram telemetries. Run all tests:

```bash
npm test
```

| Test file | Coverage |
|:---|:---|
| `test/orchestrator-core.test.cjs` | `loadProjectConfig`, `filterChecksByScope`, `readAgentResult`, `parseTaskInput`, `resolveTask` — gates, malformed JSON, benchmark prefix, id-only task |
| `test/classifier.test.cjs` | `parseResult`, `TASK_TYPES`/`SCOPES`, `classifyTask` (mocked LLM) |
| `test/agency-smoke.test.cjs` | Orchestrator exit 2 (EXPLORE skip), exit 1 (no task) |
| `test/telegram-formatters.test.cjs` | `progressBar`, `severityBadge`, `formatCost`, `formatDuration`, `escapeMarkdown`, `truncate`, `bold`/`italic` |
| `test/telegram-buttons.test.cjs` | `reRunExplorer`, `verifyFix`, `muteFor`, `viewLog`, `combine`, `actionPanel`, `confirm` |
| `test/telegram-render.test.cjs` | `renderAgency`, `renderPlayer`, `renderFinding`, `renderKpi` |
| `test/ledger.test.cjs` | `addFinding`, `storeTelegramMessageId`/`getTelegramMessageId`, `getFinding`, `listAll`/`getOpenFindings`, `verifyFinding` |
| `test/mute-manager.test.cjs` | Global and per-finding mute: `isGloballyMuted`, `setGlobalMute`, `clearAllMutes`, `isFindingMuted`, `setFindingMute` |
| `test/finding-loop.test.cjs` | `parseNewFindings`, `buildPerfectTask`, handoff agency → orchestrator with `AGENCY_TASK_JSON` |

Fixtures under `test/fixtures/` provide workspaces with/without DOD, gate variants, malformed/unknown result files, and a dedicated dir for ledger/mute tests (via `AGENCY_HOME`).

**Archive:** Legacy explorers, Playwright flows, and one-off scripts are in `archive/`; see `archive/README.md`.

---
**Governance Status**: `V16.0-KPI-GATES`  
**Master Spec Compliance**: `V1.0 - V16.0`

