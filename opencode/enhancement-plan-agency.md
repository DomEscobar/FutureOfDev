# Enhancement Plan: Project-Config-Driven Agency

**Status:** Draft  
**Date:** 2025-03-02  
**Author:** OpenCode Enhancement Team  
**Version:** 1.0

---

## Executive Summary

Transform OpenCode from a **hardcoded Go+Vue agency** into a **universal, configuration-driven orchestration framework** that can govern any programming language, stack, or workflow. The core innovation: each project declares its own quality gates (KPIs), task policies, and agent behaviors through `.opencode/project.yaml`. Agents read this config at every gate and dynamically adapt their success criteria.

This eliminates the fundamental misalignment where pre-commit hooks and orchestrator gates assume specific tools (golangci-lint, npm run build) that may not exist or may be inappropriate for the project's technology stack.

---

## Problem Statement

### Current State (V16.0)

OpenCode enforces three hardcoded KPIs:

1. **Test Coverage ≥ 80%** (measured via `go test ./...` or `npm run test:unit -- --coverage`)
2. **Zero Lint/Type Errors** (via `golangci-lint run ./...` + `eslint .` + `vue-tsc`)
3. **Performance No Regression >10%** (via `scripts/perf_check.sh` with k6)

These checks are **baked into**:
- `orchestrator.cjs:enforceKPIGate()` (orchestrator flow)
- `.git/hooks/pre-commit` (local blocking)
- `.github/workflows/kpis.yml` (CI/CD blocking)
- Agent SOUL.md files (behavioral constraints)

### Pain Points

1. **Tech Stack Lock-in**: Cannot use OpenCode for Rust, Python, Java, Bash, or Node.js frameworks beyond Vue.
2. **Irrelevant Gates**: Bash script project forced to run `go test` (fails). Python project forced to run `golangci-lint`.
3. **No Flexibility**: Emergency hotfix (1-line config change) must still wait for 80% coverage analysis and full lint suite.
4. **Scientific Dogma**: All tasks require Red/Green tests, even research spikes or third-party SDK integrations where deterministic tests are impossible.
5. **Brittle Exemptions**: `// KPI-EXEMPT` comments exist but don't actually override hard gates; Checker/Skeptic may still reject.
6. **No Multi-Phase Support**: Database migrations, long-running operations don't fit the quick-iteration model.
7. **Pre-commit Overhead**: Running full coverage suite on every commit (5-10 minutes) is excessive for quick changes.

---

## Vision: Project-Config-Driven Agency

### Core Principles

1. **Configuration Over Convention**: Each project declares its own quality gates in `.opencode/project.yaml`.
2. **Dynamic Adaptation**: Agents read the config at each gate and apply only relevant checks.
3. **Task-Type Policies**: Different task types (feature, bug, hotfix, spike, migration) trigger different gate requirements.
4. **Universal Stack Support**: Any language, any toolchain, any workflow.
5. **Backward Compatible**: Existing Go+Vue projects automatically generate the same rules they had before.
6. **Hierarchical Governance**: Organization-level minimum standards can be enforced via inheritance.

### Configuration Schema

```yaml
# .opencode/project.yaml
version: "1.0"

# Project identity
project:
  name: "string"
  type: "go-vue" | "rust" | "python" | "node" | "java" | "bash" | "custom"
  description: "string"

# Quality Gates (KPIs) - checked at each gate
kpis:
  - id: "string"                    # e.g., "tests", "coverage", "lint", "build", "security"
    type: "command" | "coverage" | "custom" | "benchmark"
    command: "string"               # executed in WORKSPACE; produces output
    timeout: 300                    # seconds (default 300)
    allowed_failures: false         # if true, failure only warns, doesn't block
    required_for: ["all"] | ["feature", "bug"] | ["hotfix"]  # task types
    extract_coverage_from: "string" # path to coverage JSON (for type: coverage)
    threshold: 0.85                 # for coverage type (0-1)
    compare_to_baseline: false      # for benchmark type (p95 regression check)
  
  - id: "security"
    type: "command"
    command: "trivy fs --exit-code 1"
    allowed_failures: false

# Task-type policies - which gates apply and what protocol to follow
task_types:
  feature:
    require_red_green: true
    require_coverage_report: true
    max_hammer_retries: 3
    parallel_audits: true           # Checker + Skeptic can run in parallel
  bug:
    require_red_green: true
    require_coverage_report: false  # bugs may not need new coverage
  hotfix:
    require_red_green: false        # skip scientific method for speed
    skip_lint: true                 # allow lint warnings
    skip_performance: true
    max_hammer_retries: 1           # fewer retries for emergencies
  spike:
    require_red_green: false
    require_tests: false            # research may not produce tests
    skip_all_kpis: true             # only need exploration results
  migration:
    require_red_green: false
    long_running_ok: true           # allow multi-minute operations
    skip_performance: true
    allow_partial_success: true     # migrate 10M rows in chunks

# File patterns - allow different extensions for Red/Green tests
patterns:
  red_test: ".run/red-*.{sh,py,rs,js,go}"
  green_test: ".run/green-*.{sh,py,rs,js,go}"
  contract: ".run/contract.md"
  veto_log: "roster/shared/VETO_LOG.json"
  architecture: "docs/ARCHITECTURE.md"

# Optional: Agent overrides per project (rarely used)
agent_overrides:
  hammer:
    steps: 150        # more iterations for complex projects
  medic:
    healing_strategy: "aggressive"  # or "conservative"
```

