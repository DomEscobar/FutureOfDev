#!/bin/bash
# Automatically sets scope from config.json
cd /root/FutureOfDev/opencode
export AGENCY_WORKSPACE=$(python3 -c \"import json; print(json.load(open('config.json'))['AGENCY_WORKSPACE'])\")
export TELEGRAM_BOT_TOKEN=$(python3 -c \"import json; print(json.load(open('config.json'))['TELEGRAM_BOT_TOKEN'])\")
export TELEGRAM_CHAT_ID=$(python3 -c \"import json; print(json.load(open('config.json'))['TELEGRAM_CHAT_ID'])\")
export APP_URL=$(python3 -c \"import json; print(json.load(open('config.json'))['APP_URL'])\")

nohup opencode run "Start the Executive Swarm: CEO, check SUGGESTIONS.md and delegate tasks to the PM. All units, notify via Telegram on every state change." --agent ceo --format json > agency.log 2>&1 &
echo "Agency started in background. Workspace: $AGENCY_WORKSPACE"
