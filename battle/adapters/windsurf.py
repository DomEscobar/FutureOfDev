#!/usr/bin/env python3
"""Adapter stub for Windsurf."""
import json, sys

def simulate():
    return {"flow_architecture": 1.0, "proactive": 0.9, "code_quality": 0.86, "tokens": 4600, "time_sec": 8.2}

def main():
    payload = json.loads(sys.stdin.read())
    print(json.dumps(dict(payload, metrics=simulate(), status="completed")))

if __name__ == "__main__":
    main()
