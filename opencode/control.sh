#!/bin/bash
# Central Control Script for OpenCode Agency
# Rewritten to remove infinite loops and instead use an event-driven architecture.

AGENCY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN=$(grep TELEGRAM_BOT_TOKEN "$AGENCY_ROOT/config.json" | cut -d'"' -f4 || echo "")
CHAT_ID=$(grep TELEGRAM_CHAT_ID "$AGENCY_ROOT/config.json" | cut -d'"' -f4 || echo "")
LOG_FILE="$AGENCY_ROOT/agency.log"
TASKS_FILE="$AGENCY_ROOT/tasks.json"

send_tg() {
    if [ -n "$TOKEN" ] && [ -n "$CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" \
            -d "chat_id=$CHAT_ID" \
            -d "text=$1" > /dev/null
    fi
}

run_monitor() {
    # Initialize tasks.json if it doesn't exist
    if [ ! -f "$TASKS_FILE" ]; then
        echo '{"tasks":[],"agency_state":{"status":"IDLE","last_audit":null}}' > "$TASKS_FILE"
    fi

    send_tg "👁️ *AGENCY EVENT MONITOR STARTED*
Time: $(date +%H:%M:%S)
Status: Listening for JSON state changes."

    last_checksum=$(stat -c %Y "$TASKS_FILE" 2>/dev/null || echo 0)
    last_sug_checksum=$(stat -c %Y "$AGENCY_ROOT/SUGGESTIONS.md" 2>/dev/null || echo 0)

    while true; do
        current_checksum=$(stat -c %Y "$TASKS_FILE" 2>/dev/null || echo 0)
        current_sug_checksum=$(stat -c %Y "$AGENCY_ROOT/SUGGESTIONS.md" 2>/dev/null || echo 0)
        
        # If tasks.json changes, run the state machine evaluation
        if [ "$current_checksum" != "$last_checksum" ]; then
            last_checksum=$current_checksum
            echo "[$(date)] tasks.json changed, evaluating triggers..." >> "$LOG_FILE"
            # In a real node app this would be a long-running process
            # For this bash harness we can just invoke a script that checks state
            node "$AGENCY_ROOT/scripts/evaluate-state.js" >> "$LOG_FILE" 2>&1
        fi

        # If SUGGESTIONS.md changes, trigger CEO to review
        if [ "$current_sug_checksum" != "$last_sug_checksum" ]; then
            last_sug_checksum=$current_sug_checksum
            echo "[$(date)] SUGGESTIONS.md updated by User, waking up CEO..." >> "$LOG_FILE"
            /usr/bin/opencode run "CEO: Review SUGGESTIONS.md. Translate any new feature requests into structured JSON tasks in tasks.json using 'pending' status. Only add new tasks, do not delete existing ones." --agent ceo --format json >> "$LOG_FILE" 2>&1
        fi

        sleep 5
    done
}

case "$1" in
    start)
        run_monitor &
        echo $! > "$AGENCY_ROOT/monitor.pid"
        echo "Agency Event Monitor Started (PID $!)."
        ;;
    stop)
        if [ -f "$AGENCY_ROOT/monitor.pid" ]; then
            kill $(cat "$AGENCY_ROOT/monitor.pid") && rm "$AGENCY_ROOT/monitor.pid"
            echo "Agency Stopped."
        else
            echo "No monitor.pid found."
            pkill -f "run_monitor"
        fi
        ;;
    status)
        if [ -f "$AGENCY_ROOT/monitor.pid" ]; then
            echo "Agency is running (PID $(cat $AGENCY_ROOT/monitor.pid))"
        else
            echo "Agency is stopped."
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|status}"
        exit 1
        ;;
esac
