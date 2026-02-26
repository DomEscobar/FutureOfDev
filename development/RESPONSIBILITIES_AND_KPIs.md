# Developer Responsibilities & KPIs – With AI Augmentation

## Introduction

This document maps developer roles to their core responsibilities, key performance indicators (KPIs), and how AI coding assistants (OpenCode via Skills, MCP servers, or general LLM support) can help fulfill them more effectively.

---

## Backend Developer

### Core Responsibilities
1. Design and implement robust, scalable APIs and services
2. Ensure data integrity, security, and performance
3. Write automated tests (unit, integration, contract)
4. Maintain and operate services (on-call, incident response)
5. Optimize database queries and infrastructure costs
6. Review code and mentor junior engineers
7. Document APIs and architecture decisions

### Top KPIs & How AI Helps

#### KPI 1: Change Failure Rate (< 15%)
- **Definition:** % of deployments causing incidents
- **AI Augmentation:**
  - AI pre-deployment review: scan PRs for anti-patterns, missing tests, risky changes
  - Automated risk assessment: analyze changed files and assign risk score based on historical data
  - Generate rollback scripts automatically
  - Simulate deployment impact and suggest canary strategies
- **Tools/Skills:** `coding-agent` review, `security-scanner` MCP, `deployment-risk-assessor` skill

#### KPI 2: API Performance (p95 latency)
- **Definition:** Endpoint response times meet SLOs (e.g., p95 < 200ms)
- **AI Augmentation:**
  - Query optimization: suggest better indexes, query rewrites, caching
  - Code hotspot detection: identify N+1 problems, inefficient loops
  - Generate load test scripts (k6, Locust) for critical endpoints
  - Auto-tune configurations (connection pools, thread counts)
- **Tools/Skills:** `apm-insights` MCP, `query-optimizer` skill, `load-test-generator` skill

#### KPI 3: Test Coverage (Core logic > 90%)
- **Definition:** Automated tests catch regressions
- **AI Augmentation:**
  - Auto-generate unit tests from function signatures (edge cases, error conditions)
  - Create property-based test strategies (Hypothesis/fast-check)
  - Analyze coverage reports and suggest missing test scenarios
  - Generate mocks/test doubles for external services
- **Tools/Skills:** `coding-agent` test generation, `coverage-analyzer` MCP, `fixture-generator` skill

#### KPI 4: MTTR (Mean Time to Recovery)
- **Definition:** Average time to restore service after P1/P2 incident (< 30 min)
- **AI Augmentation:**
  - Auto-diagnose alerts: correlate logs, metrics, traces to suggest root cause
  - Generate runbooks: create step-by-step recovery guides per service
  - ChatOps assistance: suggest commands during incident (restart, scale, check deployments)
  - Draft post-incident reports from logs and chat
- **Tools/Skills:** `log-analyzer` MCP, `metrics-query` MCP, `incident-scribe` skill

#### KPI 5: Security Vulnerability Remediation
- **Definition:** Critical CVEs fixed within 7 days; High CVEs within 30 days
- **AI Augmentation:**
  - Explain CVE impact in plain language
  - Recommend specific version bumps or code patches
  - Generate security tests to verify mitigation
  - Triage SAST/DAST alerts (reduce false positives)
- **Tools/Skills:** `vulnerability-db` MCP, `patch-recommender` skill, `security-test-generator` skill

#### KPI 6: Code Review Turnaround
- **Definition:** Average time PR open → merge (< 24h) with thorough review
- **AI Augmentation:**
  - First-pass review: check style, obvious bugs, test presence, documentation
  - Summarize changes for reviewer context (what, why, how to test)
  - Suggest reviewers based on file ownership and expertise
  - Auto-approve trivial changes (docs, version bumps) via rules
- **Tools/Skills:** `coding-agent` as pre-reviewer, `pr-summarizer` skill, `reviewer-matching` skill

#### KPI 7: Documentation Completeness
- **Definition:** APIs and services well-documented; onboarding time minimized
- **AI Augmentation:**
  - Generate API docs from OpenAPI specs or code annotations
  - Detect code changes and suggest/auto-update docs
  - Answer internal questions via codebase chatbot (RAG)
  - Draft Architecture Decision Records (ADRs) from commits and discussions
