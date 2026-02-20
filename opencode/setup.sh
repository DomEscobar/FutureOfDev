#!/bin/bash
# EXECUTIVE-SWARM: Agency Setup & Activation
# This script configures the environment and validates the setup.

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   EXECUTIVE-SWARM: AGENCY SETUP         ${NC}"
echo -e "${BLUE}=========================================${NC}"

# 0. Target Workspace Configuration
echo -e "\n${BLUE}[STEP 0/4] Defining Target Project Workspace${NC}"
# Use current workspace or fallback to default
if [ -f opencode.json ]; then
    current_workspace=$(grep '"workspace":' opencode.json | cut -d'"' -f4)
fi
current_workspace=${current_workspace:-/root/FutureOfDev}

echo -e "Current Target Workspace: ${BLUE}$current_workspace${NC}"
read -p "Enter the absolute path of the project you want to manage (default: $current_workspace): " input_workspace
input_workspace=${input_workspace:-$current_workspace}

# Export workspace for scripts to use
echo "export AGENCY_WORKSPACE=\"$input_workspace\"" >> ~/.bashrc
export AGENCY_WORKSPACE="$input_workspace"

echo -e "${GREEN}Workspace set to: $input_workspace${NC}"

# 1. Environment Variable Configuration
echo -e "\n${BLUE}[STEP 1/4] Configuring Environment Variables${NC}"
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    read -p "Enter Telegram Bot Token: " input_token
    export TELEGRAM_BOT_TOKEN=$input_token
    echo "export TELEGRAM_BOT_TOKEN=\"$input_token\"" >> ~/.bashrc
else
    echo -e "${GREEN}Telegram Token detected.${NC}"
fi

if [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo -e "${BLUE}Discovering Chat ID...${NC}"
    echo -e "Please send a message (e.g., 'Hello Agency') to your Telegram bot now."
    echo -e "Waiting for handshake..."
    
    # Poll Telegram API for updates
    RETRY=0
    while [ $RETRY -lt 10 ]; do
        updates=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates")
        chat_id=$(echo $updates | grep -oP '"chat":\{"id":\K[-0-9]+' | tail -n 1)
        
        if [ ! -z "$chat_id" ]; then
            export TELEGRAM_CHAT_ID=$chat_id
            echo "export TELEGRAM_CHAT_ID=\"$chat_id\"" >> ~/.bashrc
            echo -e "${GREEN}Handshake successful! Chat ID $chat_id discovered and saved.${NC}"
            break
        fi
        
        sleep 3
        RETRY=$((RETRY+1))
        echo -n "."
    done
    
    if [ -z "$TELEGRAM_CHAT_ID" ]; then
        echo -e "\n${RED}Handshake timed out.${NC}"
        read -p "Please enter Chat ID manually: " input_chat
        export TELEGRAM_CHAT_ID=$input_chat
        echo "export TELEGRAM_CHAT_ID=\"$input_chat\"" >> ~/.bashrc
    fi
else
    echo -e "${GREEN}Telegram Chat ID detected.${NC}"
fi

read -p "Enter the URL of your live app (default: http://localhost:3000): " input_url
input_url=${input_url:-http://localhost:3000}
export APP_URL=$input_url
echo "export APP_URL=\"$input_url\"" >> ~/.bashrc

# 2. Dependency Check
echo -e "\n${BLUE}[STEP 2/4] Validating System Dependencies${NC}"
commands=("opencode" "node" "git")
for cmd in "${commands[@]}"; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}Error: $cmd is not installed.${NC}"
        exit 1
    fi
done
echo -e "${GREEN}All system dependencies present.${NC}"

# 3. Permissions & Workspace Audit
echo -e "\n${BLUE}[STEP 3/4] Securing Agency Scripts${NC}"
chmod +x scripts/gatekeeper.sh
mkdir -p docs
touch docs/last_gatekeeper_report.json
echo -e "${GREEN}Permissions updated and directories initialized.${NC}"

# 4. Final Activation Plan
echo -e "\n${BLUE}[STEP 4/4] Final Activation Plan${NC}"
echo -e "Your agency is ready to go live."

# Use standard run command for compatibility with v1.2.9
LAUNCH_CMD="opencode run \"Start the Executive Swarm: CEO, check SUGGESTIONS.md and delegate tasks to the PM. PM, sync to DEV_KANBAN.md. All units, follow the reactive workflow.\" --agent ceo --format json"

echo -e "1. Run the following command to start the swarm:"
echo -e "${GREEN}$LAUNCH_CMD${NC}"
echo -e "2. Follow progress on Telegram."

# Create a convenience start script
cat > start-agency.sh << EOF
#!/bin/bash
cd /root/FutureOfDev/opencode
# Running in background with nohup since --daemon is unsupported
nohup $LAUNCH_CMD > agency.log 2>&1 &
echo "Agency started in background. Monitor logs with: tail -f agency.log"
EOF
chmod +x start-agency.sh

echo -e "\n${GREEN}Setup Complete. I have created './start-agency.sh' for you.${NC}"
echo -e "Run ${BLUE}./start-agency.sh${NC} to begin."