---

## Technical Architecture

### 1. Config Loader Module

**File**: `lib/project-config.js` (new)

Responsibilities:
- Load `.opencode/project.yaml` from `WORKSPACE`
- Validate against JSON schema (using Zod or Joi)
- Auto-detect stack if config missing (during `agency init` only)
- Provide caching (read once per orchestrator run)
- Support inheritance from `org-policy.yaml` in AGENCY_HOME

```javascript
class ProjectConfig {
  load(workspace) {
    const configPath = path.join(workspace, '.opencode/project.yaml');
    if (!fs.existsSync(configPath)) {
      return this.generateDefault(workspace); // auto-detect
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(raw);
    this.validate(config);
    this.applyInheritance(config); // from org-policy
    return config;
  }

  getTaskPolicy(taskType) {
    return this.config.task_types[taskType] || this.config.task_types['feature'];
  }

  getKPIsForTask(taskType) {
    return this.config.kpis.filter(kpi => 
      kpi.required_for.includes('all') || kpi.required_for.includes(taskType)
    );
  }
}
```

### 2. Orchestrator Enhancements

**File**: `orchestrator.cjs`

Changes to `enforceKPIGate(role, taskType)`:

- Load project config **once** at start of orchestrator run
- Determine task type from task description keywords (regex: `/hotfix|emergency/i`, `/spike|research/i`, `/migration|data-migration/i`)
- Execute KPIs **in parallel** using `Promise.all()` for independent checks
- Apply `allowed_failures` and `required_for` filters
- If `skip_all_kpis` for task type, gate passes automatically

```javascript
async function enforceKPIGate(role, taskType) {
  if (process.env.BENCHMARK_MODE) return true;
  if (role !== 'hammer') return true;

  const config = projectConfig.getTaskPolicy(taskType);
  if (config.skip_all_kpis) {
    log("🔒 KPI gate skipped for task type:", taskType);
    return true;
  }

  const kpis = projectConfig.getKPIsForTask(taskType);
  
  // Parallel execution
  const results = await Promise.all(
    kpis.map(kpi => runKPICheck(kpi))
  );

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    log("🚫 KPI Gate failed:", failures.map(f => f.id));
    return false;
  }
  return true;
}
```

### 3. Agent Adaptation

#### Hammer SOUL Update

Add to Definition of DONE:
- Read project config → know which patterns match Red/Green tests
- Before declaring victory, **re-run the same KPI commands** that orchestrator will check
- If `skip_lint: true` for hotfix, Hammer does NOT spend time fixing minor lint issues

#### Checker SOUL Update

- Load task policy → if `require_red_green: false`, skip Red Test verification
- Validate that Red/Green files match `patterns.red_test` (allows `.sh` for bash projects)
- Still require **some** proof-of-failure/success, but can be non-code (e.g., "manual test script")

#### Medic SOUL Update

- Load KPI definitions → knows how to heal each type:
  - For `type: command` with `allowed_failures: false`: run command and parse error output
  - For `type: coverage`: identify uncovered lines, suggest test additions
  - For `type: lint`: use `--fix` flag if available (eslint --fix, cargo clippy --fix)
- Respect `max_hammer_retries` from task policy

#### Skeptic SOUL Update

- Read project's `kpis` array → understand what "quality" means for this project
- If project has no `security` KPI, Skeptic may add it as recommendation (not veto)
- Knows that `allowed_failures: true` gates are warnings, not blockers

### 4. Command System Updates

**Files**: `.opencode/commands/*.md`

All commands that invoke KPI checks should:
- Load project config
- Use config-defined commands instead of hardcoded ones
- Print unified report showing pass/fail per KPI

Example `kpi-check.md` template:
```
Load project config
For each KPI in order:
  - Run command (with timeout)
  - Capture exit code, stdout
  - For coverage: parse JSON, compare to threshold
  - For benchmark: compare to baseline.json
Print summary: ✅ 4/5 passed
Exit code: 0 if all critical passed, 1 otherwise
```

### 5. Pre-Commit Hook Enhancement

