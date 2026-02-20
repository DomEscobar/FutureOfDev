#!/bin/bash
# EXECUTIVE-SWARM: Agency Setup & Activation
# This script configures the environment and validates the setup.

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CONFIG_FILE="config.json"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   EXECUTIVE-SWARM: AGENCY SETUP         ${NC}"
echo -e "${BLUE}=========================================${NC}"

# Initialize or load config.json
if [ -f "$CONFIG_FILE" ]; then
    echo -e "Existing $CONFIG_FILE detected. Loading values..."
else
    echo "{}" > "$CONFIG_FILE"
fi

# Function to update config.json
update_config() {
    key=$1
    value=$2
    python3 -c "import json; d=json.load(open('$CONFIG_FILE')); d['$key']='$value'; json.dump(d, open('$CONFIG_FILE', 'w'), indent=2)"
}

# 0. Target Workspace Configuration
echo -e "\n${BLUE}[STEP 0/4] Defining Target Project Workspace${NC}"
current_workspace=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('AGENCY_WORKSPACE', '/root/FutureOfDev'))")

echo -e "Current Target Workspace: ${BLUE}$current_workspace${NC}"
read -p "Enter the absolute path of the project you want to manage (default: $current_workspace): " input_workspace
input_workspace=${input_workspace:-$current_workspace}

update_config "AGENCY_WORKSPACE" "$input_workspace"
export AGENCY_WORKSPACE="$input_workspace"

echo -e "${GREEN}Workspace set to: $input_workspace${NC}"

# 1. Environment Variable Configuration
echo -e "\n${BLUE}[STEP 1/4] Configuring Telegram Notifier${NC}"
token=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('TELEGRAM_BOT_TOKEN', ''))")
if [ -z "$token" ]; then
    read -p "Enter Telegram Bot Token: " input_token
    update_config "TELEGRAM_BOT_TOKEN" "$input_token"
    export TELEGRAM_BOT_TOKEN=$input_token
else
    echo -e "${GREEN}Telegram Token loaded from config.${NC}"
    export TELEGRAM_BOT_TOKEN=$token
fi

chat_id=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('TELEGRAM_CHAT_ID', ''))")
if [ -z "$chat_id" ]; then
    echo -e "${BLUE}Discovering Chat ID...${NC}"
    echo -e "Please send a message to your Telegram bot now."
    echo -e "Waiting for handshake..."
    
    # Poll Telegram API for updates
    RETRY=0
    while [ $RETRY -lt 10 ]; do
        updates=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates")
        found_id=$(echo $updates | grep -oP '"chat":\{"id":\K[-0-9]+' | tail -n 1)
        
        if [ ! -z "$found_id" ]; then
            update_config "TELEGRAM_CHAT_ID" "$found_id"
            export TELEGRAM_CHAT_ID=$found_id
            echo -e "${GREEN}Handshake successful! Chat ID $found_id discovered and saved.${NC}"
            break
        fi
        
        sleep 3
        RETRY=$((RETRY+1))
        echo -n "."
    done
    
    if [ -z "$TELEGRAM_CHAT_ID" ]; then
        echo -e "\n${RED}Handshake timed out.${NC}"
        read -p "Please enter Chat ID manually: " input_chat
        update_config "TELEGRAM_CHAT_ID" "$input_chat"
        export TELEGRAM_CHAT_ID=$input_chat
    fi
else
    echo -e "${GREEN}Telegram Chat ID loaded from config.${NC}"
    export TELEGRAM_CHAT_ID=$chat_id
fi

app_url=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('APP_URL', 'http://localhost:3000'))")
read -p "Enter the URL of your live app (default: $app_url): " input_url
input_url=${input_url:-$app_url}
update_config "APP_URL" "$input_url"
export APP_URL=$input_url

# 2. Dependency Check...
echo -e "\n${BLUE}[STEP 2/4] Validating System Dependencies${NC}"
for cmd in opencode node git python3; do
    if ! command -v $cmd &> /dev/null; then echo -e "${RED}Error: $cmd missing.${NC}"; exit 1; fi
done
echo -e "${GREEN}Dependencies present.${NC}"

# 3. Permissions...
echo -e "\n${BLUE}[STEP 3/4] Securing Agency Scripts${NC}"
chmod +x scripts/gatekeeper.sh
mkdir -p docs
echo -e "${GREEN}Scripts secured.${NC}"

# 4. Final Activation
echo -en "\n${BLUE}[STEP 4/4] Generating Launch Script...${NC}"
LAUNCH_MSG="Start the Executive Swarm: CEO, check SUGGESTIONS.md and delegate tasks to the PM. All units, notify via Telegram on every state change."

# Generate start-agency.sh using a heredoc without variable expansion for the internal commands
cat > start-agency.sh << 'EOF'
#!/bin/bash
# EXECUTIVE-SWARM: Background Runner
cd "$(dirname "$0")"

# Load variables from config.json
export AGENCY_WORKSPACE=$(python3 -c "import json; print(json.load(open('config.json'))['AGENCY_WORKSPACE'])")
export TELEGRAM_BOT_TOKEN=$(python3 -c "import json; print(json.load(open('config.json'))['TELEGRAM_BOT_TOKEN'])")
export TELEGRAM_CHAT_ID=$(python3 -c "import json; print(json.load(open('config.json'))['TELEGRAM_CHAT_ID'])")
export APP_URL=$(python3 -c "import json; print(json.load(open('config.json'))['APP_URL'])")

LAUNCH_MSG="Start the Executive Swarm: CEO, check SUGGESTIONS.md and delegate tasks to the PM. All units, notify via Telegram on every state change."

echo "Starting Swarm [Workspace: $AGENCY_WORKSPACE]..."

# Run opencode with nohup
nohup opencode run "$LAUNCH_MSG" --agent ceo --format json > agency.log 2>&1 &

echo "Agency started in background. Monitor with: tail -f agency.log"
EOF

chmod +x start-agency.sh
echo -e "${GREEN}DONE${NC}"

echo -e "\n${GREEN}Setup Complete.${NC}"
echo -e "Run ${BLUE}./start-agency.sh${NC} to begin."
