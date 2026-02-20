#!/bin/bash
cd /root/FutureOfDev/opencode
# v1.2.9 fix: Plugins are now loaded via plugins.json automatically
LAUNCH_CMD="opencode run \"Start the Executive Swarm: CEO, check SUGGESTIONS.md and delegate tasks to the PM. All units, notify via Telegram on every state change.\" --agent ceo --format json"

nohup $LAUNCH_CMD > agency.log 2>&1 &
echo "Agency RESTARTED using plugins.json auto-load. Monitor logs with: tail -f agency.log"
