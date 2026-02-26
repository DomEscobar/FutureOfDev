# AI Bot Developer Workflow: Ensuring KPI Compliance Before PR

## Introduction

This document defines how an AI coding assistant (OpenCode, coding-agent, or similar) should operate as a **responsible developer agent** that proactively ensures its code meets role-specific KPIs before submitting a pull request.

The principle: **The AI bot is not just a code generator—it's a quality gatekeeper that validates its own work against defined responsibilities and metrics.**

---

## Overview: The 7-Phase Workflow

```
1. Planning      → Identify KPIs, query baselines, define success criteria
2. Coding        → Write code with KPI constraints in mind
3. Self-Validate → Run static analysis, tests, performance checks
4. Pre-PR Check  → Comprehensive checklist, auto-fix failures
5. PR Generation → Create rich PR description with KPI impact
6. CI Gate       → Automated re-verification (honesty check)
7. Post-Merge    → Learn from outcomes, improve future prompts
```

---

## Phase 1: Planning – KPI-Aware Requirements Analysis

When tasked with a feature/bugfix, the AI must:

### Step 1.1: Parse the requirements
- Identify what type of change: backend API, frontend component, full-stack feature, database migration, etc.
- Determine which KPIs are relevant:
  - **Backend**: API performance, test coverage, security, change failure rate, MTTR
  - **Frontend**: Core Web Vitals, accessibility, bundle size, test coverage, design system adoption
  - **Full-stack**: End-to-end test coverage, feature lead time, system uptime

### Step 1.2: Query current baseline metrics (via MCP)
Before coding, fetch current state to understand what "good" looks like:

```python
# Backend API change example
current_p95 = apm.query("service:orders endpoint:/api/orders metric:latency percentile:p95 days:7")
current_coverage = coverage.get("services/orders", "main")
current_error_rate = apm.query("service:orders metric:error_rate days:1")

# Frontend change example
lcp = web_vitals.query("page:/checkout metric:LCP days:7")
a11y_violations = axe.scan_page("/checkout")
bundle_size = bundle_tracker.get("main-app", "gzipped")
accessibility_score = lighthouse.query("/checkout", "accessibility")
```

### Step 1.3: Define success criteria for this PR
Based on baselines and KPI targets, set explicit thresholds:

- "p95 latency must not increase by more than 10% (from 120ms → ≤ 132ms)"
- "Test coverage on modified files must be ≥ 80% (currently 87%)"
- "Bundle size increase must be ≤ 10KB gzipped (currently 245KB)"
- "Zero new accessibility violations (currently 0)"
- "No new critical/high security vulnerabilities"
- "Error rate in load test < 0.1%"

### Step 1.4: Select appropriate AI skills/tools
Map the task to specialized skills:
- Performance optimization → `query-optimizer`, `load-test-generator`
- Frontend UI → `lighthouse-auditor`, `a11y-fixer`, `bundle-analyzer`
- Testing → `unit-test-generator`, `e2e-test-writer`, `property-test-strategy`
- Security → `cve-scanner`, `sast-analyzer`
- Documentation → `api-doc-generator`, `adr-drafter`

---

## Phase 2: Coding – KPI-Constrained Implementation

The AI must keep KPI targets in mind while writing code.

### Backend Coding Rules
- **Performance**: Avoid N+1 queries, add proper indexes, use pagination, cache appropriately, limit response sizes
- **Security**: Validate inputs, use parameterized queries, escape outputs, implement auth checks, avoid hardcoded secrets
- **Reliability**: Add timeouts, retries with backoff, circuit breakers, proper error handling
- **Observability**: Log key events with structured JSON, add metrics (counters, histograms), include trace IDs
- **Testability**: Write pure functions where possible, inject dependencies, avoid global state

