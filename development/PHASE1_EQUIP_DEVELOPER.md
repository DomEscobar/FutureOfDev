# Phase 1: Equip the Developer – KPI Assurance During Development

**Goal:** Configure OpenCode so that a developer automatically meets 3 KPIs *while developing* (not just at the end):
1. **Test Coverage** ≥ 80% on changed code
2. **Code Quality** – 0 lint/type errors
3. **Performance** – no regression >10% (backend: p95 latency; frontend: Lighthouse Performance)

And have an automated pre-commit gate that blocks commits if KPIs are not met.

---

## 1. OpenCode System Prompt & MCP Setup

OpenCode needs to *think* about these KPIs constantly. Configure it with a system prompt and expose tools via MCP servers.

### System Prompt (Go + Vue)

Add this to your OpenCode configuration (`.opencode/config.json` or similar):

```json
{
  "systemPrompt": "You are a Senior Full-Stack Engineer (Go + Vue).\n\nFor every code change, you must ensure these KPIs are met DURING development:\n\n1. TEST COVERAGE ≥ 80%\n   - Go: Write table-driven tests for every function. After writing, run `go test -cover` and report coverage %.\n   - Vue: Write component tests (Vitest + Vue Test Utils) covering all interactions. After writing, run `npm test -- --coverage` and report coverage %.\n   - Goal: coverage ≥ 80% on modified files. If not achieved, immediately write more tests until it is.\n\n2. CODE QUALITY\n   - Go: Run `golangci-lint run` and `go vet`. Must have 0 errors.\n   - Vue: Run `npm run lint` (ESLint) and `npm run type-check` (if TypeScript). Must have 0 errors.\n   - No TODOs/FIXMEs in production code.\n\n3. PERFORMANCE\n   - Go API endpoints: p95 latency must not exceed baseline +10%. After coding, run a quick k6 load test (10 VUs, 15s) and compare p95 to baseline.\n   - Vue: Lighthouse Performance score must stay >90 (or no drop >5 points). After build, run `npx lighthouse-ci` and report score.\n   - If regression: optimize immediately (query tuning, code-splitting, image optimization).\n\nWorkflow:\n- Implement feature\n- Run the 3 checks immediately\n- If any KPI fails, fix it BEFORE proceeding or suggesting commit\n- Only declare \"ready for PR\" when all KPIs are green.\n\nAlways show the actual metric values (coverage %, lint errors, p95 ms, Lighthouse score) after each check.",
  "mcpServers": {
    "coverage": "go test -cover; npm test -- --coverage",
    "quality": "golangci-lint run && go vet; npm run lint && npm run type-check",
    "perf": "k6 run load/affected.js; npx lighthouse-ci http://localhost:3000 --only-categories=performance"
  }
}
```

**Result:** OpenCode will continuously self-check against KPIs and report actual numbers.

---

## 2. Pre-Commit Hook – Automated Gate

Even with OpenCode, a final automatic check before commit is essential.

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
set -e

echo "🎯 Pre-Commit KPI Check (Go + Vue)"

STAGED=$(git diff --cached --name-only --diff-filter=ACM)
GO_FILES=$(echo "$STAGED" | grep '\.go$' || true)
VUE_FILES=$(echo "$STAGED" | grep -E '\.(vue|ts|js)$' || true)

FAIL=0

# === GO CHECKS ===
if [ -n "$GO_FILES" ]; then
  echo "\n🔧 Go Checks..."
  
  # Determine affected packages
  GO_PKGS=$(echo $GO_FILES | xargs -n1 dirname | sort -u | sed 's/^\.\///' | paste -sd, -)
  
  # 1. Coverage (target ≥ 80%)
  echo "📊 Coverage..."
  if [ -n "$GO_PKGS" ]; then
    go test $GO_PKGS -coverprofile=coverage.out -covermode=atomic
    COV=$(go tool cover -func=coverage.out | grep '^total:' | awk '{print $2}' | sed 's/%//')
    if (( $(echo "$COV < 80" | bc -l) )); then
      echo "❌ Coverage $COV% < 80% threshold"
      FAIL=1
    else
      echo "✅ Coverage: $Cov%"
    fi
  fi
  
  # 2. Quality: Lint + Vet
  echo "🔍 Quality..."
  golangci-lint run $GO_PKGS --out-format=short || FAIL=1
  go vet $GO_PKGS || FAIL=1
  
  # 3. Security: gosec (optional, warning only)
  if command -v gosec &> /dev/null; then
    echo "🛡️ Security scan..."
    gosec $GO_PKGS || echo "⚠️  gosec found issues (review required but not blocking)"
  fi
fi

# === VUE CHECKS ===
if [ -n "$VUE_FILES" ]; then
  echo "\n🎨 Vue Checks..."
  
  # 1. Lint
  echo "🔍 Lint..."
  npm run lint --if-present || FAIL=1
  
  # 2. Type Check (if TypeScript)
  if [ -f "tsconfig.json" ]; then
    echo "🔍 Type Check..."
    npm run type-check --if-present || FAIL=1
  fi
  
  # Note: Coverage & bundle checks are better in CI (slow). Pre-commit focuses on fast quality gates.