**File**: `.git/hooks/pre-commit` (generated by `agency init`)

Current: Runs hardcoded Go/Vue checks  
Proposed: **Read project config and run configured KPI commands that are fast** (exclude coverage and long builds)

Rationale: Pre-commit should be **fast** (<30s). Coverage and full builds belong in CI.

Pattern:
```bash
#!/bin/bash
# Load .opencode/project.yaml
# Extract kpis where: 
#   - timeout < 60 seconds
#   - type != coverage (coverage too slow)
# Run those commands in parallel
# If any fail, exit 1
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Create config schema + loader; no agent changes yet.

1.1 Create `lib/project-config.js`:
   - YAML parser (use `js-yaml` package)
   - Schema validation (use `zod` or `ajv`)
   - Default config generator (auto-detect stack)
   - Inheritance support (org-policy.yaml)

1.2 Add `agency init-config` command:
   - Generates `.opencode/project.yaml` based on detected stack
   - For Go+Vue: outputs current hardcoded rules as YAML
   - For unknown: prompts user to select from presets

1.3 Document config schema with examples for 6 stacks:
   - go-vue.yml
   - rust.yml
   - python.yml
   - node-react.yml
   - java-maven.yml
   - bash.yml

1.4 Add config validation to `agency status` command.

**Deliverable**: Config system works; projects can declare gates; orchestrator ignores config for now.

---

### Phase 2: Orchestrator & KPI Gate (Week 3-4)

**Goal**: Make orchestrator read config; replace hardcoded gates with dynamic KPI execution.

2.1 Refactor `enforceKPIGate()`:
   - Load config
   - Get task type from task description
   - Get KPIs for task type
   - Execute in parallel (Promise.all)
   - Honor `allowed_failures`, `timeout`, `required_for`

2.2 Implement `runKPICheck(kpi)` utility:
   - For `type: command`: spawn process, capture exit code
   - For `type: coverage`: run command, parse output, compare to threshold
   - For `type: benchmark`: compare to baseline.json
   - For `type: custom`: load custom JS validator function

2.3 Update Hammer Definition of DONE:
   - Hammer checks same KPIs locally before victory
   - Use `task_type` from config to know expectations

2.4 Update Checker:
   - If `require_red_green: false`, accept any proof-of-work (even manual steps described in .run/notes.txt)
   - Still require *something* that demonstrates failure→success

2.5 Add `--dry-run` flag to `agency run` to show which KPIs would be checked without executing.

**Deliverable**: Orchestrator uses project config; hardcoded Go/Vue checks removed from gate.

---

### Phase 3: Agent Soul Updates (Week 5-6)

3.1 Update all agent SOUL.md files with config-aware behaviors:
   - **Architect**: Include task_type and required KPIs in contract
   - **Hammer**: Follow task_type policies (skip_lint, long_running_ok)
   - **Checker**: Respect `require_red_green` flag
   - **Skeptic**: Understand `allowed_failures` meaning
   - **Medic**: Load KPI definitions and execute appropriate healing commands

3.2 Implement parallel agent spawning for independent audits:
   - After Hammer, spawn Checker AND Skeptic simultaneously
   - Orchestrator waits for both to finish, then proceeds to Medic
   - Add `parallel_audits` flag to task_type config to enable/disable

3.3 Add config change detection:
   - If `.opencode/project.yaml` changes during a run, warn and suggest restart
   - Cache config in memory but check mtime on disk

**Deliverable**: All agents are config-aware; parallel audits working.

---

### Phase 4: Pre-Commit & CI Integration (Week 7-8)

4.1 Update `agency init` to generate **project-aware pre-commit hook**:
   - Hook reads `.opencode/project.yaml`
   - Runs only fast KPIs (`timeout < 60` and `type != coverage`)
   - Spawns in parallel (if multiple)
   - Outputs concise pass/fail

4.2 Update `.github/workflows/kpis.yml`:
   - Use `agency kpi-check` command (which reads config)
   - Include coverage always (slow but necessary)
   - Add step: "Validate project config exists and is well-formed"

4.3 Create `agency migrate-config` command:
   - Scans workspace for `go.mod`, `package.json`, etc.
   - Generates appropriate `.opencode/project.yaml` if missing
   - For Go+Vue: produces exact current rules (backward compatible)

4.4 Add config lint command: `agency config-lint` validates YAML against schema.

**Deliverable**: Pre-commit and CI use same config; migration path for existing projects.

---

### Phase 5: Testing, Documentation & Rollout (Week 9-10)

5.1 Create test fixtures for 6 different stacks:
   - go-vue-project/
   - rust-api/
   - python-scripts/
   - bash-deploy/
   - node-react/
   - java-spring/
   
5.2 End-to-end tests:
   - Run `agency run` on each fixture with appropriate task types
   - Verify wrong gates skipped, right gates enforced
   - Test parallel agent spawning

5.3 Documentation:
   - Update README.md with new config format
   - Create `docs/project-config-reference.md`
   - Write migration guide from V16.0 to V17.0
   - Add examples for each task type

5.4 Rollout strategy:
   - Release V17.0 as major version
   - V16.0 projects continue to work (fallback to hardcoded if no config)
   - Recommend running `agency migrate-config` then testing

5.5 Deprecation plan:
   - Hardcoded Go+Vue gates in `enforceKPIGate` marked deprecated
   - Remove in V18.0 (one year later)
   - Agents will warn if config missing: "Using legacy defaults; migrate to .opencode/project.yaml"

**Deliverable**: Production-ready V17.0 with full documentation.

---

## Parallel Processing Optimizations

### KPI Parallelization

**Current**: KPI commands run sequentially in `enforceKPIGate`.

**Proposed**: Run independent KPIs in parallel:

```javascript
// Group KPIs by independence
const fastKpis = kpis.filter(k => k.timeout < 60);
const slowKpis = kpis.filter(k => k.timeout >= 60);