### Frontend Coding Rules
- **Performance**: Code-split routes, lazy-load components, optimize images (WebP/AVIF), defer non-critical JS, use `loading="lazy"`
- **Accessibility**: Semantic HTML, proper ARIA labels, focus management, keyboard navigation, color contrast ≥ 4.5:1
- **Bundle size**: Use design system components, tree-shakeable imports, avoid large dependencies, analyze bundle impact
- **Responsiveness**: Mobile-first CSS, fluid layouts, test on multiple viewports
- **Error handling**: Error boundaries, fallback UI, user-friendly messages

### Full-Stack Rules
- **API contracts**: Version endpoints, maintain backward compatibility, use OpenAPI specs
- **Data migrations**: Write reversible migrations, test both upgrade and downgrade
- **Feature flags**: Gradual rollout with flags, add instrumentation
- **End-to-end testing**: Cover full user journey (UI → API → DB)

---

## Phase 3: Self-Validation – Automated Quality Checks

After writing code, the AI must run a comprehensive self-validation suite **before** even considering a PR.

### 3.1 Static Analysis
```bash
# Linting
npm run lint  # or flake8, rubocop, etc.
# Must pass with 0 errors

# Type checking
npx tsc --noEmit  # TypeScript
mypy src/  # Python
# Must pass with 0 errors

# Complexity
radon cc src/  # Python cyclomatic complexity
eslint --rule 'complexity: ["error", 10]'
# All functions complexity < threshold
```

### 3.2 Security Scanning
```bash
# SAST (Static Application Security Testing)
semgrep --config=auto
trivy fs --severity HIGH,CRITICAL .
snyk test

# Secrets scanning
truffleHog --regex --entropy=False
git-secrets --scan

# Must have 0 new critical/high vulnerabilities or secrets
```

### 3.3 Test Generation & Coverage
The AI must **generate tests for its own code** and ensure coverage targets are met.

```bash
# Unit tests (AI generates these)
npm test -- --coverage

# Check coverage thresholds
# Backend: core logic ≥ 90%, overall ≥ 70%
# Frontend: components ≥ 80%, utilities ≥ 90%
# Full-stack: API endpoints ≥ 80%, UI components ≥ 70%

# If coverage below target, AI must generate additional tests
```

**AI test generation guidelines:**
- Cover happy path, edge cases, error conditions
- Use realistic test data (factories/fixtures)
- Mock external services (HTTP, DB, queues)
- For frontend: test user interactions (clicks, inputs), state changes, prop validation
- For backend: test validation logic, error handling, database operations

### 3.4 Integration Tests
For API/services, generate integration tests that test real dependencies (or realistic mocks):

```bash
npm run test:integration
# Must include:
# - Database operations (CRUD)
# - External API calls (with VCR or WireMock)
# - Message queue interactions
# - Authentication/authorization flows
```

### 3.5 End-to-End Tests (Critical Flows)
For user-facing changes, generate Playwright/Cypress tests:

```bash
npx playwright test
# Must cover:
# - Login flow (if auth-related)
# - Main user journey affected by change
# - Error states and recovery
```

### 3.6 Performance Simulation

#### Backend Performance Check
```bash
# Run load test against local/dev environment
k6 run --vus 100 --duration 30s load/orders_load_test.js

# Capture metrics:
# - p50, p95, p99 latency
# - Error rate
# - Throughput (RPS)
# - Resource usage (CPU, memory)

# Compare to baseline:
# - Latency increase < 10%?
# - Error rate < 0.1%?
# - No memory leaks detected?
```

#### Frontend Performance Check
```bash
# Build and analyze
npm run build
npx lighthouse-ci http://localhost:3000 --perf=90 --a11y=90 --seo=90

# Bundle analysis
npx webpack-bundle-analyzer dist/stats.json
# - Total JS size increase < budget (e.g., 10KB)
# - No new large dependencies (>10KB gzipped)
# - Code splitting effective

# Web Vitals in lab
npx web-vitals --print=all
# - LCP < 2.5s, FID/INI < 100ms, CLS < 0.1
```

