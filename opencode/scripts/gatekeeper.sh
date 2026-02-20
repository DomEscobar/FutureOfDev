#!/bin/bash
# Gatekeeper: Pre-push security and quality validation
# Runs against the target workspace defined in config.json.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENCY_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$AGENCY_ROOT/config.json"

TARGET_WS=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8')).AGENCY_WORKSPACE)}catch(e){console.log('.')}")
cd "$TARGET_WS"

echo "Gatekeeper: validating $TARGET_WS"

# 1. Lint (if package.json has a lint script)
if [ -f "package.json" ]; then
    HAS_LINT=$(node -e "try{const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));console.log(p.scripts&&p.scripts.lint?'yes':'no')}catch(e){console.log('no')}")
    if [ "$HAS_LINT" = "yes" ]; then
        echo "Running lint..."
        npm run lint > /tmp/gatekeeper_lint.log 2>&1
        if [ $? -ne 0 ]; then
            echo "FAIL: lint"
            cat /tmp/gatekeeper_lint.log | tail -n 10
            exit 1
        fi
    fi
fi

# 2. Security scan for leaked secrets
echo "Running security scan..."

SECURITY_PATTERNS=(
    "sk-[a-zA-Z0-9]{32}"
    "AIza[a-zA-Z0-9_-]{35}"
    "[0-9]{8,10}:[a-zA-Z0-9_-]{35}"
    "api[_-]?key[\"']?\s*[:=]\s*[\"'][a-zA-Z0-9_-]{20,}"
    "AKIA[0-9A-Z]{16}"
    "-----BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----"
    "password[\"']?\s*[:=]\s*[\"'][^\"']{8,}"
    "(mysql|postgres|mongodb)://[^:]+:[^@]+@"
    "gh[pousr]_[a-zA-Z0-9]{36}"
    "xox[baprs]-[0-9]{10,}"
)

GREP_PATTERN=""
for pattern in "${SECURITY_PATTERNS[@]}"; do
    if [ -z "$GREP_PATTERN" ]; then
        GREP_PATTERN="$pattern"
    else
        GREP_PATTERN="$GREP_PATTERN|$pattern"
    fi
done

grep -rE "$GREP_PATTERN" . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude="*.md" \
    --exclude=".env.example" \
    --exclude="package*.json" > /tmp/gatekeeper_sec.log 2>/dev/null

if [ -s /tmp/gatekeeper_sec.log ]; then
    echo "FAIL: potential secrets detected"
    head -10 /tmp/gatekeeper_sec.log
    exit 1
fi

echo "PASS: all checks passed."
exit 0
