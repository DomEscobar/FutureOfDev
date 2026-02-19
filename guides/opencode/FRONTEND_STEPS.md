# Frontend Implementation Steps (AI-Centric)
**Prompt Compost + Git Hook Guardian — Built by OpenCode Agents**

**Core Principle:** OpenCode writes the templates, CLI wrappers, and hooks. You only define *what* you want.

---

## 🚀 Phase 0: Forge Bootstrap (Day 1)

### Step 0.1: Create "Frontend Forge Builder" Agent
**File:** `.opencode/agents/frontend-forge-builder.md`
```yaml
description: Builds frontend meta-tools (templates, CLI, hooks) for this React/TS project
mode: subagent
tools:
  bash: true
  write: true
  read: true
permission:
  bash:
    "npm *": allow
    "git *": allow
prompt: |
  You are the Frontend Forge Builder. Your mission: eliminate repetitive prompting and commit noise.

  First task: Build a "Prompt Compost" system:

  1. TEMPLATE ENGINE:
     - Use Handlebars (mustache) syntax
     - Templates stored in `tools/prompt-compost/templates/`
     - At minimum: `component.hbs` (React component with loading/error states), `form-field.hbs` (Zod validation + Radix UI)

  2. CLI WRAPPER (`tools/prompt-compost/cli.js`):
     - Usage: `prompt-compost <type> <name> [options]`
     - Reads template, compiles with context, writes to `src/components/` or `src/forms/`
     - Auto-imports project's design system tokens

  3. GIT HOOK GUARDIAN:
     - Pre-commit hook `.git/hooks/pre-commit`
     - Runs: eslint --fix, prettier --write
     - Scans for console.log and removes them
     - Checks for hardcoded secrets (API_KEY, SECRET)
     - If issues found, auto-fixes and re-stages; else allows commit

  4. MAKE INTEGRATION:
     - Add `make generate-component TYPE NAME` that calls the CLI
     - Add `make pre-commit` that runs the guardian

  Write all files with documentation. Assume React + TypeScript + Radix UI.
```

---

## 🤖 Phase 1: AI Builds the Tools (Week 1)

### Step 1.1: Execute Forge Builder
```bash
opencode --agent frontend-forge-builder "Build Prompt Compost and Git Hook Guardian"
```

**What happens:** OpenCode generates:
- `tools/prompt-compost/templates/component.hbs`
- `tools/prompt-compost/templates/form-field.hbs`
- `tools/prompt-compost/cli.js`
- `.git/hooks/pre-commit`
- `Makefile` targets
- `README.md` for the toolset

### Step 1.2: Install & Test
```bash
npm link tools/prompt-compost/cli.js  # global install
prompt-compost component SubmitButton  # should generate src/components/SubmitButton.tsx
git commit -m "test"  # should run pre-commit guardian
```

**If issues:** Task the agent to iterate:
```bash
opencode --agent frontend-forge-builder "Fix: template uses wrong Radix import path"
```

---

## 🔍 Phase 2: AI Harvests Real Friction (Week 2)

### Step 2.1: Create "Frontend Friction Harvester" Agent
**File:** `.opencode/agents/frontend-friction-harvester.md`
```yaml
description: Finds frontend pain points by analyzing codebase and developer behavior
mode: subagent
tools:
  bash: true
  read: true
prompt: |
  You are the Frontend Friction Harvester.

  Tasks:
  1. Scan `src/` for repetitive patterns:
     - Components with same boilerplate (loading, error, empty states)
     - Form fields that duplicate validation logic
     - Repeated manual prop drilling
  2. Analyze git history: count times `console.log` was added then removed
  3. Check pre-commit failures: what % require manual intervention?
  4. Generate FRICTION_LOG.md with:
     - Pattern description
     - Frequency (files affected)
     - Time lost (estimate)
     - Suggested meta-tool to automate it

  Prioritize patterns that appear in > 3 files or cause > 30 min/week of rework.
```

### Step 2.2: Run Harvester
```bash
opencode --agent frontend-friction-harvester "Scan and log frontend frictions"
```

**Result:** `FRICTION_LOG.md` with entries like:
```
[HIGH] Button component boilerplate repeated in 12 files - 2 hours/week
[HIGH] Manual Zod schema duplication for forms - 1.5 hours/week
[MED] Missing aria-labels on custom controls - accessibility debt
```

---

## 🛠 Phase 3: AI Builds Next Meta-Tools (Week 3–4)

### Step 3.1: Task "Frontend Tool Smith"
**File:** `.opencode/agents/frontend-tool-smith.md`
```yaml
description: Builds one frontend meta-tool per iteration based on FRICTION_LOG.md priority
mode: subagent
tools:
  bash: true
  write: true
prompt: |
  You are the Frontend Tool Smith. Read FRICTION_LOG.md and build the #1 priority tool.

  For "Button boilerplate":
    - Create a `tools/button-generator/` that outputs a fully accessible, themed button
    - Include variants: primary, secondary, ghost, destructive
    - Auto-wire to design system tokens (CSS variables or Tailwind)
    - Add tests template

  For "Zod schema duplication":
    - Build `tools/zod-schema-gen/` that reads a Zod schema and generates form field scaffolding
    - Output: React Hook Form + Radix UI form with validation

  Deliver: CLI command + template + README. Write production-ready code.
```

Execute:
```bash
opencode --agent frontend-tool-smith "Build top priority tool from FRICTION_LOG.md"
```

### Step 3.2: Deploy as Sub-Agent
Once stable, wrap the tool as an autonomous agent:

**File:** `.opencode/agents/component-auditor.md`
```yaml
description: Audits new components for consistency with design system
mode: subagent
schedule:
  on: [pull_request]
tools:
  bash: true
  comment: true
prompt: |
  On each PR that touches src/components/:
  1. Check if new component follows the standard pattern (loading/error states, aria-*)
  2. If violations, comment with fixes
  3. If clean, approve
```

---

## 📊 Success Metrics (AI-Driven)

| Metric | Target | How to Measure |
| :--- | :--- | :--- |
| **Tools Built** | 2 per month | Count in `tools/frontend/` |
| **Prompt Reduction** | 80% fewer "create component" prompts | Compare friction log entries before/after |
| **Pre-commit Pass Rate** | 95% first try | CI stats |
| **Accessibility Score** | 100% of new components pass audit | Agent approvals |

---

## 🎯 The "Forge-First" Mindset (Frontend Edition)

**The AI is your co-founder of the toolchain.** You never manually write repetitive code again.

- Week 1: `frontend-forge-builder` writes Prompt Compost + Git Guardian.
- Week 2: `frontend-friction-harvester` discovers real pain.
- Week 3–4: `frontend-tool-smith` builds automation.
- Week 5+: Sub-agents enforce consistency and **self-improve**.

**No `MyButton.tsx` was ever written from scratch.** It was generated by a tool that was written by an AI.

**Start now:** Create `.opencode/agents/frontend-forge-builder.md` and run it. [[reply_to_current]]