- **Tools/Skills:** `codebase-search` MCP, `doc-generator` skill, `adr-drafter` skill

---

## Frontend Developer

### Core Responsibilities
1. Implement pixel-perfect, responsive UI from designs
2. Ensure accessibility compliance (WCAG 2.1 AA)
3. Optimize frontend performance (load time, interactivity)
4. Build reusable components and maintain design system
5. Write frontend tests (unit, integration, visual, E2E)
6. Integrate with backend APIs and manage client state
7. Support multiple browsers and devices

### Top KPIs & How AI Helps

#### KPI 1: Core Web Vitals
- **Targets:** LCP < 2.5s, FID/INI < 100ms, CLS < 0.1
- **AI Augmentation:**
  - Run Lighthouse on PRs and suggest specific fixes (compress images, defer JS, eliminate render-blocking resources)
  - Identify heavy dependencies and suggest lighter alternatives or code-splitting
  - Generate responsive image sets (WebP/AVIF) and proper `sizes` attributes
  - Extract and inline critical CSS
- **Tools/Skills:** `lighthouse-auditor` skill, `bundle-analyzer` skill, `image-optimizer` skill

#### KPI 2: Client-Side Error Rate (< 0.1% sessions)
- **Definition:** Stability of frontend code (uncaught exceptions per session)
- **AI Augmentation:**
  - Cluster and group errors; identify root cause from stack traces
  - Provide auto-fix suggestions (e.g., "undefined is not a function" → add optional chaining)
  - Generate defensive code: try-catch blocks, fallback UI, error boundaries
  - Predict error-prone areas based on code churn and complexity
- **Tools/Skills:** `error-tracking` MCP (Sentry/Bugsnag), `error-patch-generator` skill, `defensive-coding-assistant` skill

#### KPI 3: Test Coverage (Unit 70%+, E2E critical flows)
- **Definition:** Regression prevention for user-facing functionality
- **AI Augmentation:**
  - Generate unit tests for React/Vue components (props, state, edge cases)
  - Create Cypress/Playwright scripts from user stories or designs
  - Generate visual regression tests (Percy/Chromatic baselines)
  - Create test data factories (Factory Bot, fixtures)
- **Tools/Skills:** `component-test-generator` skill, `cypress-script-writer` skill, `storybook-auto-generator` skill

#### KPI 4: Accessibility Score (Lighthouse a11y > 90)
- **Definition:** WCAG 2.1 AA compliance
- **AI Augmentation:**
  - Run axe-core on PRs; list violations with code locations
  - Provide code snippets to fix each violation (aria-labels, color contrast, focus management)
  - Simulate keyboard navigation; report traps/focus issues
  - Suggest missing alt text, ARIA, heading hierarchy
- **Tools/Skills:** `axe-integration` skill, `a11y-fixer` skill, `accessibility-db` MCP

#### KPI 5: Design System Adoption (>80% of UI from shared components)
- **Definition:** Consistency, reusability, and reduced bundle size
- **AI Augmentation:**
  - Recommend existing design system components when building new UI
  - Auto-convert custom elements to design system tokens/components
  - Generate code from Figma designs using design system
  - Detect design drift (implemented UI vs. mockups)
- **Tools/Skills:** `figma-api` MCP, `design-to-code` skill, `design-system-enforcer` skill

#### KPI 6: Feature Adoption
- **Definition:** Users actually use shipped features (measured via analytics)
- **AI Augmentation:**
  - Suggest instrumentation events to track for new features
  - Summarize A/B test results and statistical significance
  - Analyze session recordings to find drop-off points
  - Generate hypotheses for follow-up experiments
- **Tools/Skills:** `analytics-query` MCP (Mixpanel/GA), `experiment-analyzer` skill, `session-recognition` skill

