# AI Impact Benchmark: Greenfield vs. Brownfield
**STAMP: RESEARCH DRAFT — 2026-02-19**
**QUESTION:** How does AI (OpenCode/Cline/Cursor) impact development velocity differently on greenfield vs. brownfield projects?

---

## 1. Definitions (Context)

| Term | What It Means | AI Interaction Profile |
| :--- | :--- | :--- |
| **Greenfield** | Brand new project. Zero legacy code. No existing architecture, tests, or conventions. | AI writes ~80% of initial scaffolding. Minimal context sensitivity. High "blank page" value. |
| **Brownfield** | Existing codebase with history, tech debt, established patterns, and legacy constraints. | AI excels at *context-aware refactoring* and *onboarding acceleration*. Constrained by existing decisions. |

---

## 2. Hypotheses (Pre-Benchmark)

### **H1: Greenfield Velocity Surge**
- **Claim:** AI provides **2-3× faster** initial project setup.
- **Reason:** No legacy constraints; AI can generate entire folder structures, configs, and initial features without review of existing code.
- **Metric:** Time from `git init` to first feature deployment.

### **H2: Brownfield Onboarding Acceleration**
- **Claim:** AI reduces **new dev onboarding time by 70%** on brownfield projects.
- **Reason:** AI can ingest the codebase and answer "how do I add X?" without needing human mentorship.
- **Metric:** Time to first PR on a mature codebase.

### **H3: Brownfield Refactoring Risk Reduction**
- **Claim:** AI-assisted large-scale refactors have **40% fewer regressions** than manual.
- **Reason:** AI can reason about ripple effects across the codebase when making changes.
- **Metric:** Bug count post-refactor (per 1000 LOC changed).

### **H4: Greenfield "Architecture Drift"**
- **Claim:** AI-generated greenfield projects show **higher architectural inconsistency** over time.
- **Reason:** Without human architectural guardrails, AI introduces *additive* patterns that lack cohesion.
- **Metric:** Number of competing patterns (e.g., 3 different logger implementations) after 6 months.

---

## 3. Benchmark Design

### **Experiment A: Greenfield Sprint (4 weeks)**
- **Task:** Build a new full-stack SaaS (auth, billing, CRUD, API).
- **Teams:**
  - **Control:** Human dev(s) only.
  - **Treatment:** Human + OpenCode (forge-first, agents build tools).
- **Metrics:**
  1. Total LOC written (by humans vs. AI).
  2. Time to MVP (core features working).
  3. Test coverage at completion.
  4. Architectural consistency score (judged by external reviewer).
  5. "Design system adherence" (if applicable).

### **Experiment B: Brownfield Onboarding (2 weeks)**
- **Task:** New dev joins existing 50k LOC codebase; must implement a medium-complexity feature.
- **Teams:**
  - **Control:** Human onboarding docs + human mentor.
  - **Treatment:** OpenCode with full codebase ingestion + `@onboarding-agent`.
- **Metrics:**
  1. Time to first successful build.
  2. Time to first PR merge.
  3. Number of questions asked to existing team.
  4. PR quality (bugs found by QA).

### **Experiment C: Brownfield Refactor (3 weeks)**
- **Task:** Migrate from REST to GraphQL across 10 services.
- **Teams:**
  - **Control:** Manual refactor with code reviews.
  - **Treatment:** OpenCode `@refactor-swarm` with sub-agents per service.
- **Metrics:**
  1. LOC changed per day.
  2. Breaking changes introduced (detected by consumer tests).
  3. Post-refactor bug count (first 2 weeks).
  4. Developer fatigue (self-reported).

---

## 4. Expected Outcomes

| Scenario | Expected AI Advantage | Caveats |
| :--- | :--- | :--- |
| **Greenfield** | **2.5× faster** to MVP. AI excels at blank slate. | Architecture drift likely unless `@architect` agent enforces patterns. |
| **Brownfield Onboarding** | **70% faster** to first PR. AI acts as instantaneous domain expert. | Requires high-quality codebase context ingestion (OpenCode's memory bank). |
| **Brownfield Refactor** | **1.8× faster** with **30% fewer regressions**. | Success depends on quality of existing test suite. Cannot refactor what isn't tested. |

---

## 5. The "Meta-Variable": Tooling Quality

**Critical Insight:** The benchmark results depend heavily on *which AI tool* and *how it's configured*:

| Tool | Greenfield Fit | Brownfield Fit | Why |
| :--- | :--- | :--- |
| **OpenCode (forge-first)** | Elite (custom agents enforce architecture) | **Elite++** (agents can read codebase & propose refactors) | Forge allows you to encode your architectural rules. |
| **Cline** | Strong (Memory Bank helps) | **Elite** (Memory Bank + visual transparency) | Best for developers who want to see and guide the AI. |
| **Cursor** | Strong (fast generation) | Medium (IDE lock-in limits agent distribution) | Hard fork penalty hurts brownfield team scaling. |
| **Copilot** | Medium (inline only) | Low (limited context window) | Not designed for project-scale reasoning. |

---

## 6. Proposed Benchmark Execution Plan

### **Week 1-2: Greenfield Sprint (Parallel)**
- Recruit 2 teams of 2 developers each (1 control + 1 treatment).
- Provide identical feature spec.
- Treatment uses OpenCode with `.opencode/agents/architect.md` that enforces module boundaries.
- Track all time spent, commits, and architectural reviews.

### **Week 3-4: Brownfield Onboarding (Sequential)**
- Use an existing open-source codebase (~50k LOC, e.g., a mature Next.js app).
- Bring in 4 new devs (2 control, 2 treatment).
- Control: 1 week of docs + 1 week of mentor time.
- Treatment: OpenCode with full codebase ingestion + `@codebase-explainer` agent.
- Measure time to first meaningful contribution.

### **Week 5-7: Brownfield Refactor (Parallel)**
- Pick a real refactor task (e.g., "Introduce feature flags across payment flow").
- Teams of 3 (1 senior + 2 mid-level).
- Control: Manual planning + PR reviews.
- Treatment: OpenCode `@refactor-orchestrator` that decomposes task, creates sub-agent swarm.
- Measure velocity and regression escape rate.

---

## 7. Success Criteria

- **Greenfield:** Treatment team reaches MVP **≥ 2× faster** with **≤ 10% lower test coverage** (acceptable trade-off).
- **Onboarding:** Treatment devs reach "independent contributor" status **≥ 50% faster**.
- **Refactor:** Treatment team achieves **≥ 30% reduction** in post-refactor bugs.

---

## 8. The "Self-Optimizing Loop" Angle

**Key Insight:** The benchmark itself can be **AI-augmented**:

1. Use OpenCode to **generate the experiment protocols** (this document).
2. Use an AI agent to **analyze the results** and write the final report.
3. The final report should include **meta-insights**: Which patterns emerged that even we didn't predict?

---

## 9. Recommendation for "Chef"

If you want to actually **run this benchmark**:

1. **Start with Experiment B (Onboarding)** — it's the fastest (2 weeks) and has the clearest signal.
2. **Use OpenCode in forge-first mode** — create an `@onboarding-agent` specifically for the experiment.
3. **Instrument everything:** Time tracking, commit analysis, chat logs (how many questions to mentors?).
4. **Publish results as a research report** in `/root/FutureOfDev/research/`.

**Want me to draft the full experimental protocol (team recruitment, scorecards, statistical significance)?** Or shall we start by **building the benchmark tools themselves** using the forge-first approach (i.e., OpenCode writes the experiment runner)? [[reply_to_current]]
