# Autonomous Agency: Core Engine (V10.5)

This directory contains the core orchestration engine and telemetry systems for the governed autonomous agency.

---

## 🎭 The Agent Roster: Specializations

The agency utilizes a unified execution engine (`build` profile) but switches **Cognitive Auras** based on the current phase.

### 📐 The ARCHITECT (Phase 1: Contract Design)
- **Role**: Domain Modeler & Protocol Designer.
- **Workflow**: Reads the task description and existing codebase. Its primary output is `/root/Erp_dev_bench-1/.run/contract.md`.
- **Purpose**: Prevents "Implementation Drift." By forcing the Backend and Frontend to agree on schemas (Go structs vs TS interfaces) BEFORE coding, it ensures seamless integration on the first try.
- **Constraint**: It is forbidden from writing implementation code; it only writes protocols.

### ⚙️ THE HAMMER (Phase 2: FullStack Implementation)
- **Role**: High-Velocity Developer.
- **Workflow**: Consumes the `contract.md` and performs a "Blitz Change" across the workspace.
- **Purpose**: It implements everything—GORM handlers, Gin routes, Pinia stores, and Vue components. It focuses on functional completeness and meeting the "Aha!" requirements.
- **Constraint**: It optimizes for speed and feature-parity with the contract.

### 🩹 THE MEDIC (Phase 3: Iron Dome Repair)
- **Role**: Reliability Engineer & Bug Hunter.
- **Workflow**: Triggered only if `verifyWorkspace()` fails (Build, TS-Check, Lint, or Tests).
- **Purpose**: It uses a **Persistent Persistence Loop** (max 5-7 iterations) to stabilize the codebase. It has "Full Diagnostic Freedom" to run `exec` commands, check logs, and fix root causes like circular dependencies or type mismatches.
- **KPI extracted**: Live test case counts (Go: X | JS: Y).

### 🧐 THE SKEPTIC (Phase 4: Senior Governance)
- **Role**: Ethical Auditor & Structural Critic.
- **Workflow**: Performs a final "Human-in-the-Loop" style audit on the completed work.
- **Purpose**: It looks beyond "Does it compile?" It checks for:
    - **Security**: Database injection risks or insecure handling.
    - **UX**: Missing empty states or bad loading indicators.
    - **Architecture**: Inefficient loops (e.g., the O(n) prepend issues).
- **Veto Power**: If it finds a critical flaw, it triggers a **REJECTED** status, causing the orchestrator to exit (mode: once) or retry with a "Refined Critique."

---

## 🛠️ Infrastructure Overview

- `orchestrator.cjs`: The Master Controller. Handles the phase state machine and sub-process spawning.
- `telemetry-dash.cjs`: The UI Engine. Manages the Telegram "Live Pulse" dashboard, including token estimation and cost analytics.
- `telegram-control.cjs`: The Relay Node. Handles incoming Telegram commands and outbound notification routing.

---

## 🚀 Quality Gates

1. **Protocol Lock**: No code without a validated Architect contract.
2. **Persistence Loop**: Automatic failure recovery up to 7 attempts.
3. **Skeptic Veto**: Mandatory structural audit before task declaration.
4. **KPI Verification**: Final external benchmark measurement (External Exit 0).