#### KPI 7: Bundle Size Control (no uncontrolled growth)
- **Definition:** Keep initial JS/CSS payload small; monitor growth
- **AI Augmentation:**
  - Analyze npm package impact (size, transitive deps via Bundlephobia)
  - Detect unused exports and dead code (tree-shaking opportunities)
  - Recommend code-split points (route-based, component-based)
  - Enforce bundle budgets in CI (fail if growth without approval)
- **Tools/Skills:** `dependency-analyzer` skill, `tree-shaking-detector` skill, `bundle-size-tracker` MCP

---

## Full-Stack / Generalist Developer

### Core Responsibilities
- End-to-end feature delivery (frontend + backend)
- Database schema design and migrations
- API design and integration
- DevOps/deployment (CI/CD, infrastructure as code)
- Cross-team collaboration and system thinking

### KPIs (Blend of Both Worlds)
- Feature lead time (design → production)
- Full-stack test coverage (frontend + API + DB)
- System uptime / error rate
- Feature adoption and business impact
- Codebase health (technical debt ratio, documentation)

### AI Augmentation
- **API contract generation:** Create OpenAPI specs from code or vice versa
- **Database migrations:** Write safe, reversible migration scripts
- **CI/CD pipelines:** Generate GitHub Actions/GitLab CI YAML for new services
- **Infrastructure as Code:** Write Terraform/CloudFormation for resources
- **End-to-end tests:** Create Playwright tests covering full user journey (UI → API → DB)

**Tools/Skills:** `api-spec-generator`, `migration-writer`, `iac-generator`, `fullstack-test-writer`

---

## Shared / Cross-Functional Metrics (All Roles)

- **Sprint Predictability:** (Completed / Committed) story points % (target 80–120%)
- **On-call Load Distribution:** Alerts/engineer; aim for fairness
- **Documentation Coverage:** % of public APIs/components with docs
- **Mentorship Activity:** PR reviews given, pairing sessions, onboarding help
- **Psychological Safety:** Team survey score ("I feel safe admitting mistakes")

---

## Implementation Guide

### 1. Start Small
Pick one role and one KPI. Build/configure the AI skill to address it. Integrate into CI. Measure baseline vs. post-AI impact.

### 2. Use Existing AI Infrastructure
- **OpenCode/Coding Agents:** For code generation, review, test writing
- **MCP Servers:** Expose APM, analytics, vulnerability DB, codebase search as queryable tools
- **Custom Skills:** Bundle role-specific assistants (e.g., `backend-test-generator`, `lighthouse-auditor`)

### 3. Automate in CI/CD
- Run AI checks on every PR (performance budgets, test coverage, security scans)
- Require AI pre-approval for merge (style, tests, docs)
- Fail builds on regression (Web Vitals drop, coverage decreases)

### 4. Monitor and Iterate
- Track AI suggestion acceptance rate
- Correlate AI usage with KPI improvements
- Refine prompts based on what delivers value
- Expand to other responsibilities gradually

---

## Quick Reference Table

| Responsibility | AI Tool / Skill | KPI Impact |
|----------------|-----------------|------------|
| Write tests | `coding-agent` test gen | Test coverage ↑ |
| Code review | AI pre-review bot | Change failure rate ↓ |
| Performance fix | Query optimizer | Latency ↓, MTTR ↓ |
| Incident response | Log analyzer MCP | MTTR ↓ |
| Accessibility | axe + fix suggestions | a11y score ↑ |
| Bundle size | Dependency analyzer | Load time ↓ |
| Documentation | Auto-doc generator | Doc coverage ↑ |
| Security patches | CVE fix suggester | Remediation time ↓ |
| Design system | Component recommender | Consistency ↑, bundle size ↓ |
| Analytics | Experiment analyzer | Feature adoption ↑ |

---

## Final Notes

- **Do not** tie individual compensation directly to these KPIs (gaming incentives).
- **Use for team improvement** and continuous engineering health.
- **Track trends**, not absolute numbers; normalize for service complexity.
- **Balance** quality vs. speed vs. cost; avoid optimizing one at others' expense.
- **Include qualitative feedback** from peers, product, customers alongside quantitative metrics.

---

*This document is part of the FutureOfDev repository. Version: 1.0 (2025-02-26)*
