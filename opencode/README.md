# 🏛️ Agency Governed Roster (V12.2)

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
- **🩹 MEDIC**: Self-healing agent. Runs builds/tests and fixes errors in a "Ralph Wiggum Loop."
- **🧐 SKEPTIC**: The final gatekeeper. Audits the implementation against the master spec.

## 🛠️ Universal CLI Command Reference

| Command | Action |
|:---|:---|
| `agency run <task_id>` | Runs a formal benchmark (Resets workspace to baseline). |
| `agency run "<prompt>"` | **Ad-Hoc Mode**: Executes any natural language mission. |
| `agency status` | Displays real-time telemetry from the last run (Tokens, Cost, Tests). |
| `agency roster` | Lists all active agent souls currently inhabiting the desks. |
| `agency init` | Bootstraps the current directory for Agency governance. |

## 🌍 Environment & Portability

The Agency (V12.2) uses **Environment-Aware Pathing**. 

- **`AGENCY_HOME`**: Define this environment variable to point to your `opencode/` directory if you are running it from outside the installation path.
- **Clean Sweep Protocol**: Formal benchmarks use `git reset --hard benchmark-baseline` at the start to ensure scientific isolation. In persistent mode, the final implementation remains in the workspace for review.

## 📊 Live Pulse Dashboard
All runs are streamed via Telegram with high-fidelity economics (Token/Cost tracking) and quality KPIs.

---
**Governance Status**: `V12.2-UNIVERSAL`  
**Master Spec Compliance**: `V1.0 - V12.0`
