# LangGraph Agency (Hybrid with opencode)

**LangGraph** drives the orchestration flow; **opencode** provides the roster (Architect, Hammer, Checker, Skeptic, Medic). Each graph node invokes opencode’s `dev-unit.cjs` with the appropriate role so you keep one set of SOULs and tooling.

## Flow

```
START → triage → architect → hammer → kpi_gate ─┬→ [pass] → checker → skeptic → medic → END
                                                └→ [fail] → hammer (retry, max 5) then checker
```

- **triage**: Brownfield discovery, project snapshot.
- **architect / hammer / checker / skeptic / medic**: Each runs `node opencode/dev-unit.cjs --role <role> --task <message>` in the workspace.
- **kpi_gate**: V16.0 Definition of DONE (red-test, green-test, contract.md). On failure, routes back to hammer up to `AGENCY_MAX_HAMMER_RETRIES` (default 5), then proceeds to checker.

## Setup

```bash
cd /root/FutureOfDev/langgraph-agency
npm install
```

## Run

```bash
# default task (benchmark-bench-002)
npm run run

# task by id (from opencode/tasks/<id>.json)
node src/orchestrator.js --task bench-001

# ad-hoc prompt (no task file)
node src/orchestrator.js "Add a login page with email and password"
node src/orchestrator.js "do this"
```

If the first positional argument (or the value after `--task`) contains spaces or does not match an existing task file, it is treated as the task description and the agency runs with an ad-hoc task.

## Config

- **AGENCY_HOME**: opencode root (default: `../opencode`).
- **WORKSPACE**: Target repo (default: `../Erp_dev_bench-1`).
- **AGENCY_MAX_HAMMER_RETRIES**: Max hammer retries when KPI fails (default: 5).
- **AGENCY_RECURSION_LIMIT**: LangGraph recursion limit (default: 50).
- **BENCHMARK_MODE**: Set to skip KPI gate.

## Other workspaces

To run the agency against a different repo (e.g. `/root/EmpoweredPixels`), set **WORKSPACE** when invoking. Tasks are still loaded from opencode/tasks; the working directory for agents and KPI checks is the workspace.

```bash
WORKSPACE=/root/EmpoweredPixels node src/orchestrator.js --task benchmark-bench-002
WORKSPACE=/root/EmpoweredPixels node scripts/run-all-tasks.js
```

No code change is required. For "reset → run task → check" step-by-step runs, the workspace must have a `benchmark/` folder with `runner.cjs` and reset logic (e.g. Erp_dev_bench-1), or use the script's no-reset mode (agency + checks only).

## Layout

- `src/orchestrator.js` – Builds the StateGraph, loads task, invokes graph.
- `src/state.js` – Agency state annotation for LangGraph.
- `src/nodes/agencyNodes.js` – Node implementations (triage, KPI gate, opencode invoker).
- `src/nodes/runOpencode.js` – Spawns `opencode/dev-unit.cjs` per role.
- `config.js` – Paths (opencode root, workspace, dashboard).

Telemetry is written to `opencode/.run/telemetry_state.json` (same as opencode). Each phase update is pushed to **Telegram** (same bot/chat as opencode): the first update sends a new message, later updates edit that message so you get a single live pulse.

- **Telegram config**: Read from `opencode/config.json` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). If missing, telemetry still writes to the dashboard file but no push is sent.
