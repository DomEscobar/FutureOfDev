# 🏛️ Agency Governed Roster (V16.0)

The **Agency** is a high-fidelity, autonomous multi-agent orchestration framework designed for professional software engineering. It transforms a team of specialized AI agents into a **Global System Command** that builds, audits, and self-heals codebases under strict architectural governance.

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
- **🕹️ PLAYER**: Universal Web App Explorer. Structure-only discovery, UX findings in `ux_findings.md`; optional watcher triggers Agency to fix findings and writes `agency_feedback.md`. Also supports decoupled Player-OS / Hero's Journal mode.

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

## 🕹️ PLAYER: Universal Explorer & Finding → Fix Loop

The **Player** discovers any web app via structure only (no keyword matching), records UX findings, and can trigger the Agency to fix them. The system runs in two modes: **decoupled UX auditing** (Player-OS / Hero's Journal) and **Universal Explorer** with an optional **Finding Watcher** that turns new findings into Agency tasks.

### Universal Web App Explorer (`universal-explorer.mjs`)

Structure-only explorer using Playwright’s accessibility snapshot and refs. Flow: **Observe** (snapshot) → **Reason** (structure) → **Act** (click/fill by ref). No hardcoded paths or pattern matching.

- **App memory**: `roster/player/memory/app_memory.json` — screens, transitions, outcomes per app (learns which actions lead to new pages).
- **Outputs**: `exploration_journal.md`, `explorer_state.json`, `ux_findings.md`, screenshots in `roster/player/memory/`.

**Auth:** For apps that require login, add `roster/player/memory/credentials.json`:

```json
{ "email": "your@email.com", "password": "YourPassword", "name": "Your Name" }
```

```bash
node universal-explorer.mjs <URL> [max_steps]
# e.g. node universal-explorer.mjs http://localhost:5173 80
```

### Player Finding Watcher (`player-finding-watcher.cjs`)

When the Player writes a new entry to `ux_findings.md`, the watcher can trigger the Agency with that finding as a task. When the Agency finishes, it appends to `agency_feedback.md`; the Explorer reads that file on its next run so the script has “told” the Player the result.

- **Config**: `roster/player/memory/watcher_config.json` — `workspace` (Agency target repo), optional `pollMs`.
- **State**: `roster/player/memory/watcher_state.json` — only new findings are processed (fingerprinted).

**Continuous watch:**
```bash
WORKSPACE=/path/to/app node player-finding-watcher.cjs
```

**Single pass (e.g. after a run):**
```bash
WORKSPACE=/path/to/app node player-finding-watcher.cjs --once
```

### Extended run + proactive fix (`run-extended-and-fix.cjs`)

Runs the Explorer with more steps, then runs the watcher once so new findings from that run are turned into Agency tasks and fixed in sequence.

```bash
WORKSPACE=/path/to/app node run-extended-and-fix.cjs [URL] [steps]
# Default: http://localhost:5173, 150 steps
# e.g. WORKSPACE=/root/EmpoweredPixels node run-extended-and-fix.cjs http://localhost:5173 150
```

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
| `agency run "<prompt>"` | **Ad-Hoc Mode**: Executes any natural language mission. |
| `agency status` | Displays real-time telemetry from the last run (Tokens, Cost, Tests). |
| `agency roster` | Lists all active agent souls currently inhabiting the desks. |
| `agency init` | Bootstraps the current directory for Agency governance. |
| `node universal-explorer.mjs <URL> [steps]` | Explore a web app (structure-only). Writes to `roster/player/memory/`. |
| `WORKSPACE=/path node player-finding-watcher.cjs` | Watch `ux_findings.md`; on new finding, trigger Agency and write `agency_feedback.md`. |
| `WORKSPACE=/path node player-finding-watcher.cjs --once` | Process new findings once, trigger Agency for each, then exit. |
| `WORKSPACE=/path node run-extended-and-fix.cjs [URL] [steps]` | Run explorer extended, then watcher --once to fix new findings. |

## 🌍 Environment & Portability

The Agency (V16.0) uses **Environment-Aware Pathing**.

- **`AGENCY_HOME`**: Define this to point to your `opencode/` directory when running from elsewhere.
- **`WORKSPACE`**: Target repo for Agency runs. Required for `player-finding-watcher.cjs` and `run-extended-and-fix.cjs` (the app under test).
- **`EXPLORER_URL`**, **`EXTENDED_STEPS`**: Default URL and step count for `run-extended-and-fix.cjs`.
- **Clean Sweep Protocol**: Formal benchmarks use `git reset --hard benchmark-baseline` at the start to ensure scientific isolation. In persistent mode, the final implementation remains in the workspace for review.

## 📊 Live Pulse Dashboard
All runs are streamed via Telegram with high-fidelity economics (Token/Cost tracking) and quality KPIs.

---
**Governance Status**: `V16.0-KPI-GATES`  
**Master Spec Compliance**: `V1.0 - V16.0`

