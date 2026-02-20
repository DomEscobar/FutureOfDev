#!/bin/bash
cd /root/FutureOfDev/opencode
# Running in background with nohup since --daemon is unsupported
nohup opencode run "Start the Executive Swarm: CEO, check SUGGESTIONS.md and delegate tasks to the PM. PM, sync to DEV_KANBAN.md. All units, follow the reactive workflow." --agent ceo --format json > agency.log 2>&1 &
echo "Agency started in background. Monitor logs with: tail -f agency.log"
