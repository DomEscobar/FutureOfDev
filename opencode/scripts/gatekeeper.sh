#!/bin/bash
# Executive-Swarm Gatekeeper: Self-Healing CI/CD Bridge
# This script is the final barrier before code is pushed to main.

PROJECT_ROOT="/root/FutureOfDev/opencode"
REPORT_FILE="$PROJECT_ROOT/docs/last_gatekeeper_report.json"

echo "🛡️ GATEKEEPER: Starting pre-push validation..."

# 1. Syntax & Linting (Example for Node/TS projects, can be adapted)
if [ -f "package.json" ]; then
    echo "🔍 Running Type Checks & Linting..."
    npm run lint > /tmp/gatekeeper_lint.log 2>&1
    if [ $? -ne 0 ]; then
        echo "❌ LINT FAILURE"
        echo "{\"status\": \"fail\", \"stage\": \"lint\", \"error\": \"$(cat /tmp/gatekeeper_lint.log | tail -n 5 | tr '\n' ' ')\"}" > $REPORT_FILE
        exit 1
    fi
fi

# 2. Automated Test-Harness
if [ -f "scripts/test-harness.js" ]; then
    echo "🧪 Running Automated Test Harness..."
    node scripts/test-harness.js > /tmp/gatekeeper_test.log 2>&1
    if [ $? -ne 0 ]; then
        echo "❌ TEST FAILURE"
        echo "{\"status\": \"fail\", \"stage\": \"testing\", \"error\": \"$(cat /tmp/gatekeeper_test.log | tail -n 5 | tr '\n' ' ')\"}" > $REPORT_FILE
        exit 1
    fi
fi

# 3. Security Scan (Basic Grep for Secrets)
echo "🛡️ Running Security Scan..."
grep -rE "sk-[a-zA-Z0-9]{32}|AIza[a-zA-Z0-9_-]{35}" . --exclude-dir=.git --exclude=opencode.json > /tmp/gatekeeper_sec.log
if [ -s /tmp/gatekeeper_sec.log ]; then
    echo "❌ SECURITY ALERT: Potential API Keys leaked!"
    echo "{\"status\": \"fail\", \"stage\": \"security\", \"error\": \"Keys detected in files\"}" > $REPORT_FILE
    exit 1
fi

echo "✅ GATEKEEPER: All checks passed."
echo "{\"status\": \"pass\"}" > $REPORT_FILE
exit 0
