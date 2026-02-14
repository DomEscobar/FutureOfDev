# FutureOfDev Battle Benchmark

Canonical structure for AI code assistant benchmarking.

```
battle/
├── shared/
│   └── config.json        # Full config: test suite, tools, weights, strategic_multipliers
├── adapters/              # Per‑tool adapter wrappers (Python)
│   ├── aider.py
│   ├── continue.py
│   ├── opencode.py
│   └── ...
├── docs/                  # Dossiers, methodology, outcomes, swarm meta
│   ├── BATTLE_FORENSIC_EVIDENCE.md
│   ├── BATTLE_OUTCOMES_v1.md
│   ├── DOSSIER_AIDER.md
│   ├── DOSSIER_ROO_CODE.md
│   ├── RESEARCH_METHODOLOGY.md
│   ├── SOVEREIGNTY_LOG.md
│   └── SWARM_META_2026.md
└── runs/                  # Individual test executions (timestamped)

reports/
└── final_rankings.json   # Aggregated leaderboard with scores & archetypes

harness/
└── runner.py             # Orchestration script
```

**Key files**
- `battle/shared/config.json` — single source of truth for test suite, tool adapters, weights, and strategic multipliers.
- `reports/final_rankings.json` — final ranking after applying weighted metrics + forensic adjustments.
- `tool-list.md` — quick reference of moats for all contenders.

**Notes**
- Adapter paths in config are relative to `battle/shared/` (`./adapters/<tool>.py`).
- Duplicate `/shared/config.json` and `/docs` removed; canonical location is under `battle/`.
- Results from multiple runs are archived under `runs/<timestamp>/`.