### 3.7 Accessibility Audit (Frontend)
```bash
# Run axe-core in CI mode
npx playwright-test --project=axe

# Must have 0 violations (critical/serious)
# Moderate violations may be allowed with justification, but AI should fix them anyway

# Additional checks:
# - Keyboard navigation works
# - Focus states visible
# - Color contrast meets AA standards
# - Form labels associated correctly
```

### 3.8 Golden Dataset Regression (If Applicable)
If the project maintains a golden dataset of expected behaviors:

```bash
python tests/golden/run.py \
  --dataset tests/golden/v1.2.jsonl \
  --new-output ai_output.jsonl \
  --threshold 0.95  # 95% similarity required

# Must pass all golden cases (no regressions)
# If any case fails, AI must investigate and fix before proceeding
```

### 3.9 Database Migration Validation
For schema changes:
```bash
# Test migration forward and backward
alembic upgrade head
# Verify: data integrity, constraints, indexes

alembic downgrade -1
# Verify: rollback successful, no data loss

# Migration must be:
# - Reversible (or explicitly irreversible with justification)
# - Zero-downtime (use online schema change techniques if needed)
# - Backward compatible (old code works with new schema or vice versa)
```

### 3.10 API Contract Validation
If OpenAPI/Swagger specs exist:
```bash
# Ensure implementation matches spec
spectral lint openapi.yaml
# Generate tests from spec
dredd api.yaml http://localhost:3000
# Must pass all endpoint tests
```

---

## Phase 4: Pre-PR Self-Review Checklist

The AI must complete this checklist and **fail locally** if any item is not satisfied.

### Backend PR Checklist (AI Self-Sign-Off)

- [ ] **Tests**: All new functions have unit tests with ≥ 80% coverage on modified lines
- [ ] **Integration**: All new/changed API endpoints have integration tests (HTTP status, response schema, error cases)
- [ ] **E2E**: If user-facing, critical flows covered by E2E tests
- [ ] **Lint/Type**: 0 linting errors, 0 type errors
- [ ] **Security**: 0 new SAST vulnerabilities (critical/high), no secrets in code
- [ ] **Performance**: Simulated load test shows p95 latency increase < 10%, error rate < 0.1%
- [ ] **Database**: Migrations are reversible, include rollback scripts, tested
- [ ] **Documentation**: API docs updated (OpenAPI/Swagger/README), ADR created if architectural change
- [ ] **Observability**: Logs structured, metrics added, traces propagated
- [ ] **Breaking changes**: Version bump or deprecation notice included
- [ ] **Feature flag**: Gradual rollout flag added if needed
- [ ] **Golden dataset**: No regressions (all existing golden cases pass)
- [ ] **Rollback plan**: Documented and tested (CLI commands, DB rollback, feature flag disable)

### Frontend PR Checklist (AI Self-Sign-Off)

- [ ] **Unit tests**: All new components have RTL tests covering props, state, user events → ≥ 80% coverage
- [ ] **E2E tests**: Critical user flows covered by Cypress/Playwright
- [ ] **Lighthouse**: Performance > 90, Accessibility > 90, Best Practices > 90, SEO > 90 (or no regression if already above)
- [ ] **Console errors**: 0 new uncaught exceptions or console errors
- [ ] **Bundle size**: Total JS increase ≤ budget (e.g., 10KB gzipped), no new large deps
- [ ] **Images**: All images optimized (WebP/AVIF fallbacks, `loading="lazy"`, proper `sizes`)
- [ ] **Accessibility**: Axe-core scan: 0 violations (critical/serious), keyboard navigation tested
- [ ] **Design system**: Used DS components where applicable; tokens for colors/spacing
- [ ] **Responsive**: Tested on mobile/tablet/desktop breakpoints
- [ ] **Visual regression**: Storybook/Percy baseline updated if appearance changed
- [ ] **TypeScript**: 0 type errors, strict mode enabled
- [ ] **Analytics**: Instrumentation events added for new feature (if applicable)

