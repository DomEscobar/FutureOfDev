# OpenCode — Autonomous AI Agency (V4 "Pure Stream")

This agency is a strictly virtual, "God-Mode" AI development team that operates with zero local tools, using a intercepted STDOUT stream protocol to build fullstack applications.

## 🚀 System Architecture

- **Orchestrator (`orchestrator.js`)**: The "Brain." It manages the task queue, dispatches agents, and intercepts their output to perform disk operations via Proxy.
- **Proxy Protocol**: Agents write files using `@@@WRITE_FILE:path@@@\ncontent\n@@@END_WRITE@@@`. The orchestrator catches this in real-time.
- **Task Pipeline (The Hierarchical Flow)**:
  1. `pending` → `architecting` (**Dev-Architect** verifies blueprints).
  2. `architecting` → `planning` (**Project Manager** creates subtasks).
  3. `planning` → `implementation` (**Backend-Engineer** or **Frontend-Engineer**).
  4. `implementation` → `code_review` (**Code-Reviewer**).
  5. `code_review` → `testing` (**Test-Unit**).
  6. `testing` → `completed`.

## 🛡️ Hardened Safety Features

- **Architect-First Governance**: Every task must be audited against `ARCHITECTURE.md` and `CODE_OF_CONDUCT.md` before coding begins.
- **Specialized Implementation**: Credits are saved by sending specialized agents (🧱 Backend vs 🎨 Frontend) to their respective "Responsibility Zones."
- **Circuit Breaker**: Tasks failing verification > 2 times are `blocked`.
- **Drift-Proof State**: Dispatch keys use file `mtime` to prevent redundant runs.

## 🎭 Agent Personas (High-Signal Telemetry)

- **🚀 CEO**: Strategic planning.
- **🏛️ DEV-ARCHITECT**: Governance and AI-readability standards.
- **📋 PM (Project Manager)**: Atomic task breakdown.
- **🧱 BACKEND-ENGINEER**: Data safety, API contracts, and schema integrity.
- **🎨 FRONTEND-ENGINEER**: UX polish, state robustness, and modular components.
- **🧪 TEST-UNIT**: Automated unit/E2E testing.
- **⚖️ CODE-REVIEWER**: Logic validation and final sign-off.

## 🚦 Operational Status

1. **Self-Correction**: Every task is verified against a structural DoD (Definition of Done) before advancing.
2. **Persistence**: State is strictly tracked via `tasks.json` and `.run/context/`.
3. **Heartbeat**: A recursive, clock-validating loop evaluates the project state every 15 seconds.

---
_Built with zero-fluff, hyper-efficiency, and redundant safety protocols._
