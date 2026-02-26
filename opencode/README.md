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

## 🛠️ Universal CLI Command Reference

| Command | Action |
|:---|:---|
| `agency run <task_id>` | Runs a formal benchmark (Resets workspace to baseline). |
| `agency run "<prompt>"` | **Ad-Hoc Mode**: Executes any natural language mission. |
| `agency status` | Displays real-time telemetry from the last run (Tokens, Cost, Tests). |
| `agency roster` | Lists all active agent souls currently inhabiting the desks. |
| `agency init` | Bootstraps the current directory for Agency governance. |

## 🌍 Environment & Portability

The Agency (V16.0) uses **Environment-Aware Pathing**.

- **`AGENCY_HOME`**: Define this environment variable to point to your `opencode/` directory if you are running it from outside the installation path.
- **Clean Sweep Protocol**: Formal benchmarks use `git reset --hard benchmark-baseline` at the start to ensure scientific isolation. In persistent mode, the final implementation remains in the workspace for review.

## 📊 Live Pulse Dashboard
All runs are streamed via Telegram with high-fidelity economics (Token/Cost tracking) and quality KPIs.

---
**Governance Status**: `V16.0-KPI-GATES`  
**Master Spec Compliance**: `V1.0 - V16.0`
