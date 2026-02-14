#!/usr/bin/env python3
"""Adapter stub for Tabnine."""
import json, sys

def simulate():
    return {"air_gapped": 1.0, "privacy": 1.0, "code_quality": 0.78, "tokens": 2600, "time_sec": 4.8}

def main():
    payload = json.loads(sys.stdin.read())
    print(json.dumps(dict(payload, metrics=simulate(), status="completed")))

if __name__ == "__main__":
    main()