### Full-Stack PR Checklist (AI Self-Sign-Off)

- [ ] **All backend checks** (from above)
- [ ] **All frontend checks** (from above)
- [ ] **Integration tests**: API + DB + frontend integration tests pass
- [ ] **Cross-compatibility**: Old frontend works with new API (or new frontend works with old API) during gradual rollout
- [ ] **Feature flag**: Implemented and tested (on/off)
- [ ] **End-to-end**: Full user journey tested (UI → API → DB → UI)
- [ ] **Monitoring**: Logs, metrics, traces added to track feature usage and errors
- [ ] **Post-deploy verification**: Script to validate deployment success (health checks, smoke tests)

---

## Phase 5: PR Generation – AI-Crafted Pull Request

The AI must generate a comprehensive PR description with KPI metrics clearly displayed.

### PR Template (Auto-Filled by AI)

```markdown
## What
[Clear description of changes, generated by AI from git diff and commit messages]

## Why
[Business/technical rationale, linked to requirements]

## Changes Summary
- Files changed: X added, Y modified, Z deleted
- Lines added: N, Lines removed: M
- [Link to Jira ticket, Figma design, ADR]

## How to Test
### Unit Tests
```bash
npm test -- --testPathPattern=orders
pytest tests/services/order_service.py
```

### Integration Tests
```bash
npm run test:integration -- --tag=orders
pytest tests/integration/test_orders_api.py
```

### E2E Tests
```bash
npx cypress run --spec cypress/e2e/order-flow.cy.ts
npx playwright test e2e/checkout.spec.ts
```

### Performance Test
```bash
k6 run --out json=perf.json load/orders_load_test.js
# Baseline (last 7d): p95=120ms, error_rate=0.05%
# Expected: p95 < 132ms, error_rate < 0.1%
```

### Manual QA Steps
1. Go to /orders page
2. Click "Create Order" button
3. Verify modal appears with form
4. Submit form with valid data
5. Check order appears in list
6. [Screenshot after]

## KPI Impact

### Backend Metrics
| Metric | Current | After Change | Target | Status |
|--------|---------|--------------|--------|--------|
| Test Coverage (orders service) | 87% | 92% | ≥ 80% | ✅ |
| p95 Latency (last 7d) | 120ms | 128ms (simulated) | < 132ms (+10%) | ✅ |
| Error Rate (simulated load) | 0.05% | 0.08% | < 0.1% | ✅ |
| Security Vulnerabilities | 0 critical/high | 0 | 0 | ✅ |
| API Documentation Coverage | 95% | 98% | 100% | ⚠️ (partial) |

### Frontend Metrics
| Metric | Current | After Change | Target | Status |
|--------|---------|--------------|--------|--------|
| Lighthouse Accessibility | 94 | 96 | > 90 | ✅ |
| Lighthouse Performance | 92 | 91 | > 90 | ✅ |
| Bundle Size (gzipped) | 245 KB | 252 KB (+7KB) | +10KB budget | ✅ |
| Component Test Coverage | 88% | 85% | ≥ 70% | ✅ |
| Accessibility Violations (axe) | 0 | 0 | 0 | ✅ |

### Golden Dataset Regression
- Total cases: 42
- Passed: 42 (100%)
- Failures: 0
- Status: ✅

## Rollback Plan
- **Database**: `alembic downgrade -1` (migration V0015 reversible)
- **API**: `kubectl rollout undo deployment/orders-service` (previous tag: v1.14.2)
- **Feature Flag**: Disable `new-orders-ui` in LaunchDarkly
- **Frontend**: `git revert <commit-hash>` (previous deployment tag: frontend-v2.33.1)

## Checklist
- [x] Self-validated: all checks passed locally
- [x] Unit tests added/updated
- [x] Integration tests added/updated
- [x] E2E tests added/updated
- [x] Performance simulated: within threshold
- [x] Security scan: 0 critical/high
- [x] Accessibility audit: 0 violations
- [x] Bundle size: within budget
- [x] Documentation updated
- [x] Golden dataset: passed
- [x] Rollback plan documented and tested

## Labels (auto-generated)
- `performance-sensitive`
- `security-reviewed`
- `a11y-improved`
- `test-coverage-increased`
- `feature-flag-required`

## Notes
- This change introduces rate limiting on `/api/chat` to prevent abuse.
- Monitoring: new metrics `rate_limit_remaining`, `rate_limit_limited_total` added.
- Post-deploy: verify rate limiting metrics in Datadog dashboard [link].
```

