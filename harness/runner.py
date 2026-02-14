#!/usr/bin/env python3
"""
Battle Harness: Orchestrates AI code assistant benchmarking.
"""

import os
import sys
import json
import subprocess
import time
import uuid
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

ROOT = Path("/root/battle")
CONFIG = ROOT / "shared" / "config.json"
RUNS_DIR = ROOT / "runs"

def load_config():
    with open(CONFIG) as f:
        return json.load(f)

def ensure_dirs():
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

def run_simulation(adapter_path: str, test_category: str, test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Run a single test case in simulation mode (mock LLM) with tool-specific profiles."""
    result = {
        "tool": Path(adapter_path).stem,
        "category": test_category,
        "test_id": test_case["id"],
        "mode": "simulation",
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": {}
    }

    tool_name = Path(adapter_path).stem

    # Performance profiles (0-1 scale) aligned with moats
    profiles = {
        "roo-code": {"cq": 0.88, "ex": 0.85, "mc": 0.80, "mem": 0.95, "test": 0.78, "ref": 0.75, "lat": 0.9, "tok": 0.85},
        "opencode": {"cq": 0.85, "ex": 0.92, "mc": 0.78, "mem": 0.70, "test": 0.75, "ref": 0.72, "lat": 0.85, "tok": 0.90},
        "continue": {"cq": 0.82, "ex": 0.75, "mc": 0.76, "mem": 0.72, "test": 0.80, "ref": 0.70, "lat": 0.80, "tok": 0.95},
        "cursor": {"cq": 0.90, "ex": 0.80, "mc": 0.85, "mem": 0.75, "test": 0.82, "ref": 0.78, "lat": 0.92, "tok": 0.88},
        "factory": {"cq": 0.85, "ex": 0.82, "mc": 0.92, "mem": 0.78, "test": 0.80, "ref": 0.80, "lat": 0.88, "tok": 0.86},
        "aider": {"cq": 0.80, "ex": 0.95, "mc": 0.77, "mem": 0.65, "test": 0.76, "ref": 0.68, "lat": 0.96, "tok": 0.98},
        "kiro": {"cq": 0.84, "ex": 0.78, "mc": 0.80, "mem": 0.72, "test": 0.85, "ref": 0.85, "lat": 0.86, "tok": 0.89},
        "copilot": {"cq": 0.82, "ex": 0.70, "mc": 0.80, "mem": 0.60, "test": 0.75, "ref": 0.65, "lat": 0.90, "tok": 0.87},
        "windsurf": {"cq": 0.86, "ex": 0.78, "mc": 0.88, "mem": 0.76, "test": 0.80, "ref": 0.76, "lat": 0.84, "tok": 0.85},
        "claude-code": {"cq": 0.88, "ex": 0.85, "mc": 0.82, "mem": 0.74, "test": 0.83, "ref": 0.77, "lat": 0.87, "tok": 0.84},
        "qodo": {"cq": 0.84, "ex": 0.72, "mc": 0.78, "mem": 0.70, "test": 0.90, "ref": 0.82, "lat": 0.85, "tok": 0.86},
        "tabnine": {"cq": 0.78, "ex": 0.60, "mc": 0.70, "mem": 0.55, "test": 0.68, "ref": 0.60, "lat": 0.95, "tok": 0.97},
        "amp": {"cq": 0.88, "ex": 0.86, "mc": 0.84, "mem": 0.76, "test": 0.82, "ref": 0.78, "lat": 0.89, "tok": 0.88}
    }

    p = profiles.get(tool_name, {"cq": 0.75, "ex": 0.75, "mc": 0.75, "mem": 0.75, "test": 0.75, "ref": 0.75, "lat": 0.85, "tok": 0.85})

    start = time.time()
    noise = lambda x: max(0, min(1, x + random.uniform(-0.03, 0.03)))

    if test_category == "A":
        result["metrics"] = {
            "correctness": noise(p["cq"] * 0.9),
            "style": noise(p["cq"] * 0.85),
            "tokens": int(1000 + (1-p["tok"])*4000 + random.uniform(-200, 200)),
            "iterations": 1,
            "time_sec": 1.5 + (1-p["lat"])*3 + random.uniform(-0.3, 0.3)
        }
    elif test_category == "B":
        result["metrics"] = {
            "coherence": noise(p["mc"] * 0.8),
            "coupling": noise(p["mc"] * 0.75),
            "tokens": int(3000 + (1-p["tok"])*3000 + random.uniform(-300, 300)),
            "iterations": max(1, int((1-p["ex"])*4 + 1)),
            "time_sec": 5 + (1-p["lat"])*5 + random.uniform(-0.5, 0.5)
        }
    elif test_category == "C":
        result["metrics"] = {
            "pass_rate": noise(p["ex"] * 0.7),
            "iterations": max(1, int((1-p["ex"])*6 + 2)),
            "tokens": int(5000 + (1-p["tok"])*6000 + random.uniform(-400, 400)),
            "time_sec": 8 + (1-p["lat"])*12 + random.uniform(-1, 1)
        }
    elif test_category == "D":
        result["metrics"] = {
            "complexity_reduction": noise(p["ref"] * 0.6),
            "duplication_reduction": noise(p["ref"] * 0.5),
            "tokens": int(2000 + (1-p["tok"])*2000 + random.uniform(-200, 200)),
            "time_sec": 4 + (1-p["lat"])*4 + random.uniform(-0.4, 0.4)
        }
    elif test_category == "E":
        result["metrics"] = {
            "coverage": noise(p["test"] * 0.85),
            "test_quality": noise(p["test"] * 0.8),
            "tokens": int(1500 + (1-p["tok"])*2000 + random.uniform(-150, 150)),
            "time_sec": 3 + (1-p["lat"])*3 + random.uniform(-0.3, 0.3)
        }
    elif test_category == "F":
        result["metrics"] = {
            "root_cause_accuracy": noise(p["ex"] * 0.6),
            "fix_correctness": noise(p["ex"] * 0.65),
            "iterations": max(3, int((1-p["ex"])*8 + 4)),
            "tokens": int(8000 + (1-p["tok"])*8000 + random.uniform(-500, 500)),
            "time_sec": 12 + (1-p["lat"])*18 + random.uniform(-2, 2)
        }
    elif test_category == "G":
        result["metrics"] = {
            "recall_accuracy": noise(p["mem"] * 0.75),
            "context_efficiency": noise(p["mem"] * 0.8),
            "tokens": int(3000 + (1-p["tok"])*3000 + random.uniform(-300, 300)),
            "time_sec": 5 + (1-p["lat"])*7 + random.uniform(-0.5, 0.5)
        }
    else:
        result["metrics"] = {"score": 0.5}

    result["elapsed_sec"] = time.time() - start
    return result

def run_automated(adapter_path: str, test_category: str, test_case: Dict[str, Any], workspace: Path) -> Dict[str, Any]:
    """Run a single test case in fully automated mode."""
    result = {
        "tool": Path(adapter_path).stem,
        "category": test_category,
        "test_id": test_case["id"],
        "mode": "automated",
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": {}
    }

def run_automated(adapter_path: str, test_category: str, test_case: Dict[str, Any], workspace: Path) -> Dict[str, Any]:
    """Run a single test case in fully automated mode."""
    result = {
        "tool": Path(adapter_path).stem,
        "category": test_category,
        "test_id": test_case["id"],
        "mode": "automated",
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": {}
    }

    tool_name = Path(adapter_path).stem
    print(f"Running {tool_name} in automated mode for {test_case['id']}...")

    try:
        # Prepare arguments for the adapter script
        test_case_json = json.dumps(test_case)
        # The adapter script is expected to be runnable with `python3 adapter_path --test_case '...'`
        command = ["python3", adapter_path, "--test_case", test_case_json]

        # Execute the adapter script
        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True, # Raise exception if command fails
            cwd=workspace, # Execute in the tool's specific workspace directory
            timeout=600 # Set a timeout for the execution (10 minutes)
        )
        adapter_output = json.loads(process.stdout)

        result["metrics"] = adapter_output.get("metrics", {})
        result["elapsed_sec"] = adapter_output.get("elapsed_sec", 0)
        # Ensure tool name is correctly set, using stem of adapter_path, which is the tool name
        result["tool"] = tool_name

    except FileNotFoundError:
        result["metrics"] = {"error": f"Adapter script not found at {adapter_path}"}
        result["elapsed_sec"] = 0
        print(f"Error: Adapter script not found: {adapter_path}")
    except subprocess.CalledProcessError as e:
        result["metrics"] = {"error": f"Adapter script failed with exit code {e.returncode}: {e.stderr}", "return_code": e.returncode}
        result["elapsed_sec"] = 0
        print(f"Error running adapter {adapter_path}: {e.stderr}")
    except json.JSONDecodeError:
        result["metrics"] = {"error": f"Adapter script did not return valid JSON"}
        result["elapsed_sec"] = 0
        print(f"Invalid JSON output from {adapter_path}:\n{process.stdout}")
    except Exception as e:
        result["metrics"] = {"error": f"An unexpected error occurred: {str(e)}"}
        result["elapsed_sec"] = 0
        print(f"Unexpected error during adapter execution for {adapter_path}: {str(e)}")

    return result

def main():
    """Main orchestration loop."""
    ensure_dirs()
    config = load_config()
    tools = config["tools"]
    categories = config["categories"]
    test_suite = config["test_suite"]

    run_id = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    all_results = []

    for tool in tools:
        adapter = tool["adapter"]
        for cat in categories:
            cat_name = cat["name"]
            test_cases = [tc for tc in test_suite if tc["category"] == cat_name]
            for tc in test_cases:
                print(f"Running {tool['name']} on {cat_name} test {tc['id']}...")
                if config["mode"] == "simulation":
                    res = run_simulation(adapter, cat_name, tc)
                else:
                    res = run_automated(adapter, cat_name, tc, run_dir / "workspaces" / tool['name'])
                all_results.append(res)

                # Save individual result
                result_file = run_dir / f"{tool['name']}_{cat_name}_{tc['id']}.json"
                with open(result_file, "w") as f:
                    json.dump(res, f, indent=2)

    # Save aggregated results
    with open(run_dir / "results.json", "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"Battle run {run_id} complete. Results in {run_dir}")

if __name__ == "__main__":
    main()
