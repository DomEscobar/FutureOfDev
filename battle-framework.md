# Battle Benchmarking Framework

## Overview
This framework benchmarks AI code assistants across two modes:
- **Fully Automated**: Real execution against a live codebase with tests
- **Simulation**: Synthetic scenarios and predefined evaluation criteria

## Top 13 Tools (Pinned)
1. Roo Code
2. OpenCode
3. Continue
4. Cursor
5. Factory
6. Aider
7. Kiro
8. GitHub Copilot
9. Windsurf
10. Claude Code
11. Qodo Gen
12. Tabnine
13. Amp

## Battle Factors (Evaluation Dimensions)

### Primary Factors (Weighted)
1. **Code Quality** (20%) – Accuracy, readability, maintainability
2. **Execution Loop** (20%) – Write-run-fix cycle success & speed
3. **Memory/Context** (15%) – Context window utilization, drift resistance
4. **Multi-file Understanding** (15%) – Cross-file references, project cognition
5. **Testing Capability** (10%) – Test generation, bug detection, E2E
6. **Refactoring** (10%) – Code improvement, debt reduction
7. **Latency/Throughput** (5%) – Response time, tokens/sec
8. **Cost Efficiency** (5%) – Tokens per task, cost per successful fix

### Secondary Factors
9. **Security Awareness** – Input validation, secure patterns
10. **Documentation** – Auto-generated docs, comments
11. **Integration** – CI/CD, IDE, workflow hooks
12. **Enterprise Features** – SSO, audit, compliance

## Test Suite

### Category A: Single-File Generation
- **Task**: Implement a specific function with given signature
- **Evaluation**: Correctness (unit tests), style, edge cases
- **Tools**: All (API-based generation)

### Category B: Multi-File Feature
- **Task**: Add a feature touching 3+ files (e.g., auth middleware, API endpoint)
- **Evaluation**: Coherence, file coupling, proper imports
- **Tools**: Agents capable of project-wide changes

### Category C: Bug Fix (Write-Run-Fix)
- **Task**: Provided a broken test suite; fix the code
- **Evaluation**: Pass rate, number of iterations, time to fix
- **Tools**: Execution-loop capable (OpenCode, Aider, Claude, Cursor, Roo, Continue)

### Category D: Refactoring
- **Task**: Legacy code with smells; improve design without breaking tests
- **Evaluation**: Metrics (cyclomatic complexity, duplication), test pass
- **Tools**: All (some better than others)

### Category E: Test Generation
- **Task**: From a function spec, generate comprehensive tests (unit + edge)
- **Evaluation**: Coverage (statement/branch), test quality, false positives
- **Tools**: All

### Category F: Self-Healing (Advanced)
- **Task**: Given a failing integration test, diagnose and fix
- **Evaluation**: Root cause identification, fix correctness, iteration count
- **Tools**: Advanced agents only (Roo, OpenCode, Factory, Amp)

### Category G: Memory/Context Stress
- **Task**: Long-running project; ask questions about code written 20 steps ago
- **Evaluation**: Accuracy of recall, context window efficiency
- **Tools**: Memory-aware (Roo, Cursor, Continue with memory)

## Execution Model

### Fully Automated Mode
1. **Environment**: Isolated Docker container per tool
2. **Orchestration**: Main script spawns parallel agent processes
3. **Instrumentation**: Logging hooks capture:
   - Prompt sent to LLM
   - Code diffs
   - Test results (before/after)
   - Token usage
   - Wall-clock time
   - Iteration counts
4. **Scoring**: Automated scoring based on pass/fail and metrics
5. **Cleanup**: Temporary workspaces destroyed after each run

### Simulation Mode
1. **Synthetic Data**: Pre-canned scenarios with known expected outputs
2. **Mock LLM**: Use a lightweight model or rule-based evaluator
3. **Speed**: Fast iteration; no real API costs
4. **Goal**: Validate scoring rubrics and test harness

## Output
- JSON report per tool per category
- Aggregated CSV/Excel for comparison
- Visual dashboards (radar charts, bar graphs)
- Detailed logs for qualitative review

## Next Actions
1. Create `/battle` directory structure
2. Write test suite fixtures (codebases, tests, expected outputs)
3. Build the core benchmark runner (Python/Node)
4. Implement per-tool adapters (wrappers to invoke each assistant)
5. Set up sub-agents for parallel execution
6. Run simulation mode first, then automated

Should I proceed to bootstrap the `/battle` directory and initial commit? [[reply_to_current]]
