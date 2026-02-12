#!/bin/bash
# ============================================================================
# AI Smoke Test — Verify all model endpoints respond
# Usage: ./scripts/smoke-test-ai.sh [optional-api-key]
# If no key provided, reads VITE_API_KEY from .env
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Get API key
if [ -n "${1:-}" ]; then
    API_KEY="$1"
elif [ -f "$PROJECT_ROOT/.env" ]; then
    API_KEY=$(grep "^VITE_API_KEY=" "$PROJECT_ROOT/.env" | head -1 | cut -d= -f2)
fi

if [ -z "${API_KEY:-}" ]; then
    echo "❌ No API key found. Pass as argument or set VITE_API_KEY in .env"
    exit 1
fi

echo "🔑 Using key: ${API_KEY:0:12}..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASS=0
FAIL=0

test_model() {
    local MODEL="$1"
    local LABEL="$2"
    local PROMPT="${3:-Say hello in exactly 3 words}"

    printf "  %-40s " "$LABEL"

    RESPONSE=$(curl -s -w "\nHTTPCODE:%{http_code}" \
        "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}" \
        -H 'Content-Type: application/json' \
        -d "{\"contents\":[{\"parts\":[{\"text\":\"${PROMPT}\"}]}]}" \
        --max-time 30 2>/dev/null || echo "HTTPERROR")

    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTPCODE:" | sed 's/HTTPCODE://')
    BODY=$(echo "$RESPONSE" | grep -v "HTTPCODE:")

    if [ "${HTTP_CODE:-0}" = "200" ]; then
        TEXT=$(echo "$BODY" | python3 -c "
import sys, json
try:
    r = json.load(sys.stdin)
    print(r['candidates'][0]['content']['parts'][0]['text'][:60])
except:
    print('(response received)')
" 2>/dev/null || echo "(ok)")
        echo "✅ — ${TEXT}"
        PASS=$((PASS + 1))
    else
        echo "❌ HTTP ${HTTP_CODE:-timeout}"
        FAIL=$((FAIL + 1))
    fi
}

echo "📡 Text Models"
echo "──────────────────────────────────────────────────"
test_model "gemini-3-pro-preview"       "gemini-3-pro-preview (Agent)"
test_model "gemini-3-flash-preview"     "gemini-3-flash-preview (Fast)"
test_model "gemini-2.5-pro"             "gemini-2.5-pro (Thinking)"
test_model "gemini-2.5-flash"           "gemini-2.5-flash (Balanced)"
echo ""

echo "🎨 Image Model (text-only probe)"
echo "──────────────────────────────────────────────────"
test_model "gemini-3-pro-image-preview" "gemini-3-pro-image-preview" "Describe a sunset in 5 words"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: ✅ ${PASS} passed, ❌ ${FAIL} failed"

if [ "$FAIL" -gt 0 ]; then
    echo "⚠️  Some models failed. Check billing & API key restrictions."
    exit 1
else
    echo "🎉 All models responding!"
    exit 0
fi
