# AI Impact Benchmark: Greenfield vs. Brownfield
**STAMP: RESEARCH DRAFT — 2026-02-19 (Updated with Experiment C)**
**QUESTION:** How does AI (OpenCode/Cline/Cursor) impact development velocity differently on greenfield vs. brownfield projects?

---

## 1. Definitions (Context)

| Term | What It Means | AI Interaction Profile |
| :--- | :--- | :--- |
| **Greenfield** | Brand new project. Zero legacy code. No existing architecture, tests, or conventions. | AI writes ~80% of initial scaffolding. Minimal context sensitivity. High "blank page" value. |
| **Brownfield (Refactor)** | Existing codebase with high coupling; large-scale change with ripple effects (e.g., REST → GraphQL across 10 services). | AI excels at *dependency-aware refactoring* and *sequential task orchestration*. Must respect existing contracts. |

---

## 2. Hypotheses (Pre-Benchmark)

### **H1: Greenfield Velocity Surge**
- **Claim:** AI provides **2-3× faster** initial project setup.
- **Reason:** No legacy constraints; AI can generate entire folder structures, configs, and initial features without review of existing code.
- **Metric:** Time from `git init` to first feature deployment.

### **H2: Brownfield Refactor Safety**
- **Claim:** AI-assisted large-scale refactors have **40% fewer breaking changes** and **50% fewer regression bugs** than manual.
- **Reason:** AI can reason about ripple effects across the codebase when making changes and migrate consumers automatically.
- **Metric:** Breaking changes introduced; regression bugs per 1000 LOC changed.

### **H3: Brownfield Refactor Velocity**
- **Claim:** AI-augmented refactor is **1.8× faster** than manual for multi-service migrations.
- **Reason:** Sub-agent orchestration allows parallel per-service migration with automatic dependency resolution.
- **Metric:** LOC changed per day (treatment vs. control).

### **H4: Greenfield "Architecture Drift"**
- **Claim:** AI-generated greenfield projects show **higher architectural inconsistency** over time.
- **Reason:** Without human architectural guardrails, AI introduces *additive* patterns that lack cohesion.
- **Metric:** Number of competing patterns (e.g., 3 different logger implementations) after 6 months.

---

## 3. Benchmark Design (Three Experiments)

### **Experiment A: Greenfield Sprint (4 weeks)**
- **Task:** Build a new full-stack SaaS (auth, billing, CRUD, API).
- **Teams:**
  - **Control:** Human dev(s) only.
  - **Treatment:** Human + OpenCode (forge-first, agents build tools).
- **Metrics:**
  1. Time to MVP (core features working).
  2. Velocity (LOC/hour).
  3. Test coverage at completion.
  4. Architectural consistency score (judged by external reviewer).
  5. Design system adherence.

### **Experiment B: Brownfield Onboarding (2 weeks) — SKIPPED**
- We are focusing on **Experiment C** instead, as refactor has higher enterprise ROI.

### **Experiment C: Brownfield Refactor (3 weeks)**
- **Task:** Migrate 10 services from REST → GraphQL (or any large-scale refactor with high coupling).
- **Teams:**
  - **Control:** Manual refactor with code reviews; senior architect plans migration order.
  - **Treatment:** OpenCode `@refactor-orchestrator` swarm; per-service `@service-migrator` agents; automatic consumer updates.
- **Metrics:**
  1. **Breaking Changes Introduced** (OpenAPI diff).
  2. **Ripple Effect Coverage** (% of dependent services automatically updated).
  3. **Refactor Velocity** (LOC changed per day).
  4. **Regression Escape Rate** (bugs found in staging/production within 2 weeks post-refactor per 1000 LOC).
  5. **Test Pass Rate During Refactor** (should stay ≥ 90%).
  6. **Manual Intervention Hours** (senior dev time spent guiding/ reviewing).

---

## 4. Expected Outcomes

| Scenario | Expected AI Advantage | Caveats |
| :--- | :--- | :--- |
| **Greenfield** | **2.5× faster** to MVP. AI excels at blank slate. | Architecture drift likely unless `@architect` agent enforces patterns. |
| **Brownfield Refactor** | **1.8× faster** with **50% fewer breaking changes** and **40% fewer regressions**. | Success depends on quality of existing test suite; cannot refactor what isn't tested. |

