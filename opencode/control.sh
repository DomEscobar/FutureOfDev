#!/bin/bash
AGENCY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$AGENCY_ROOT/.run"
PID_FILE="$RUN_DIR/orchestrator.pid"

mkdir -p "$RUN_DIR"

case "$1" in
    start)
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "Already running (PID $(cat "$PID_FILE"))."
            exit 0
        fi
        node "$AGENCY_ROOT/orchestrator.js" &
        echo $! > "$PID_FILE"
        echo "Agency started (PID $!)."
        ;;
    stop)
        if [ -f "$PID_FILE" ]; then
            kill "$(cat "$PID_FILE")" 2>/dev/null
            rm -f "$PID_FILE"
            echo "Agency stopped."
        else
            echo "Not running."
        fi
        ;;
    reset)
        # Stop first if running
        if [ -f "$PID_FILE" ]; then
            kill "$(cat "$PID_FILE")" 2>/dev/null
            rm -f "$PID_FILE"
        fi
        # Clear runtime artifacts
        rm -rf "$RUN_DIR"
        # Reset state files
        cat > "$AGENCY_ROOT/tasks.json" <<'EOF'
{
  "tasks": [],
  "agency_state": {
    "status": "IDLE",
    "last_audit": null
  }
}
EOF
        cat > "$AGENCY_ROOT/SUGGESTIONS.md" <<'EOF'
# SUGGESTIONS

Write new feature requests or ideas below. The agency monitor watches this file -- any change triggers the CEO agent to review and create tasks.

## New Requests
EOF
        echo "Agency reset. Config preserved."
        ;;
    status)
        if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "Running (PID $(cat "$PID_FILE"))."
        else
            rm -f "$PID_FILE" 2>/dev/null
            echo "Not running."
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|reset|status}"
        exit 1
        ;;
esac