---

## Phase 6: CI/CD Integration – The Honesty Check

Even though the AI self-validated, the CI pipeline must **re-run all checks** to ensure honesty and catch environment-specific issues.

### Sample GitHub Actions Workflow

```yaml
name: AI PR Validation Pipeline

on:
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  PYTHON_VERSION: '3.11'

jobs:
  # Job 1: Static Analysis & Security
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type check
        run: npm run type-check
      - name: Security scan (Semgrep)
        run: semgrep --config=auto --error
      - name: Secrets scan (TruffleHog)
        run: trufflehog git --regex --entropy=False --fail

  # Job 2: Tests & Coverage
  tests:
    runs-on: ubuntu-latest
    needs: static-analysis
    steps:
      - uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      - name: Install dependencies
        run: |
          npm ci
          pip install -r requirements.txt
      - name: Unit tests with coverage
        run: |
          npm test -- --coverage --ci
          pytest --cov=src --cov-report=xml
      - name: Enforce coverage thresholds
        run: |
          COV=$(grep -oP 'All files[^0-9]*\K[0-9.]+' coverage/summary.txt)
          if (( $(echo "$COV < 80" | bc -l) )); then
            echo "Coverage $COV% below 80% threshold"
            exit 1
          fi
      - name: Integration tests
        run: |
          npm run test:integration
          pytest tests/integration/
      - name: E2E tests
        run: npx playwright test --project=chromium
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4

  # Job 3: Performance & Bundle
  performance:
    runs-on: ubuntu-latest
    needs: tests
    steps:
      - uses: actions/checkout@v4
      - name: Build application
        run: |
          npm run build
      - name: Bundle size check
        run: npx bundlesize
      - name: Lighthouse CI
        run: |
          npm run build
          npx lighthouse-ci http://localhost:3000 \
            --perf=90 --a11y=90 --seo=90 --best-practices=90
      - name: Performance regression test
        run: |
          k6 run --out json=perf.json load/orders_load_test.js
          python scripts/check_perf_regression.py perf.json baseline.json
      - name: Upload Lighthouse results
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-report
          path: .lighthouseci

  # Job 4: Accessibility & Golden Dataset
  quality:
    runs-on: ubuntu-latest
    needs: tests
    steps:
      - uses: actions/checkout@v4
      - name: Accessibility audit with axe
        run: npx playwright-test --project=axe || true  # Don't fail yet, we'll parse
      - name: Check for new violations
        run: |
          VIOLATIONS=$(npx axe --exit)
          if [ -n "$VIOLATIONS" ]; then
            echo "❌ New accessibility violations found:"
            echo "$VIOLATIONS"
            exit 1
          fi
      - name: Golden dataset regression
        run: |
          python tests/golden/run.py \
            --dataset tests/golden/v1.2.jsonl \
            --new-output ai_output.jsonl \
            --threshold 0.95
        # Fails if similarity < 0.95

  # Job 5: Database Migrations (if applicable)
  database:
    runs-on: ubuntu-latest
    needs: tests
    if: contains(github.event.head_commit.message, 'migration') || contains(github.event.pull_request.labels.*.name, 'database')
    steps:
      - uses: actions/checkout@v4
      - name: Setup database
        run: docker-compose up -d postgres
      - name: Test migration forward
        run: |
          alembic upgrade head
          pytest tests/migrations/test_forward.py
      - name: Test migration backward
        run: |
          alembic downgrade -1
          pytest tests/migrations/test_backward.py

  # Job 6: PR Comment with Metrics
  comment:
    runs-on: ubuntu-latest
    needs: [static-analysis, tests, performance, quality, database]
    steps:
      - uses: actions/checkout@v4
      - name: Generate PR comment
        run: python scripts/generate_pr_comment.py \
          --pr ${{ github.event.number }} \
          --metrics coverage,perf,bundle,a11y,security
      - name: Post comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const comment = fs.readFileSync('pr-comment.md', 'utf8');
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

**Key CI principles:**
1. **All jobs must pass** – any failure blocks merge
2. **No skipping** – even if AI says "passed locally", CI re-verifies
3. **Clear reporting** – PR comment shows which KPI thresholds were met or missed
4. **Fast feedback** – entire pipeline < 15 minutes ideally

---

## Phase 7: Post-Merge – Learning & Improvement

After the PR merges and the code runs in production, the AI should learn from outcomes.

### 7.1 Monitor Production Metrics
Track the KPIs that the PR claimed to improve:

- Did actual production latency match simulated latency?
- Did error rate stay below threshold?
- Were any new incidents linked to this change?
- Did feature adoption meet expectations (if analytics instrumentation added)?
- Did users report accessibility issues?

### 7.2 Incident Correlation
If an incident occurs post-deploy:
1. Correlate with recent PRs (last 24-48h)
2. Identify which KPI validation failed to catch the issue
3. Analyze why simulation didn't match production
   - Load test not realistic enough?
   - Missing edge case in golden dataset?
   - Configuration drift between environments?
4. Update AI validation rules/prompts to prevent recurrence
5. Add the incident scenario to golden dataset as a negative test case

### 7.3 Track AI Suggestion Quality
Maintain a feedback loop on AI-generated artifacts:

| Artifact | Acceptance Rate | Common Rejections | Action |
|----------|----------------|-------------------|--------|
| Unit tests | 85% | Too trivial, missing edge cases | Improve test generation prompt |
| Performance suggestions | 70% | Over-optimization, premature | Add cost-benefit analysis |
| PR descriptions | 95% | Too verbose | Auto-summarize |
| Accessibility fixes | 90% | Incorrect ARIA usage | Train on more a11y examples |
| Rollback scripts | 60% | Not tested, incomplete | Add rollback validation step |

Use this data to fine-tune AI behavior (temperature, prompt engineering, few-shot examples).

### 7.4 Periodic Golden Dataset Expansion
- Weekly: Review production errors/user feedback; add new golden cases for edge behaviors
- Monthly: Audit golden dataset for diversity; remove obsolete cases
- Quarterly: Re-evaluate KPI thresholds based on industry benchmarks and team capacity

---

## When AI Must Escalate to Human

Some KPIs require human judgment or production data. The AI should automatically flag these in the PR:

| KPI | AI Can Validate? | Human Action Required |
|-----|------------------|----------------------|
| **Test coverage %** | ✅ | - |
| **Simulated latency** | ✅ | - |
| **Actual production latency** | ❌ | Monitor after deploy; compare to baseline |
| **Feature adoption** | ❌ | Check analytics after 1–2 weeks; iterate |
| **User satisfaction (CSAT/NPS)** | ❌ | Collect feedback; survey users |
| **Cross-team impact** | ❌ | Notify affected teams; get sign-off |
| **Architectural long-term fit** | ❌ | Architecture review meeting |
| **Business value delivered** | ❌ | Product team evaluates OKR impact |
| **Ethical implications** | ❌ | Ethics review (bias, fairness, manipulation) |

**AI should include in PR:**
> "⚠️ Requires human validation post-deploy: Feature adoption metrics to be reviewed in 2 weeks. Analytics events: `feature_x_used`, `feature_x_completed`."

---

## Implementation in OpenClaw

### As a `coding-agent` Skill

Create a skill that enforces this workflow:

```yaml
skill: responsible-developer
version: 1.0
description: AI bot that develops code while ensuring KPI compliance before PR