// Run fast ones in parallel
const fastResults = await Promise.all(
  fastKpis.map(runKPICheck)
);

// Run slow ones sequentially (to avoid OOM)
for (const kpi of slowKpis) {
  await runKPICheck(kpi);
}
```

**Speedup**: If 3 fast KPIs take 30s each → serial = 90s, parallel = 30s (max). **3x faster**.

### Agent Parallelization

**Current**: Architect → Hammer → Checker → Skeptic → Medic (fully serial)

**Proposed**: Parallelize read-only audits:

```
                ┌───> Checker ──┐
Architect → Hammer            ↓ → Medic
                └───> Skeptic ──┘
```

Implementation in `orchestrator.cjs`:

```javascript
// After Hammer completes
if (config.task_types[taskType].parallel_audits) {
  const [checkerResult, skepticResult] = await Promise.all([
    runAgent('checker', ...),
    runAgent('skeptic', ...)
  ]);
} else {
  checkerResult = await runAgent('checker', ...);
  skepticResult = await runAgent('skeptic', ...);
}
// Then Medic
```

**Speedup**: If Checker takes 2min, Skeptic takes 3min → serial = 5min, parallel = 3min. **40% faster**.

### Command Parallelization in Medic

Medic often runs multiple healing commands (e.g., `go fmt`, `go vet`, `eslint --fix`). These should also be parallelized when independent.

---

## Efficiency Benchmarks

Based on realistic simulation:

| Phase | Current (Serial) | Config-Driven (Parallel) | Speedup |
|-------|------------------|--------------------------|---------|
| KPI Gate (3 fast checks) | 90s (30s each) | 30s (parallel) | 3x |
| Audit Phase (Checker+ Skeptic) | 5min (2+3) | 3min (parallel) | 1.67x |
| Overall Simple Task | 8-12 min | 5-8 min | ~1.5x |
| Hotfix (skipped gates) | Still 8-12 min (must run all) | 4-6 min (skipped coverage/lint) | ~2x |
| Rust Project (currently fails) | N/A (fails) | 5-8 min (works) | ∞ |

**Resource Impact**:
- Config loading: +100ms per gate (negligible)
- Parallel processes: +2-3 concurrent processes (memory +50MB)
- Net: **Faster and cheaper** (fewer agent retries due to appropriate gates)

---

## Migration Strategy

### For Existing Projects (Go + Vue)

1. **Run** `agency migrate-config`
2. **Generated `.opencode/project.yaml`** will match current hardcoded behavior exactly
3. **Verify**: `agency kpi-check` produces same results as before
4. **Optional**: Customize per task type (e.g., set `hotfix.skip_lint = true`) to gain benefits

### For New Projects (Non-Go)

1. `agency init` detects stack (by looking for `Cargo.toml`, `requirements.txt`, etc.)
2. auto-generates appropriate `.opencode/project.yaml` from preset
3. Developers can edit to tweak thresholds or add custom KPIs
4. Ready to use immediately

### Fallback Mechanism

If `.opencode/project.yaml` is missing:
- During `agency run`: Use legacy hardcoded Go+Vue rules (with warning)
- During `agency init`: Auto-generate config
- During CI: Fail with message "Missing project config; run agency init"

This ensures no silent breakage.

---

## Governance & Security Considerations

### Configuration Tampering

**Risk**: Developers could weaken standards (set threshold: 0, allowed_failures: true).

**Mitigation**:
1. **Org Policy Inheritance** (`.opencode/org-policy.yaml` at agency root):
   ```yaml
   org:
     min_coverage_threshold: 0.80
     required_kpis: ["tests", "lint", "security"]
     forbid_task_types: ["spike"]  # or require approval
   ```
   Projects inherit and cannot override below minimum.

2. **CI Validation** (in `.github/workflows/kpis.yml`):
   - Step: "Check config compliance" verifies project.yaml meets org standards
   - Reject PR if config has been weakened

3. **Version Control**:
   - `.opencode/project.yaml` committed to repo (like README)
   - Changes require PR review (same as code)
   - Audit trail for why standards were adjusted

### Agent Safety

- Agents still operate under TOOLBOX.json restrictions (no arbitrary bash unless allowed)
- Config only defines **what** to check, not **how** agents think
- SOUL.md behavioral constraints remain unchanged

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Config complexity overwhelms users | High | Provide `agency init` auto-generation; presets for 6 common stacks |
| Projects misconfigure and CI breaks | Medium | CI step validates config syntax + org policy compliance before running gates |
| Parallel KPI runs cause resource exhaustion | Low | Limit concurrent processes via `max_concurrent_kpis` setting (default 3) |
| Config file missing → legacy behavior (unexpected) | Medium | Clear warnings; pre-commit hook warns; agency status shows "using defaults" |
| Task type detection via keywords unreliable | Medium | Allow manual override: `agency run --type hotfix "desc"` |
| Organization policy conflicts with project needs | High | Escalation process: documented exceptions with CTO approval; org-policy can have `allow_exceptions: true` |

---

## Success Metrics

### Quantitative

- **Adoption**: ≥80% of projects have `.opencode/project.yaml` within 3 months
- **Task Success Rate**: Increase from ~70% (today) to ≥85% (fewer false positives)
- **Mean Time to Completion**: Reduce by 30% for hotfixes/spikes
- **Parallel Speedup**: KPI gate time reduced by 40% (measured via telemetry)
- **Stack Diversity**: Support for ≥5 distinct languages in same monorepo

### Qualitative

- Developer satisfaction: "Agency feels flexible, not rigid" (survey)
- Fewer exemption requests (`// KPI-EXEMPT` comments decrease)
- New projects can onboard faster (config matches their stack)
- Security/compliance teams can customize gates per project risk level