---

## 5. The "Meta-Variable": Tooling Quality

**Critical Insight:** The benchmark results depend heavily on *which AI tool* and *how it's configured*:

| Tool | Greenfield Fit | Brownfield Refactor Fit | Why |
| :--- | :--- | :--- | :--- |
| **OpenCode (forge-first)** | Elite (custom agents enforce architecture) | **Elite++** (orchestrator swarm + dependency graph reasoning) | Forge allows you to encode your refactor patterns and safety checks. |
| **Cline** | Strong (Memory Bank helps) | Strong (Memory Bank tracks ripple effects) | Visual trace helps monitor complex multi-service changes. |
| **Cursor** | Strong (fast generation) | Medium (IDE lock-in limits swarm distribution) | Hard fork penalty hurts team coordination for large refactors. |
| **Copilot** | Medium (inline only) | Low (limited context window) | Not designed for project-scale reasoning or multi-file orchestration. |

---

## 6. Proposed Benchmark Execution Plan

### **Week 1-2: Greenfield Sprint (Parallel)**
- Recruit 2 teams of 2 developers each (1 control + 1 treatment).
- Provide identical feature spec.
- Treatment uses OpenCode with `.opencode/agents/architect.md` that enforces module boundaries.
- Track all time spent, commits, and architectural reviews.

### **Week 3-5: Brownfield Refactor (Parallel)**
- **Setup:** Use an existing microservices codebase (~10 services, ~50k LOC total, with REST APIs).
- Teams of 3 (1 senior + 2 mid-level).
- **Control:** Manual planning + PR reviews; senior decides migration order.
- **Treatment:** OpenCode `@refactor-orchestrator` that:
  1. Builds dependency graph.
  2. Spawns `@service-migrator` agents per service (leaf first).
  3. Auto-updates consumers.
  4. Calls `@breaking-change-detector` after each migration.
- **Metrics:** Automated via `tools/benchmark/refactor.js` runner.

---

## 7. Success Criteria

- **Greenfield:** Treatment team reaches MVP **≥ 2× faster** with **≤ 10% lower test coverage** (acceptable trade-off).
- **Refactor:** Treatment team achieves **≥ 1.8× velocity** with **≤ 50% of the breaking changes** and **≤ 60% of the regression bugs** compared to control.
- **Overall:** Treatment reports **≤ 5/10 fatigue** vs. Control **≥ 7/10**.

---

## 8. The "Self-Optimizing Loop" Angle

The benchmark itself will be **AI-augmented**:
- Use OpenCode to **generate the experimental protocols** (this document).
- Use `@report-compiler` agent to **analyze results** and write the final report.
- The final report should identify **emergent patterns** that weren't in the hypotheses (e.g., "AI discovered a more optimal migration order than humans").

---

## 9. Toolkit Provided

See `tools/benchmark/` and `guides/opencode/BENCHMARK_AGENTS.md` for:
- **Runners:** `greenfield.js`, `refactor.js` (synthetic simulation + real execution modes).
- **Core orchestrator:** `runner.js` (supports both experiment types).
- **Agents:** `@benchmark-director`, `@data-collector`, `@fatigue-monitor`, `@quality-auditor`, `@report-compiler`, plus refactor-specific `@refactor-orchestrator`, `@service-migrator`, `@breaking-change-detector`.
- **Optional:** `@langfuse-collector` for agent telemetry if you have Langfuse deployed.

---

## 10. Recommendation

**Run both experiments in sequence:**
1. **Greenfield (Weeks 1-2)** — quick signal on blank-slate velocity.
2. **Refactor (Weeks 3-5)** — high-stakes, high-ROI test of ripple reasoning.

**Start with:** `opencode --agent benchmark-director "Start experiment A (greenfield)"`

**Then:** `opencode --agent benchmark-director "Start experiment C (refactor)"`

---

**STAMP: TOOLKIT READY — AWAITING EXECUTION** [[reply_to_current]]
