#!/bin/bash
# Battle launcher: runs the benchmark in simulation or automated mode
set -e

MODE=${1:-simulation}
CONFIG="/root/battle/shared/config.json"

# Update config mode
jq ".mode = \"$MODE\"" "$CONFIG" > /tmp/config.json && mv /tmp/config.json "$CONFIG"

# Run harness
python3 /root/battle/harness/runner.py

# Generate report (pass latest run ID)
LATEST=$(ls -t /root/battle/runs | head -1)
python3 /root/battle/reports/generator.py "$LATEST"

echo "Battle complete. Report:"
echo "  /root/battle/runs/$LATEST/results.json"
echo "  Dashboard above."