---

## Flaws & Mitigations (Critical Design Review)

During stress-test simulation of 15 scenarios, the following critical flaws were discovered. Each requires design updates before implementation.

### F1: Agent SOUL vs Config Conflict (CRITICAL)

**Scenario**: Hotfix task with `require_red_green: false` in config, but Checker's SOUL demands Red Test for EVERY task. Checker rejects despite config allowing skip.

**Flaw**: Agent behavioral constraints (SOUL.md) are hardcoded and override project config. This breaks the fundamental premise that config adapts agents.

**Required Fix**: Update Checker SOUL to respect config:

```markdown
## V16.0 Pre-Audit Gates
### Red Test Requirement Check
- [ ] Read project config's task_types[taskType].require_red_green
- [ ] If false, accept alternative proof-of-work OR skip Red Test check
- [ ] If true but no Red Test found → REJECT with "MISSING RED TEST"
```

Similar update needed for Skeptic (if task policy says `skip_lint: true`, Skeptic should not veto lint issues).

---

### F2: Multi-Stack / Monorepo Support (HIGH)

**Scenario**: Repository contains Go backend + Python ML service + Bash deploy scripts. Single `.opencode/project.yaml` cannot express different KPIs per subdirectory.

**Flaw**: Config assumes single stack per project. Large orgs have polyglot repos.

**Required Fix**: Add `subprojects` config section:

```yaml
subprojects:
  - path: "backend"
    kpis: [...]  # Go-specific
  - path: "scripts"
    kpis: [...]  # Bash-specific
  - path: "ml"
    kpis: [...]  # Python-specific
```

Orchestrator determines which subproject changed (via git diff) and only runs KPIs for affected ones. If task description mentions specific service, use that.

---

### F3: Long-Running Operations (HIGH)

**Scenario**: Database migration taking 2 hours. Hammer writes script; KPI gate expects to run tests/build immediately. Migration is the test.

**Flaw**: Gate model assumes KPIs are quick (<5 min). No support for multi-phase tasks where implementation itself is a long-running operation.

**Required Fix**: Introduce `phases` in task_types:

```yaml
task_types:
  migration:
    phases:
      - name: "prepare"
        kpis: ["build", "lint"]
      - name: "execute"
        kpis: ["migration_success"]  # long-running ok
        timeout: 7200
      - name: "verify"
        kpis: ["data_integrity"]
    allow_sequential_phase_gates: true
```

Orchestrator runs gates after each phase instead of only at end.

---

### F4: Hammer Artifact Flexibility (HIGH)

**Scenario**: Spike task produces a markdown report, not code. Hammer's SOUL says "implement the contract with absolute fidelity" but may not know how to write docs.

