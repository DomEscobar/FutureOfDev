#!/usr/bin/env python3
"""Adapter stub for Cursor."""
import json, sys

def simulate():
    return {"native_integration": 1.0, "code_quality": 0.90, "tokens": 3800, "time_sec": 6.5}

def main():
    payload = json.loads(sys.stdin.read())
    print(json.dumps(dict(payload, metrics=simulate(), status="completed")))

if __name__ == "__main__":
    main()
