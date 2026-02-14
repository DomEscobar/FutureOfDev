#!/usr/bin/env python3
"""
Advanced Report Generator with multi-factor weighted scoring.
"""
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import sys

ROOT = Path("/root/battle")
RUNS_DIR = ROOT / "runs"

WEIGHTS = {
    "Code Quality": 0.20,
    "Execution Loop": 0.20,
    "Memory/Context": 0.15,
    "Multi-file Understanding": 0.15,
    "Testing Capability": 0.10,
    "Refactoring": 0.10,
    "Latency/Throughput": 0.05,
    "Cost Efficiency": 0.05
}

def map_metrics_to_factors(category: str, metrics: dict) -> dict:
    """Map raw metrics to evaluation factors."""
    factors = {}

    # Code Quality
    if category == "A":
        factors["Code Quality"] = (metrics.get("correctness", 0) + metrics.get("style", 0)) / 2
    elif category == "B":
        factors["Code Quality"] = metrics.get("coherence", 0)
    elif category == "C":
        factors["Code Quality"] = metrics.get("pass_rate", 0)
    elif category == "D":
        factors["Code Quality"] = metrics.get("complexity_reduction", 0)
        factors["Refactoring"] = metrics.get("duplication_reduction", 0)  # partial
    elif category == "E":
        factors["Code Quality"] = metrics.get("test_quality", 0)
        factors["Testing Capability"] = metrics.get("coverage", 0)
    elif category == "F":
        factors["Code Quality"] = metrics.get("fix_correctness", 0)
        factors["Execution Loop"] = metrics.get("root_cause_accuracy", 0)
    elif category == "G":
        factors["Code Quality"] = metrics.get("recall_accuracy", 0)
        factors["Memory/Context"] = metrics.get("context_efficiency", 0)

    # Execution Loop (iterations: fewer is better)
    if "iterations" in metrics and category in ("C", "F"):
        iterations = metrics["iterations"]
        factors["Execution Loop"] = max(0, 1 - (iterations - 1) / 9)

    # Multi-file Understanding
    if category == "B" and "coupling" in metrics:
        factors["Multi-file Understanding"] = metrics["coupling"]

    # Testing Capability
    if category == "E" and "coverage" in metrics:
        factors["Testing Capability"] = metrics["coverage"]

    # Refactoring
    if category == "D":
        duplication = metrics.get("duplication_reduction", 0)
        if "Refactoring" in factors:
            factors["Refactoring"] = (factors["Refactoring"] + duplication) / 2
        else:
            factors["Refactoring"] = duplication

    # Store raw values for global normalization of latency/cost
    if "time_sec" in metrics:
        factors["_raw_time"] = metrics["time_sec"]
    if "tokens" in metrics:
        factors["_raw_tokens"] = metrics["tokens"]

    # Moat factors (optional for tie-breaking)
    for key in ("memory_persistence", "edit_efficiency", "native_integration", "agent_native",
                "spec_driven", "enterprise_ecosystem", "flow_architecture", "terminal_native",
                "compliance", "air_gapped", "frontier", "vendor_lockin_score"):
        if key in metrics:
            factors[key] = metrics[key]

    return factors

def normalize(values, invert=False):
    vals = [v for v in values if v is not None]
    if not vals:
        return lambda v: 0.5  # default neutral
    mn = min(vals)
    mx = max(vals)
    if mx == mn:
        return lambda v: 1.0
    norm = lambda v: (v - mn) / (mx - mn)
    if invert:
        return lambda v: 1 - norm(v)
    return norm

def compute_scores(results):
    # Collect per-factor values and raw values
    factor_raw_time = []
    factor_raw_tokens = []
    tool_factor_values = defaultdict(lambda: defaultdict(list))

    for r in results:
        tool = r["tool"]
        cat = r["category"]
        metrics = r["metrics"]
        factors = map_metrics_to_factors(cat, metrics)

        for factor, value in factors.items():
            if factor == "_raw_time":
                factor_raw_time.append(value)
            elif factor == "_raw_tokens":
                factor_raw_tokens.append(value)
            elif factor in WEIGHTS:
                tool_factor_values[tool][factor].append(value)

    # Build normalizers for latency and cost
    time_norm = normalize(factor_raw_time, invert=True)
    tokens_norm = normalize(factor_raw_tokens, invert=True)

    # For each tool, compute average per factor, then overall weighted score
    final_scores = {}
    factor_averages = {}

    for tool, fvals in tool_factor_values.items():
        # Compute average per factor
        avgs = {}
        for factor, values in fvals.items():
            avgs[factor] = sum(values) / len(values) if values else 0

        # Compute normalized latency and cost from this tool's raw data
        # We need the tool's raw times/tokens: aggregate from results
        times = [r["metrics"]["time_sec"] for r in results if r["tool"]==tool and "time_sec" in r["metrics"]]
        tokens = [r["metrics"]["tokens"] for r in results if r["tool"]==tool and "tokens" in r["metrics"]]
        if times:
            # Use mean of times for normalization
            mean_time = sum(times) / len(times)
            avgs["Latency/Throughput"] = time_norm(mean_time)
        else:
            avgs["Latency/Throughput"] = 0.5
        if tokens:
            mean_tokens = sum(tokens) / len(tokens)
            avgs["Cost Efficiency"] = tokens_norm(mean_tokens)
        else:
            avgs["Cost Efficiency"] = 0.5

        factor_averages[tool] = avgs

        # Weighted sum
        total = 0
        total_weight = 0
        for factor, weight in WEIGHTS.items():
            score = avgs.get(factor, 0)
            total += score * weight
            total_weight += weight
        final_scores[tool] = total / total_weight if total_weight > 0 else 0

    # Small moat bonus
    moat_bonus = {
        "roo-code": 0.02, "opencode": 0.02, "continue": 0.02, "cursor": 0.01,
        "factory": 0.01, "aider": 0.01, "kiro": 0.01, "copilot": 0.01,
        "windsurf": 0.01, "claude-code": 0.01, "qodo": 0.01, "tabnine": 0.01, "amp": 0.01
    }
    for t in final_scores:
        final_scores[t] += moat_bonus.get(t, 0)

    return final_scores, factor_averages

def main():
    if len(sys.argv) < 2:
        print("Usage: report_generator.py <run_id>")
        sys.exit(1)
    run_id = sys.argv[1]
    run_dir = RUNS_DIR / run_id
    with open(run_dir / "results.json") as f:
        results = json.load(f)

    final_scores, factor_avgs = compute_scores(results)
    ranked = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)

    # Print table
    print(f"\n=== Detailed Battle Results: {run_id} ===")
    print(f"Total results: {len(results)}\n")
    headers = list(WEIGHTS.keys())
    header_str = " | ".join(f"{h[:8]}" for h in headers)
    print(f"Rank | Tool               | Overall | {header_str}")
    print("-----|--------------------|---------|" + "-"*len(header_str))
    for i, (tool, score) in enumerate(ranked, 1):
        avgs = factor_avgs.get(tool, {})
        factor_strs = [f"{avgs.get(h, 0):.2f}" for h in headers]
        print(f"{i:4} | {tool:18} | {score:.3f}  | " + " | ".join(factor_strs))

    # Save detailed report
    report = {
        "run_id": run_id,
        "timestamp": datetime.utcnow().isoformat(),
        "overall_scores": final_scores,
        "factor_averages": factor_avgs,
        "results_count": len(results)
    }
    with open(run_dir / "report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nDetailed JSON saved to: {run_dir}/report.json")

if __name__ == "__main__":
    main()