**Flaw**: Hammer persona is "Lead Software Engineer" - may resist non-code outputs.

**Required Fix**: Update Hammer SOUL Definition of DONE:

```
### Deliverable Types
- [ ] Code (source files, tests, configs)
- [ ] Documentation (contract.md, ARCHITECTURE.md, spike reports)
- [ ] Scripts (bash, python, etc.)
- [ ] Build artifacts (binaries, packages)

If contract specifies non-code deliverable, Hammer MUST produce it with same fidelity.
```

---

### F5: Inheritance Policy Ambiguity (MEDIUM)

**Scenario**: Org policy says min coverage 90%, project config says 80%. Which wins?

**Flaw**: Undefined merging semantics leads to "weakest link" gaming.

**Required Fix**: Define inheritance rules:

```yaml
org:
  enforce_minimums: true
  min_coverage_threshold: 0.90
  required_kpis: ["tests", "security", "lint"]

project:
  kpis:
    - id: "coverage"
      threshold: 0.85  # ERR: must be >= 0.90
```

Validation should reject project configs that weaken org standards. Add `can_override: false` field on org policy entries.

---

### F6: Config Change Mid-Run (MEDIUM)

**Scenario**: Hammer fails first attempt. Medic fixes. During Medic run, developer manually edits `.opencode/project.yaml` to add new KPI. Second Hammer attempt uses stale cached config.

**Flaw**: Orchestrator loads config once at start. No detection of config drift during multi-attempt loop.

