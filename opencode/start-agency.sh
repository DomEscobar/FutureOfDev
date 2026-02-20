#!/bin/bash
cd /root/FutureOfDev/opencode
# Force-injecting absolute plugin paths for v1.2.9 compatibility
LAUNCH_CMD="opencode run \"Start the Executive Swarm: CEO, check SUGGESTIONS.md and delegate tasks to the PM. PM, sync to DEV_KANBAN.md. All units, notify via Telegram on every state change.\" --agent ceo --format json --plugin /root/FutureOfDev/opencode/plugins/telegram-notifier.ts --plugin /root/FutureOfDev/opencode/plugins/event-triggers.ts"

nohup $LAUNCH_CMD > agency.log 2>&1 &
echo "Agency RESTARTED with Telegram and Event-Triggers. Monitor logs with: tail -f agency.log"
