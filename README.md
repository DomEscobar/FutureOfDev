# Future of Dev: Agency Dashboard (V12.0)

**Governance Tier:** Master Spec V1 (Governed Multi-Agent OS)  
**Interface:** `agency` CLI (Global)  
**Host:** `v2202502215330313077`

---

## 🏛️ Agency CLI (`agency`)

The agency is now exposed as a first-class system command. You can trigger implementation, designs, or audits from anywhere in the terminal.

### 🕹️ Usage

#### Run a Benchmark (Formal Mode)
Executes a pre-defined task with clean-room resets and metric recording.
```bash
agency run bench-001
```

#### Run a Prompt (Ad-Hoc Mode)
Runs the full roster (Architect → Hammer → Medic → Skeptic) on a custom instruction.
```bash
agency run "Implement a dark mode toggle for the auth page"
```

#### Monitoring & Governance
```bash
agency status          # View real-time cost, tokens, and phase progress
agency roster          # List the specialized desks and their "Souls"
```

---

## 🏛️ Architecture: The Multi-Agent OS

The system utilizes a **Physical Desk Architecture** (`opencode/roster/`).

### 🧬 The Roster Roles
- **📐 ARCHITECT**: Translates prompts into hard `.run/contract.md` specs.
- **⚙️ THE HAMMER**: Blitz-builds the implementation (Go/Vue).
- **🩹 THE MEDIC**: Repairs build/lint failures via a persistence loop.
- **🧐 THE SKEPTIC**: Performs the final "Hard Veto" and records failure memory.

### 🔒 Core Controls
- **Clean-Room Purging**: Every role starts in a fresh process to prevent context rot.
- **MCP Keychain**: Roles are restricted to specific MCP tools (e.g., Hammer cannot search the web).
- **Institutional Memory**: Skeptic veteos are recorded in `VETO_LOG.json` to prevent recurring errors.

---

*V12.0: Moving from scripts to infrastructure.*
