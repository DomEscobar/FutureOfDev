# Backend Implementation Steps (AI-Centric)
**Query Optimizer Tool — Built by OpenCode Agents from Day 1**

**Core Principle:** You do NOT manually write `analyzer.go`. You task OpenCode to build the tool itself using your project context.

---

## 🚀 Phase 0: Forge Bootstrap (Day 1)

### Step 0.1: Fork & Initialize OpenCode
```bash
git clone https://github.com/anomalyco/opencode.git ~/.opencode
cd ~/.opencode && npm install
```

### Step 0.2: Create "Forge Builder" Agent
**File:** `.opencode/agents/forge-builder.md`
```yaml
description: Builds and maintains project-specific meta-tools (Go/C# backend focus)
mode: subagent
tools:
  bash: true
  write: true
  read: true
permission:
  bash:
    "go *": allow
    "dotnet *": allow
    "git *": allow
prompt: |
  You are the Forge Builder. Your mission: create self-optimizing tools for this Go + C# backend.

  First task: Build a "Query Optimizer" tool under `tools/query-audit/` that:

  1. INSTRUMENTATION (Go):
     - Wrap `database/sql` or GORM to log queries with timestamps to JSON lines
     - Output format: `{"query":"...","duration_ms":123,"stack":"..."}`
  2. INSTRUMENTATION (C#):
     - Add `DbCommandInterceptor` that logs SQL + execution time
     - Output same JSON format to stdout during tests
  3. ANALYZER (Go):
     - Read JSON logs; detect N+1 (same query repeated > 3 times in same stack trace)
     - Detect seq scans by looking for "Seq Scan" in `EXPLAIN` output (if available)
  4. ANALYZER (C#):
     - Group queries by stack trace; flag N+1
     - Check for `WITH (NOLOCK)` or missing index hints
  5. REPORT:
     - Generate markdown with: file location, stack trace, suggested fix (JOIN/Index)
  6. CI INTEGRATION:
     - Sample GitHub Action that runs tests, pipes logs to analyzer, comments on PR

  Write all files. Do not ask questions — infer exact implementation from best practices.
```

---

## 🤖 Phase 1: AI Builds the Tool (Week 1)

### Step 1.1: Execute Forge Builder
```bash
opencode --agent forge-builder "Build the Query Optimizer tool now"
```

**What happens:** OpenCode writes:
- `tools/query-audit/instrumentation.go`
- `tools/query-audit/analyzer.go`
- `tools/query-audit/instrumentation.cs`
- `tools/query-audit/Analyzer.cs`
- `.github/workflows/query-audit.yml`
- `README.md` for the tool

### Step 1.2: Test the Generated Tool
```bash
# Go
go test ./... -v 2>&1 | go run tools/query-audit/analyzer.go > audit-report.md

# C#
dotnet test --logger "console" 2>&1 | dotnet run --project tools/query-audit/Analyzer.csproj > audit-report.md
```

**If issues:** Task OpenCode to fix them:
```bash
opencode --agent forge-builder "Fix analyzer: N+1 detection false positive on parameterized queries"
```

---

## 🔍 Phase 2: AI Harvests Real Friction (Week 2)

### Step 2.1: Create "Friction Harvester" Agent
**File:** `.opencode/agents/friction-harvester.md`
```yaml
description: Discovers actual backend friction by running tests and analyzing code patterns
mode: subagent
tools:
  bash: true
  read: true
prompt: |
  You are the Friction Harvester.

  Tasks:
  1. Run the Query Optimizer tool on the current codebase
  2. Scan for other repetitive backend patterns:
     - Manual retry logic on DB calls
     - Hardcoded connection strings
     - Missing context cancellation propagation
  3. Generate FRICTION_LOG.md with:
     - Issue description
     - Frequency (how many times it appears)
     - Estimated automation time saved
     - Recommended next meta-tool to build

  Output a structured markdown log. Prioritize frictions that appear in > 3 files.
```

### Step 2.2: Run Harvester
```bash
opencode --agent friction-harvester "Analyze the backend and produce FRICTION_LOG.md"
```

**Result:** `FRICTION_LOG.md` is AI-generated, based on *actual* signals in your code.

---

## 🛠 Phase 3: AI Builds the First Meta-Tool (Week 3)

### Step 3.1: Review `FRICTION_LOG.md`
Look for the top item. Example:
```
[HIGH] N+1 queries in UserRepository (5 occurrences) - 2 hours/week spent
[HIGH] Missing index on orders.created_at (3 queries, avg 2s) - 30 min/debug
[MED] Manual retry logic duplicated in 6 services - 1 hour/week
```

### Step 3.2: Task "Tool Smith" Agent
**File:** `.opencode/agents/tool-smith.md`
```yaml
description: Builds one meta-tool based on priority from FRICTION_LOG.md
mode: subagent
tools:
  bash: true
  write: true
prompt: |
  You are the Tool Smith. Read FRICTION_LOG.md and build the #1 priority meta-tool.

  For "N+1 queries":
    - Enhance the Query Optimizer to auto-suggest .Include() (C#) or JOIN (Go)
    - Generate code snippets that can be copy-pasted into PRs
    - Add a "quick-fix" script that rewrites simple N+1 patterns automatically

  Write all files under `tools/` with a clear README.md explaining usage.
```

Execute:
```bash
opencode --agent tool-smith "Build the top priority tool from FRICTION_LOG.md"
```

---

## 🤖 Phase 4: Autonomous Swarm (Week 4+)

### Step 4.1: Deploy as Sub-Agent
Once `tools/query-audit/` is stable, wrap it as an autonomous agent:

**File:** `.opencode/agents/query-optimizer-agent.md`
```yaml
description: Runs query optimization checks on every PR
mode: subagent
schedule:
  on: [pull_request]
tools:
  bash: true
  comment: true
prompt: |
  On each PR:
  1. Run the analyzer (go test | analyzer or dotnet test | analyzer)
  2. If issues found, post a PR comment with the report and suggested fixes
  3. If clean, approve with "✅ Query audit passed"
```

### Step 4.2: Let It Run Autonomously
Now the agent runs on every PR. It writes its own logs, detects new frictions, and can even **task itself** to improve:

**Meta-loop:** If the agent sees the same error pattern 3 times, it can:
1. Open an issue: "Auto-optimization needed for pattern X"
2. Propose a code change to its own logic
3. Create a PR to improve itself

---

## 📊 Success Metrics (AI-Driven)

| Metric | Target | How to Measure |
| :--- | :--- | :--- |
| **Tools Built** | 1 per week | Count in `tools/` |
| **Time Saved** | 3+ hours/week | FRICTION_LOG.md impact column |
| **Auto-Fix Rate** | 50% of issues self-resolved | Agent PRs created vs. manual |
| **Self-Improvement Cycles** | 1 per tool per month | Agent-initiated PRs to own code |

---

## 🎯 The "Forge-First" Mindset (Backend Edition)

**You are not a user of OpenCode.** You are a **director of agents** that build your development environment.

- Week 1: `forge-builder` writes your tools.
- Week 2: `friction-harvester` finds real problems.
- Week 3: `tool-smith` builds solutions autonomously.
- Week 4+: Sub-agents run and **improve themselves**.

**No manual `analyzer.go` exists.** It was all generated by AI using your project's context.

**Start now:** Create `.opencode/agents/forge-builder.md` and run it. [[reply_to_current]]