**Required Fix**:
- Check config file mtime before each agent spawn
- If changed, log warning and reload
- Or: Forbid config changes during active run (check git status for unstaged .opencode/*.yaml)

---

### F7: Invalid Config Graceful Degradation (MEDIUM)

**Scenario**: Developer commits malformed YAML. `agency run` crashes immediately.

**Flaw**: No fallback to legacy behavior. One config typo breaks entire CI.

**Required Fix**: Config loader should catch parse/validation errors and:

1. Log clear error: "Invalid .opencode/project.yaml: line 23 unexpected token"
2. If in CI: fail fast with understandable message
3. If in `agency run` with no config present: fall back to auto-detected defaults based on stack (Go+Vue if go.mod exists)
4. Always emit actionable fix instructions

---

### F8: KPI Dependency Graph (MEDIUM)

**Scenario**: Custom audit KPI needs build artifacts. It runs in parallel with build KPI → fails because target/ directory not ready.

**Flaw**: Parallel execution assumes all KPIs independent. No way to declare dependencies.

**Required Fix**: Add optional `depends_on` field to KPI definition:

```yaml
kpis:
  - id: "build"
    command: "cargo build"
  - id: "audit"
    command: "audit-tool target/debug/app"
    depends_on: ["build"]
```

Orchestrator should topologically sort or execute in phases: all with `depends_on: []` run first (in parallel), then dependent ones.

---

### F9: Coverage Exemptions (MEDIUM)

**Scenario**: Legacy module with 0% coverage can't be tested. Project coverage threshold 80% unmet because of this one file.

**Flaw**: All-or-nothing coverage leads to exemptions for entire project or none.

**Required Fix**: Add `coverage.exemptions` array:

```yaml
coverage:
  threshold: 0.80
  exemptions:
    - path: "vendor/"
      reason: "Third-party code"
    - path: "legacy/unsafe.py"
      reason: "Refactor ticket: REF-456"
      ticket: "REF-456"
```

Coverage command should include appropriate exclusion flags (e.g., `--omit-files` for jest, `--ignore` for pytest-cov). Config loader must translate exemptions into command arguments.

---

### F10: Flaky Test Retry Logic (HIGH)

**Scenario**: Tests fail intermittently due to race condition. Medic tries to fix "broken" tests that are actually flaky. Task loops.

**Flaw**: No retry mechanism; flaky tests cause false negatives.

**Required Fix**: Add `retry` field to KPI:

```yaml
kpis:
  - id: "tests"
    command: "pytest tests/"
    retry: 3
    retry_threshold: 0.7  # consider success if >=70% passes
    allow_flaky: true  # warn if still flaky after retries
```

Orchestrator runs command up to `retry` times, considers success if any attempt passes or meets `retry_threshold`. Medic should detect flaky tests (same test, different outcomes) and suggest adding `@flaky` annotation or moving to separate "flaky" test suite.

---

### F11: Task Type Misclassification Abuse (LOW)

**Scenario**: Developer labels routine refactor as "hotfix" to skip lint and coverage.

**Flaw**: Keyword-based task detection is gameable.

**Mitigation**:
1. Hotfix tasks require explicit flag: `agency run --type hotfix --emergency` or `/hotfix` command
2. Hotfix commits get special git hook that verifies branch is on production emergency
3. All hotfix tasks automatically trigger extra Skeptic review even if KPIs skipped
4. Track hotfix frequency; alerts if >1 per developer per week

**Required Fix**: Update orchestrator to require manual type override for non-default types, or add approval workflow.

---

### F12: Matrix Builds (LOW)

**Scenario**: Go project builds for linux/amd64, windows/amd64, darwin/arm64. Config only builds current platform.

**Flaw**: Cross-platform compatibility not verified.

**Required Fix**: Add `matrix` field:

```yaml
kpis:
  - id: "build"
    command: "go build -o dist/{{.OS}}-{{.ARCH}}/app ./cmd/app"
    matrix:
      - OS: ["linux", "windows", "darwin"]
        ARCH: ["amd64", "arm64"]
```

Orchestrator expands matrix and runs builds in parallel (up to concurrency limit). All matrix cells must pass for KPI to pass.

---

### F13: Secret Management for KPIs (MEDIUM)

**Scenario**: Security scan needs `SNYK_TOKEN` env var. CI has it set, but local `agency run` doesn't → fails.

**Flaw**: No way to document required env vars; failure uninformative.

**Required Fix**: Add `env` field to KPI:

```yaml
kpis:
  - id: "security"
    command: "trivy fs"
    env: ["SNYK_TOKEN", "TRIVY_TOKEN"]
    missing_env_behavior: "warn" | "fail" | "skip"
```

Validator checks that these env vars are defined in CI workflow template. Or provide `opencode secret set SNYK_TOKEN <value>` command to store org-wide secrets encrypted.

---

### F14: Concurrent Orchestrator Instances (MEDIUM)

**Scenario**: Two devs run `agency run` in same workspace (shared dev box or NFS). Both write `.run/telemetry_state.json` and `VETO_LOG.json`.

**Flaw**: Race conditions corrupt shared state.

**Required Fix**:
1. Use per-run subdirectory: `.run/{run-id}/` instead of shared `.run/`
2. Only merge final results to shared files with file locking (`flock`)
3. VETO_LOG writes should be atomic: write to temp then `rename()`

Implement `lockedAppendFile(path, line)` utility that uses `mkdir` lockfile or advisory flock.

---

### F15: Config Auto-Detection Reliability (LOW)

**Scenario**: Developer runs `agency init` in a new project with both `go.mod` and `package.json` (full-stack). Which preset chosen? Unexpected.

**Flaw**: Auto-detect heuristics may pick wrong stack.

**Required Fix**:
- `agency init` should ask interactive questions if multiple stacks detected
- Generate config with both stack sections commented out, user uncomments desired
- Or create polyglot preset with subprojects automatically detected by directory structure

---

## Consolidated Required Design Updates

Based on these 15 flaw scenarios, the enhancement plan requires these **additions**:

1. **Subproject configuration** + git-aware KPI routing (F2)
2. **Agent SOUL modifications** to respect `require_red_green`, `skip_lint`, `allowed_failures` (F1)
3. **Long-running task phases** with gate-after-each-phase support (F3)
4. **Hammer artifact flexibility** (non-code deliverables) (F4)
5. **KPI dependency graph** via `depends_on` field (F8)
6. **Coverage exemptions** + command argument injection (F9)
7. **Flaky test retry** logic in orchestrator (F10)
8. **Matrix expansion** for multi-platform builds (F12)
9. **Secret/env var** documentation and injection (F13)
10. **File locking** or run isolation for concurrent runs (F14)
11. **Inheritance policy** with minimums enforcement (F5)
12. **Config change detection** mid-run (F6)
13. **Graceful fallback** to auto-detected defaults on invalid config (F7)
14. **Task type approval workflow** for hotfix/spike to prevent abuse (F11)
15. **Improved init** with interactive stack selection (F15)

These must be integrated into Phase 1-5 implementation before coding begins.

---

## Implementation Order Adjustment

Given these flaws, the implementation phases should be revised:

### Revised Phase 1: Foundation (Week 1-3)
- 1.1: Config schema + loader + validation (including all new fields: subprojects, phases, depends_on, matrix, exemptions, etc.)
- 1.2: Org-policy inheritance with minimum enforcement
- 1.3: Graceful fallback for invalid/missing config
- 1.4: Auto-detection with interactive override

### Revised Phase 2: Orchestrator Core (Week 4-6)
- 2.1: Task type detection + policy lookup
- 2.2: KPI parallelization with dependency resolution
- 2.3: Subproject KPI routing based on git diff
- 2.4: Phase-based gates for long-running tasks
- 2.5: Config mtime tracking + change detection
- 2.6: Flaky test retry logic

### Revised Phase 3: Agent Souls (Week 7-8)
- 3.1: Update Checker/Skeptic to respect task policies
- 3.2: Update Hammer for artifact flexibility + phase awareness
- 3.3: Update Medic with healing per KPI type + retry awareness
- 3.4: Parallel agent spawning (Checker + Skeptic)

### Revised Phase 4: Commands & Hooks (Week 9)
- 4.1: Config-aware command implementations
- 4.2: Project-aware pre-commit with fast KPI filtering
- 4.3: `agency migrate-config` with subproject detection
- 4.4: File locking for shared state (VETO_LOG, telemetry)

### Revised Phase 5: Testing & Rollout (Week 10)
- 5.1: Test fixtures covering all flaws (15 scenarios)
- 5.2: Documentation updated with new config schema
- 5.3: Rollout with fallback to V16.0 behavior

---

## Conclusion

These 15 flaw simulations revealed that the initial design, while sound in principle, requires significant hardening:

- **Agent autonomy** must be truly configurable (SOUL updates critical)
- **Multi-stack** support is non-negotiable for real-world orgs
- **Long-running operations** need first-class phase model
- **Concurrency safety** requires file locking or run isolation
- **Dependency management** between KPIs must be expressible

The revised implementation order addresses these early to avoid rework. The enhanced design will deliver a truly universal, adaptive agency.

---

## Future Enhancements (Post-V17.0)
## Future Enhancements (Post-V17.0)

1. **Dynamic KPI Tuning**: ML-based threshold adjustment based on historical data
2. **Plugin System**: Third-party KPI plugins (e.g., `opencode-kpi-sonarqube`, `opencode-kpi-snyk`)
3. **Interactive Override**: When gate fails, agent suggests "Would you like to proceed with exception? [y/N]" for human-in-the-loop
4. **Config Diff Tool**: `agency config-diff` shows quality standard changes between branches
5. **Gate Visualization**: Dashboard shows which KPI took longest, suggestions to parallelize or cache

---

## Conclusion

This enhancement transforms OpenCode from a **prescriptive, single-stack tool** into a **universal, adaptive orchestration platform**. By moving quality gate definitions to the project side and enabling agents to read and adapt at runtime, we achieve:

- ✅ **Stack flexibility**: Any language, any toolchain
- ✅ **Task flexibility**: Hotfixes, spikes, migrations all have appropriate rigor
- ✅ **Speed**: Parallelization + skipped gates = 30-50% faster
- ✅ **Quality**: Contextual, meaningful checks instead of irrelevant defaults
- ✅ **Governance**: Hierarchical org policies prevent standard dilution
- ✅ **Backward compatible**: Existing projects migrate seamlessly

The key architectural shift: **from hardcoded dogma to configurable wisdom**.

---

## Appendix: Example Configs

### A. Rust API Service

```yaml
version: "1.0"
project:
  name: "rust-api"
  type: "rust"
kpis:
  - id: "tests"
    type: "command"
    command: "cargo test --all-targets -- --nocapture"
    timeout: 300
  - id: "coverage"
    type: "coverage"
    command: "cargo tarpaulin --output-format json --output-path coverage.json"
    extract_from: "coverage.json"
    threshold: 0.85
    timeout: 600
  - id: "lint"
    type: "command"
    command: "cargo clippy -- -D warnings"
    timeout: 120
  - id: "build"
    type: "command"
    command: "cargo build --release"
    timeout: 600
task_types:
  feature:
    require_red_green: true
  hotfix:
    require_red_green: false
    skip_lint: true
```

### B. Python ML Scripts

```yaml
version: "1.0"
project:
  name: "ml-pipeline"
  type: "python"
kpis:
  - id: "tests"
    type: "command"
    command: "pytest tests/ -v --tb=short"
    timeout: 300
  - id: "coverage"
    type: "coverage"
    command: "pytest --cov=src --cov-report=json"
    extract_from: "coverage.json"
    threshold: 0.80
  - id: "lint"
    type: "command"
    command: "ruff ."
    timeout: 60
  - id: "typecheck"
    type: "command"
    command: "mypy src/"
    timeout: 120
task_types:
  feature:
    require_red_green: true
  spike:
    require_red_green: false
    require_tests: false
```

### C. Bash Deployment Scripts

```yaml
version: "1.0"
project:
  name: "deploy-tooling"
  type: "bash"
kpis:
  - id: "shellcheck"
    type: "command"
    command: "shellcheck deploy/*.sh"
    timeout: 60
    allowed_failures: false
  - id: "bats"
    type: "command"
    command: "bats tests/"
    timeout: 120
task_types:
  feature:
    require_red_green: true  # but red/green can be .bats files
  hotfix:
    require_red_green: false
    skip_all_kpis: true  # urgent deploy, manual testing ok
patterns:
  red_test: ".run/red-*.bats"
  green_test: ".run/green-*.bats"
```

---

**End of Enhancement Plan**
