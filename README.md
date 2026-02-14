# Battle Benchmarking Workspace

## Purpose
Automated evaluation of AI code assistants (Top 13) using:
- Fully Automated mode (real execution)
- Simulation mode (synthetic)

## Structure
```
/battle/
├── harness/          # Core runner & orchestration
├── tests/            # Fixtures: codebases, tests, expected outputs
├── adapters/         # Tool-specific wrappers (one per assistant)
├── reports/          # Report generation & dashboard
├── shared/           # Common utilities, config, scoring
└── runs/             # Execution outputs (per run)
```

## Agents
- battle-harness (Node.js/Python runner)
- battle-tests (fixtures generation)
- battle-adapters (wrappers)
- battle-reports (JSON/HTML/CSV output)

## Run Modes
- `simulation`: Fast, rule-based mock LLM (no costs)
- `automated`: Real API calls, actual execution

## Output
- Per-tool JSON metrics
- Aggregated comparisons
- Visual dashboards
