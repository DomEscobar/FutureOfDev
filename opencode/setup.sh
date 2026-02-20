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

# 1. Environment Variable Configuration
echo -e "\n${BLUE}[STEP 1/4] Configuring Environment Variables${NC}"
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo -e "${RED}Telegram credentials not found in environment!${NC}"
    read -p "Enter Telegram Bot Token: " input_token
    read -p "Enter Telegram Chat ID: " input_chat
    
    # Export for current session
    export TELEGRAM_BOT_TOKEN=$input_token
    export TELEGRAM_CHAT_ID=$input_chat
    
    # Save to .env for persistence
    echo "export TELEGRAM_BOT_TOKEN=\"$input_token\"" >> ~/.bashrc
    echo "export TELEGRAM_CHAT_ID=\"$input_chat\"" >> ~/.bashrc
    echo -e "${GREEN}Credentials saved to ~/.bashrc for future sessions.${NC}"
else
    echo -e "${GREEN}Telegram configuration detected.${NC}"
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

# 4. Final Activation
echo -e "\n${BLUE}[STEP 4/4] Final Activation Plan${NC}"
echo -e "Your agency is ready to go live."
echo -e "1. Run ${GREEN}opencode run --daemon --format json${NC} to start the swarm."
echo -e "2. Check ${BLUE}SUGGESTIONS.md${NC} for the first Visual Analyst report in 4 hours."
echo -e "3. Follow progress on Telegram."

echo -e "\n${GREEN}Setup Complete. The Pulse is Operational.${NC}"
