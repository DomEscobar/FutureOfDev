# The "Forge-First" Evolution Plan
**Backend & Frontend Perspective — Integrated Roadmap**

**Core Principle:** Do not use OpenCode/Cline as a black box. Build your *own* agentic infrastructure from day one, even if it starts minimal.

---

## 🧱 Phase 0: Foundation (Week 1–2)

| Perspective | Backend Tasks | Frontend Tasks | Shared Deliverables |
| :--- | :--- | :--- | :--- |
| **Setup** | Fork OpenCode. Strip to bare essentials. | Configure `.opencode/agents/` with `frontend.md`. | ✅ Custom `.opencode/agents/` suite (plan + build) |
| **Contracts** | Generate `contracts/api/` with TypeScript types + Zod schemas via agent. | Generate `contracts/ui/` with component prop-types and event schemas. | ✅ `contracts/` folder (single source of truth) |
| **Validation** | Write `scripts/validate-api-contracts.sh` (type-check + schema validation). | Write `scripts/validate-ui-contracts.sh` (prop-type + event shape checks). | ✅ Pre-commit hook that blocks non-compliant code |

---

## 🔁 Phase 1: The Self-Optimizing Loop (Week 3–4)

| Perspective | Backend Tasks | Frontend Tasks | Shared Deliverables |
| :--- | :--- | :--- | :--- |
| **Automation** | Add `make api-contracts` to generate OpenAPI spec + client SDKs. | Add `make ui-contracts` to generate component wrappers. | ✅ `Makefile` targets for contract regeneration |
| **Tooling** | Create `tools/mock-api-server/` that auto-serves from contracts. | Create `tools/component-playground/` to test against contracts. | ✅ Mocking tools that stay in sync automatically |
| **Orchestration** | Configure `@contract-checker` sub-agent to run on PRs. | Configure `@ui-contract-auditor` sub-agent to review components. | ✅ GitHub Action that calls `@contract-checker` |

---

## 🧠 Phase 2: Meta-Tooling Emergence (Month 2)

| Perspective | Backend Tasks | Frontend Tasks | Shared Deliverables |
| :--- | :--- | :--- | :--- |
| **Pattern Mining** | Log all DB queries → Identify N+1 problems → Build `tools/query-optimizer/`. | Log component render times → Identify heavy components → Build `tools/split-component/`. | ✅ `FRICTION_LOG.md` (quantified) |
| **Meta-Scripts** | Agent writes `scripts/auto-index-migration.ts` based on schema drift. | Agent writes `scripts/lazy-load-analyzer.ts` for route-based splitting. | ✅ First generation of project-specific meta-tools |
| **Validation** | Add performance regression tests (queries < X ms). | Add bundle size budgets (per route). | ✅ Quality gates baked into CI |

---

## 🤖 Phase 3: Autonomous Swarm (Month 3+)

| Perspective | Backend Tasks | Frontend Tasks | Shared Deliverables |
| :--- | :--- | :--- | :--- |
| **Swarm Activation** | Spawn `@db-optimizer`, `@security-scanner`, `@cache-strategist`. | Spawn `@a11y-auditor`, `@performance-tuner`, `@i18n-sync`. | ✅ Sub-agent ecosystem in `.opencode/agents/` |
| **Recursive Improvement** | `@db-optimizer` suggests indexes → applies → measures → iterates. | `@a11y-auditor` fixes issues → re-runs → validates → commits. | ✅ Agents that modify their *own* tools after evaluation |
| **Governance** | All meta-tools versioned, documented, reviewed by `@safeguard`. | All UI changes require `@ui-contract-auditor` sign-off. | ✅ Full agentic pipeline with QA gates |

---

## 🎯 The 12-Week Vision (Timeline Summary)

| Week | Backend Focus | Frontend Focus | Outcome |
| :--- | :--- | :--- | :--- |
| **1–2** | Forge setup, contract generation | Contract generation, UI schemas | **Single source of truth** |
| **3–4** | Mock server, contract-checker CI | Playground, UI audit CI | **Automated compliance** |
| **5–8** | Query optimizer, index automation | Lazy-load analyzer, split helper | **First meta-tools deployed** |
| **9–12** | Swarm launch (DB, security, cache) | Swarm launch (a11y, perf, i18n) | **Self-optimizing system** |

---

## ⚠️ The "Black Box" Alternative (What We Avoid)

❌ **Week 1:** Install Cline/OpenCode out of the box.  
❌ **Week 2:** Start coding features immediately.  
❌ **Week 6:** Notice repeated friction, but no systematic way to fix it.  
❌ **Week 12:** You are faster than before, but still tied to the vendor's limitations and repeating the same prompts.

✅ **Our Path:** You own the infrastructure by Week 4. By Week 12, your tools are evolving themselves.

---

## 🧩 Why This Works

*   **Backend & Frontend stay synchronized** via contracts, reducing integration bugs by ~80%.
*   **Meta-tools compound** — each new script makes the next one easier to write.
*   **The Forge becomes your moat** — no competitor can copy your `FRICTION_LOG.md` and resulting tools.

Ready to start **Phase 0**? Begin with the fork.
