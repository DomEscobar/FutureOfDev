# Future of Dev: Agency Dashboard (V11.0)

**Governance Tier:** Master Spec V1 (Governed Multi-Agent OS)  
**Host:** `v2202502215330313077`

---

## 🏛️ Architecture: The Multi-Agent Operating System

Version 11.0 shifts from "one-bot-many-modes" to a **Physical Desk Architecture**. Each agent role is a specialized, jailable persona with restricted toolsets and its own digital "Soul."

### 🧬 The Core Roster (Specialized Desks)

Each agent operates from a private directory (`roster/{role}/`) containing its identity and constraints.

#### 1. 📐 The ARCHITECT (`roster/architect/`)
*   **Persona**: The System Designer. Clinical, precise, and authoritative.
*   **Mission**: Translates requirements into a strict `.run/contract.md`.
*   **Tools**: Restricted to `read`, `web_search`, and `github-mcp`.
*   **Constraint**: Forbidden from writing implementation code. It designs the "Law."

#### 2. ⚙️ THE HAMMER (`roster/hammer/`)
*   **Persona**: The Blitz Builder. High-velocity, full-stack implementation engine.
*   **Mission**: Consumes the contract and builds the entire feature (Backend + Frontend) in a single blitz.
*   **Tools**: `write`, `edit`, `exec`.
*   **Constraint**: Loyal to the contract. If the design is flawed, it implements and flags it for the Medic.

#### 3. 🩹 THE MEDIC (`roster/medic/`)
*   **Persona**: The Reliability Engineer. Forensic and methodical.
*   **Mission**: Owns the persistence loop. Fixes build failures, type mismatches, and circular dependencies.
*   **Tools**: Specialized MCPs for `lsp-query` and error trace analysis.
*   **Constraint**: Fixing only. Must clear all quality gates (Lint/Go-Build/Vitest).

#### 4. 🧐 THE SKEPTIC (`roster/skeptic/`)
*   **Persona**: The Senior Auditor. Abrasive and objective.
*   **Mission**: Performs a final "Hard Veto" audit.
*   **Tools**: Visual MCPs (`canvas`, `screenshot`) and security scanners.
*   **Veto Logic**: Writes rejections to `shared/VETO_LOG.json`, creating institutional memory.

---

## 🔒 Governance Mechanisms

### 🧹 Zero-Context-Rot (Clean Room Spawning)
To prevent "Context Bleeding" (where planning thoughts interfere with implementation), the orchestrator **kills the worker process** between every phase. Every agent starts with a 100% fresh cognitive state, reading only the necessary handovers.

### 🧠 Institutional Memory
The **VETO_LOG** ensures the agency learns. If the Skeptic rejects a pattern (e.g., "O(n) search logic"), the Architect is forced to read that rejection at the start of the next run, preventing recurring architectural debt.

### 💰 Physical Telemetry
Real-time cost tracking is aggregated across all separate agent processes, offering a high-fidelity "Financial Pulse" in the Telegram dashboard.

---

## 🚀 Operations

### Execute a Governed Benchmark
```bash
# Handled via the master runner
cd /root/Erp_dev_bench-1/benchmark
node runner.cjs run tasks/bench-001.json
```

### Visual Monitoring
- **Live Pulse**: Self-updating Telegram message with role-specific "Auras."
- **Audit Logs**: `tail -f opencode/.run/orchestrator.log`

---

*This agency prioritizes structural integrity over speed. Every line of code must be justified by a contract and survived by a skeptic.*
