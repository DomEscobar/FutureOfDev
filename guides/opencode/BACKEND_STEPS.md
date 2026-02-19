# Backend Implementation Steps: Query Optimizer (Go & C#)

**Goal:** Build a meta-tool that catches N+1 queries and missing indexes before code reaches staging.

---

## 🎯 Phase 1: Signal Detection (Week 1)

### Step 1.1: Instrument Query Logging
**Go:**
```bash
# Create tools/query-audit/instrumentation.go
# Wrap your DB driver to log all queries with timestamps
# Output: JSON lines to stdout during tests
```

**C#:**
```bash
# Add a diagnostic listener in Program.cs
# Use Microsoft.Extensions.Logging to capture DbCommand execution
# Filter: Only log during TEST environment
```

### Step 1.2: Create the Baseline Friction Log
```bash
# Run your integration test suite with instrumentation enabled
go test ./... -v 2>&1 | tools/query-audit/parse-logs.go > FRICTION_LOG.md
# OR
dotnet test --logger "console;verbosity=detailed" 2>&1 | tools/query-audit/parse-logs.ps1 > FRICTION_LOG.md
```

**Deliverable:** `FRICTION_LOG.md` with entries like:
```
[2026-02-19 14:30] UserRepository.FindByEmail - 15 queries (N+1 on posts)
[2026-02-19 14:32] OrderService.GetDetails - seq scan on orders (cost: 4500)
```

---

## 🔧 Phase 2: Tool Build (Week 2)

### Step 2.1: Query Analysis Engine
**Go** (`tools/query-audit/analyzer.go`):
```go
package main

import (
    "encoding/json"
    "os"
)

type QueryLog struct {
    Query      string `json:"query"`
    DurationMs int    `json:"duration_ms"`
    stackTrace string `json:"stack_trace,omitempty"`
}

func main() {
    // Read JSON lines from stdin
    // Detect N+1: Count identical queries within same stack trace
    // Detect seq scan: Look for "Seq Scan" in EXPLAIN output
    // Output: Markdown report
}
```

**C#** (`tools/query-audit/Analyzer.cs`):
```csharp
using System.Text.Json;

var logs = JsonSerializer.Deserialize<List<QueryLog>>(Console.In.ReadToEnd());
foreach (var group in logs.GroupBy(q => q.StackTrace)) {
    if (group.Count() > 5) {
        Console.WriteLine($"N+1 detected: {group.Key} - {group.Count()} queries");
    }
}
```

### Step 2.2: CI Integration
**.github/workflows/query-audit.yml**:
```yaml
name: Query Audit
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests with instrumentation
        run: |
          go test ./... -v 2>&1 | tools/query-audit/analyzer.go > audit-report.md
          # OR for C#
          dotnet test --logger "console" 2>&1 | tools/query-audit/analyzer.cs > audit-report.md
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const report = require('fs').readFileSync('audit-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🔍 Query Audit\n${report}`
            });
```

---

## 🤖 Phase 3: Auto-Fix Suggestions (Week 3)

### Step 3.1: Suggestion Engine
Enhance the analyzer to output **actionable fixes**:
- For N+1: Suggest `.Include()` (C#) or `Joins` (Go) with example code.
- For seq scan: Suggest `CREATE INDEX` DDL specific to your DB.

**Output format:**
```markdown
### N+1 Query Detected
File: `repositories/user_repository.go:45`
Stack: `FindByEmail -> GetPosts`
Fix: Use a JOIN instead of looping queries.
```sql
SELECT u.*, p.* FROM users u LEFT JOIN posts p ON p.user_id = u.id WHERE u.email = ?
```

### Step 3.2: Pre-commit Hook (Optional)
`.git/hooks/pre-commit`:
```bash
#!/bin/bash
go test ./... -v 2>&1 | tools/query-audit/analyzer.go > /tmp/audit.md
if grep -q "N+1 detected" /tmp/audit.md; then
  echo "❌ Query issues found. Fix before commit."
  cat /tmp/audit.md
  exit 1
fi
```

---

## 🧠 Phase 4: Sub-Agent Integration (Week 4)

### Step 4.1: Create `@query-optimizer` Agent
**`.opencode/agents/query-optimizer.md`**:
```yaml
description: Analyzes PRs for N+1 queries and missing indexes
mode: subagent
tools:
  bash: true
permission:
  bash:
    "go test *": allow
    "dotnet test *": allow
prompt: |
  You are the Query Optimizer. For each PR:
  1. Run the full test suite with instrumentation.
  2. Generate an audit report.
  3. If issues found, reply with "FAIL: [issues]".
  4. If clean, reply with "PASS".
```

### Step 4.2: Auto-Invoke on PRs
**GitHub Action** (`.github/workflows/query-optimizer.yml`):
```yaml
- name: Run Query Optimizer Agent
  run: |
    opencode --config .opencode/query-optimizer.json \
      "Analyze PR #${{ github.event.pull_request.number }} for query issues"
```

---

## 📊 Success Metrics

| Metric | Target (Week 4) | How to Measure |
| :--- | :--- | :--- |
| **Logging Coverage** | 100% of DB access | Count instrumented vs. total repos |
| **False Positive Rate** | < 10% | Manual review of flagged issues |
| **Discovery Speed** | < 5 min per PR | CI job duration |
| **Adoption** | 80% of PRs pass first run | GitHub Action runs |

---

## 🚀 Next Steps After Query Optimizer

1. **Schema Drift Detective** (detects DB migration mismatches)
2. **Dependency Orbit Tracker** (security updates for Go modules/NuGet)
3. **Build Cache Warmer** (CI optimization for Go builds)

**Ready to implement?** Start with Step 1.1 and commit the instrumentation.