fi

# Final result
if [ $FAIL -eq 0 ]; then
  echo "\n✅ All KPI checks passed!"
  exit 0
else
  echo "\n❌ KPI checks failed. Fix issues before committing."
  exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## 3. Daily Developer Workflow

### Step 1: Task Assignment with KPI Constraints

When starting work, craft your OpenCode prompt to include KPI requirements:

**Backend example (Go):**
```
Implement function: `func ProcessOrder(order Order) (Order, error)`

Requirements:
- Validate order items (no negative quantity)
- Calculate total with tax
- Save to database
- Return processed order

KPI constraints:
- Write table-driven tests covering all paths (valid, validation error, DB error)
- Target: ≥ 80% coverage on this file
- Must pass: `golangci-lint` and `go vet` with 0 errors
- Performance: must not allocate excessively (use pprof briefly to check)
- After implementation, run the KPI checks and report the results.
```

### Step 2: OpenCode Generates and Validates

OpenCode will:
1. Generate function + tests
2. Simulate running the checks and report actual numbers:
   ```
   ✅ go test -cover: 94% coverage
   ✅ golangci-lint: 0 errors
   ✅ go vet: 0 errors
   ✅ Performance check: no excessive allocations (pprof ok)
   ```

If something fails (e.g., coverage 70%), OpenCode should automatically write more tests until the target is met.

### Step 3: Stage and Commit

```bash
git add process_order.go process_order_test.go
# pre-commit hook runs automatically
# → Should pass if OpenCode did its job
git commit -m "feat: order processing"
```

### Step 4: PR with KPI Evidence

OpenCode can generate a PR template snippet:

```markdown
## KPI Compliance

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test Coverage | 94% | ≥ 80% | ✅ |
| Lint Errors | 0 | 0 | ✅ |
| Vet Errors | 0 | 0 | ✅ |
| Performance p95 | 142ms | Baseline 130ms (+9.2%) | ✅ |

All KPIs verified locally.
```

---

## 4. If a KPI Fails – Immediate Fix Loop

### Coverage too low?
- **OpenCode prompt:** "Coverage is 70%. Add more test cases for the missing branches."
- OpenCode adds tests → coverage increases → good.

### Lint errors?
- **OpenCode prompt:** "Fix all lint errors (e.g., rename variables, remove unused imports)."
- OpenCode cleans up code → lint clean → good.

### Performance regression?
- **OpenCode prompt:** "p95 increased from 120ms to 180ms. Profiling shows N+1 query. Optimize by using JOIN or batch fetch."
- OpenCode optimizes → performance back within threshold → good.

**Principle:** Do not accept "good enough" from OpenCode. Require it to hit the thresholds. If it can't, it must explain why and suggest manual review.

---

## 5. Files to Create Now

1. **`.opencode/config.json`** – System prompt and MCP server definitions
2. **`.git/hooks/pre-commit`** – The automated gate (script above)
3. **`baseline.json`** – Current performance baselines (create manually):
   ```json
   {
     "endpoints": {
       "/api/orders": {"p95_ms": 120},
       "/api/products": {"p95_ms": 80}
     }
   }
   ```
4. (Optional) **`scripts/perf_check.sh`** – Helper to run k6 and compare to baseline

---

## 6. Vue Frontend Specifics

For Vue components, the pre-commit hook currently only does lint/type (fast). Coverage and Lighthouse are slower and better suited for CI.

But during development with OpenCode:
- Prompt: "Write component with ≥ 80% coverage and Lighthouse Performance > 90"
- OpenCode should generate tests and run `npm test -- --coverage` and `npx lighthouse-ci`
- Report numbers before declaring done

Pre-commit skips heavy checks to keep commit fast. CI will catch coverage/Lighthouse.

---

## Summary

**Phase 1 Setup Checklist:**
- [ ] Create `.opencode/config.json` with system prompt
- [ ] Create `.git/hooks/pre-commit` and `chmod +x`
- [ ] Create `baseline.json` with current performance metrics
- [ ] Test workflow: implement a small change with OpenCode, verify KPI numbers, ensure pre-commit passes

**Developer Routine:**
1. Prompt OpenCode with KPI constraints
2. OpenCode implements and reports actual metric values
3. If any KPI fails → ask OpenCode to fix immediately
4. Stage files → pre-commit runs → should pass
5. Commit and PR

You now have a **KPI-safe development loop** where the AI actively works to meet your quality gates *as it codes*.

---

## Next: Phase 2 – CI Integration

Phase 2 will wire the same KPI checks into your CI/CD pipeline (GitHub Actions/GitLab CI) so every PR automatically re-verifies the 3 KPIs, regardless of what the developer or OpenCode claimed. It will also add post-merge monitoring and feedback loops to continuously improve baseline metrics and OpenCode's prompts based on production outcomes.