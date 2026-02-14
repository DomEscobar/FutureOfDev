#!/usr/bin/env python3
"""Adapter stub for Factory (Droids)."""
import json, sys

def simulate():
    return {"agent_native": 1.0, "multi_platform": 1.0, "code_quality": 0.85, "tokens": 5200, "time_sec": 9.0}

def main():
    payload = json.loads(sys.stdin.read())
    print(json.dumps(dict(payload, metrics=simulate(), status="completed")))

if __name__ == "__main__":
    main()