prompt: |
  You are a senior developer responsible for meeting KPIs.
  
  WORKFLOW:
  1. When given a task, first identify affected KPIs (backend/frontend/full-stack).
  2. Query current metrics via available MCP tools to establish baseline.
  3. Define explicit success criteria (e.g., "latency increase < 10%").
  4. Write code with KPI constraints in mind (performance, security, a11y, etc.).
  5. After each major step, run self-validation:
     - Lint/type check
     - Generate and run tests (ensure coverage ≥ target)
     - Performance simulation (if applicable)
     - Security scan
     - Bundle analysis (frontend)
     - Accessibility audit (frontend)
     - Golden dataset regression
  6. If any check fails, auto-fix or abort with explanation.
  7. Before PR, complete the appropriate checklist (backend/frontend/full-stack).
  8. Generate PR description with KPI impact table and rollback plan.
  9. CI will re-verify; trust but verify.
  
  CONSTRAINTS:
  - Never submit PR that fails any checklist item
  - If can't meet KPI, explain why and propose mitigation or manual review
  - Always include monitoring/metrics for post-deploy validation
  
  AVAILABLE TOOLS:
  - MCP: apm, coverage, web-vitals, axe, bundle-tracker, vulnerability-db, codebase-search
  - Skills: test-generator, query-optimizer, lighthouse-auditor, a11y-fixer, doc-generator
