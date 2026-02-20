#!/bin/bash
# OpenCode Agency - Interactive Setup
# Run this once to configure the agency before first start.

set -e

AGENCY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "============================================"
echo "   OpenCode Agency Setup"
echo "============================================"
echo ""

# 1. Check prerequisites
echo "[1/5] Checking prerequisites..."

missing=""
command -v node >/dev/null 2>&1 || missing="$missing node"
command -v opencode >/dev/null 2>&1 || missing="$missing opencode"
command -v curl >/dev/null 2>&1 || missing="$missing curl"

if [ -n "$missing" ]; then
    echo ""
    echo "  Missing required tools:$missing"
    echo "  Please install them before running setup."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "  Node.js 18+ required. Found: $(node -v)"
    exit 1
fi

echo "  node $(node -v) ............. OK"
echo "  opencode $(opencode --version 2>/dev/null || echo '?') ... OK"
echo "  curl ....................... OK"
echo ""

# 2. Workspace path
echo "[2/5] Target workspace"
echo "  This is the project folder your agents will work on."
echo "  It should NOT be this agency folder itself."
echo ""

DEFAULT_WS="/root/playground"
read -rp "  Workspace path [$DEFAULT_WS]: " WORKSPACE
WORKSPACE="${WORKSPACE:-$DEFAULT_WS}"

if [ ! -d "$WORKSPACE" ]; then
    read -rp "  Directory doesn't exist. Create it? [Y/n]: " CREATE_WS
    CREATE_WS="${CREATE_WS:-Y}"
    if [[ "$CREATE_WS" =~ ^[Yy] ]]; then
        mkdir -p "$WORKSPACE"
        echo "  Created $WORKSPACE"
    else
        echo "  Aborting."
        exit 1
    fi
fi
echo ""

# 3. Telegram (optional)
echo "[3/5] Telegram notifications (optional)"
echo "  Get a bot token from @BotFather on Telegram."
echo "  Get your chat ID from @userinfobot."
echo "  Leave blank to skip."
echo ""

read -rp "  Bot Token [skip]: " TG_TOKEN
TG_TOKEN="${TG_TOKEN:-}"

TG_CHAT=""
if [ -n "$TG_TOKEN" ]; then
    read -rp "  Chat ID: " TG_CHAT

    echo ""
    echo "  Testing Telegram connection..."
    RESULT=$(curl -s -X POST "https://api.telegram.org/bot$TG_TOKEN/sendMessage" \
        -d "chat_id=$TG_CHAT" \
        -d "text=OpenCode Agency connected." 2>&1)

    if echo "$RESULT" | grep -q '"ok":true'; then
        echo "  Telegram test message sent. Check your chat."
    else
        echo "  Warning: Telegram test failed. Check your token/chat ID."
        echo "  You can fix this later in config.json."
    fi
fi
echo ""

# 4. App URL (for visual-analyst browser checks)
echo "[4/5] App URL (optional)"
echo "  If your workspace serves a web app, provide the URL"
echo "  so the visual-analyst agent can browse it."
echo ""

DEFAULT_URL="http://localhost:3000"
read -rp "  App URL [$DEFAULT_URL]: " APP_URL
APP_URL="${APP_URL:-$DEFAULT_URL}"
echo ""

# 5. Write config
echo "[5/5] Writing configuration..."

cat > "$AGENCY_ROOT/config.json" <<EOF
{
  "AGENCY_WORKSPACE": "$WORKSPACE",
  "TELEGRAM_BOT_TOKEN": "$TG_TOKEN",
  "TELEGRAM_CHAT_ID": "$TG_CHAT",
  "APP_URL": "$APP_URL"
}
EOF
chmod 600 "$AGENCY_ROOT/config.json"

# Reset tasks.json to clean state
cat > "$AGENCY_ROOT/tasks.json" <<EOF
{
  "tasks": [],
  "agency_state": {
    "status": "IDLE",
    "last_audit": null
  }
}
EOF

# Reset SUGGESTIONS.md
cat > "$AGENCY_ROOT/SUGGESTIONS.md" <<EOF
# SUGGESTIONS

Write new feature requests or ideas below. The agency monitor watches this file -- any change triggers the CEO agent to review and create tasks.

## New Requests
EOF

# Ensure scripts are executable
chmod +x "$AGENCY_ROOT/control.sh"
chmod +x "$AGENCY_ROOT/scripts/gatekeeper.sh"

echo ""
echo "============================================"
echo "   Setup Complete"
echo "============================================"
echo ""
echo "  Workspace:  $WORKSPACE"
echo "  Telegram:   $([ -n "$TG_TOKEN" ] && echo 'Configured' || echo 'Skipped')"
echo "  App URL:    $APP_URL"
echo "  Config:     $AGENCY_ROOT/config.json"
echo ""
echo "  Start the agency:"
echo "    cd $AGENCY_ROOT"
echo "    ./control.sh start"
echo ""
echo "  Then write a feature request:"
echo "    echo '- Add login page' >> SUGGESTIONS.md"
echo ""