```

### As a Pre-Commit Hook

Provide a script `scripts/pre-commit-self-check.sh` that developers (and AI) run locally:

```bash
#!/bin/bash
set -e

echo "🔍 Running pre-PR self-validation..."

# 1. Lint
npm run lint || { echo "❌ Lint failed"; exit 1; }

# 2. Type check
npm run type-check || { echo "❌ Type check failed"; exit 1; }

# 3. Unit tests + coverage
npm test -- --coverage || { echo "❌ Tests failed"; exit 1; }
COV=$(grep -oP 'All files[^0-9]*\K[0-9.]+' coverage/summary.txt)
if (( $(echo "$COV < 80" | bc -l) )); then
  echo "❌ Coverage $COV% below 80% threshold"
  exit 1
fi

# 4. Security scan
semgrep --config=auto --error || true  # Warn but don't fail (for now)

# 5. Performance (if load test exists)
if [ -f "load/test.js" ]; then
  k6 run --out json=perf.json load/test.js
  python scripts/check_perf_regression.py perf.json baseline.json || {
    echo "❌ Performance regression detected"
    exit 1
  }
fi

# 6. Lighthouse (frontend)
if [ -f "lighthouse.config.js" ]; then
  npm run build
  npx lighthouse-ci http://localhost:3000 --perf=90 --a11y=90 || {
    echo "❌ Lighthouse thresholds not met"
    exit 1
  }
fi

# 7. Accessibility
npx playwright-test --project=axe || {
  echo "❌ Accessibility violations found"
  exit 1
}

# 8. Bundle size
npx bundlesize || {
  echo "❌ Bundle size exceeds budget"
  exit 1
}

echo "✅ All self-validation checks passed!"
```

### CI/CD Enforcement

Use the GitHub Actions workflow provided earlier (or adapt for GitLab/Jenkins). Key gates:
- All checks must pass
- Coverage thresholds enforced
- Performance regression blocked
- Accessibility violations blocked
- Security vulnerabilities at high+ severity blocked

### Dashboard for AI Performance

Track AI bot's effectiveness:

```sql
-- Metrics to collect
SELECT
  DATE(created_at) as date,
  COUNT(*) as prs_generated,
  AVG(CASE WHEN AI_SELF_CHECK_FAILED THEN 1 ELSE 0 END) as self_check_failure_rate,
  AVG(CASE WHEN CI_FAILED THEN 1 ELSE 0 END) as ci_failure_rate,
  AVG(time_to_merge_hours) as merge_time,
  AVG(post_deploy_incident_rate) as incident_rate
FROM ai_generated_prs
GROUP BY DATE(created_at);
```

---

## Example: AI Bot's Internal Reasoning Log

When generating a PR, the AI should keep an internal log (could be in PR comment or separate file) showing its validation steps:

```markdown
### 🤖 AI Self-Validation Log

**Task:** Add rate limiting to `/api/chat` endpoint

**Affected KPIs:**
- API performance (latency)
- Security (prevent DoS)
- Reliability (MTTR if rate limiter breaks)
- Test coverage

**Baseline Metrics (queried via MCP):**
- p95 latency (last 7d): 120ms
- Error rate: 0.05%
- Orders service coverage: 87%

**Success Criteria:**
- p95 latency < 132ms (+10%)
- Error rate < 0.1%
- Coverage on rate limiter module ≥ 80%
- 0 critical/high vulnerabilities

**Validation Steps:**

1. ✅ Lint: `npm run lint` – 0 errors
2. ✅ Type check: `mypy ai_services/chat.py` – 0 errors
3. ✅ Unit tests generated and passing:
   - test_rate_limit_token_bucket()
   - test_rate_limit_exceeded()
   - test_rate_limit_recovery()
   Coverage: `services/rate_limit: 92%` (≥ 80% target)
4. ✅ Integration tests generated:
   - test_chat_endpoint_under_load()
   - test_rate_limit_headers()
   Passing.
5. ✅ Performance simulation with k6 (100 VUs, 30s):
   - p95: 128ms (within 132ms target)
   - Error rate: 0%
   - Redis CPU: 65% (acceptable)
6. ✅ Security scan: `semgrep --config=p/elasticsearch` – 0 findings
7. ✅ Migration reversible: `alembic downgrade -1` tested successfully
8. ✅ Golden dataset: 42/42 cases pass (no regression)
9. ✅ Documentation: OpenAPI spec updated, includes new headers `X-RateLimit-Remaining`

**Self-Assessment:** ✅ All KPI targets met or exceeded. Ready for PR.

**Post-Deploy Validation Plan:**
- Monitor `rate_limit_limited_total` metric in Datadog
- Alert if rate limit error rate > 1%
- Check Redis CPU < 80% sustained
- Review after 24h, adjust thresholds if needed.
```

Including this log in the PR helps humans understand the AI's reasoning and builds trust.

---

## Summary: The AI Bot's Pre-PR Gate

The AI must **not submit a PR** unless it can confidently say:

1. **All static analysis** (lint, type, complexity) passed
2. **All tests** (unit, integration, E2E) written and passing with coverage ≥ target
3. **Performance** (simulated) within thresholds (or improvement demonstrated)
4. **Security** scan clean (0 new critical/high)
5. **Accessibility** (if frontend) 0 violations
6. **Bundle size** (if frontend) within budget
7. **Golden dataset** no regressions
8. **Migrations** reversible and tested
9. **Documentation** updated (API docs, ADRs)
10. **Rollback plan** documented and tested
11. **Monitoring** instrumentation added

If any of these fail, the AI must either:
- **Auto-fix** (generate patch to address issue), or
- **Escalate** to human with explanation: "I cannot meet KPI X because [reason]. Suggest [workaround] or human intervention."

---

## Conclusion

By embedding KPI awareness into the AI bot's development loop, you create a **self-policing agent** that produces higher-quality code, reduces human review burden, and systematically improves engineering metrics over time.

The AI becomes not just an assistant, but a **responsible team member** that understands what "done" means (it's not just code that compiles—it's code that meets team standards and business expectations).

---

*This document is part of the FutureOfDev repository. Version: 1.0 (2025-02-26)*
