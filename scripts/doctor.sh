#!/usr/bin/env bash
# ============================================================
# indiiOS Doctor — Unified Environment Health Check
# Usage: npm run doctor
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
WARN=0
FAIL=0

pass() { echo -e "  ${GREEN}✓${RESET} $1"; PASS=$((PASS+1)); }
warn() { echo -e "  ${YELLOW}⚠${RESET} $1"; WARN=$((WARN+1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; FAIL=$((FAIL+1)); }
section() { echo -e "\n${BOLD}${BLUE}▶ $1${RESET}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     indiiOS Doctor v1.0              ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"

# ── 1. Node / Runtime ─────────────────────────────────────
section "Node.js Runtime"

NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' || echo "0")
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [[ "$NODE_MAJOR" -ge 22 ]]; then
  pass "Node.js $NODE_VERSION (>= 22 required)"
else
  fail "Node.js $NODE_VERSION is below required v22.0.0 — run: nvm use 22"
fi

NPM_VERSION=$(npm --version 2>/dev/null || echo "0")
pass "npm $NPM_VERSION"

if command -v python3 &>/dev/null; then
  PY3_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
  pass "Python $PY3_VERSION"
else
  warn "python3 not found — AI sidecar requires Python 3.9+"
fi

# ── 2. Dependencies ───────────────────────────────────────
section "Dependencies"

NODE_MOD_COUNT=$(ls node_modules 2>/dev/null | wc -l | tr -d ' ')
if [[ "$NODE_MOD_COUNT" -gt 0 ]]; then
  pass "node_modules present ($NODE_MOD_COUNT packages)"
else
  fail "node_modules missing — run: npm install"
fi

if [[ -f "node_modules/.bin/electron-vite" ]]; then
  pass "electron-vite available"
else
  fail "electron-vite not found — run: npm install"
fi

if [[ -f "node_modules/.bin/vitest" ]]; then
  pass "vitest available"
else
  fail "vitest not found — run: npm install"
fi

if [[ -f "node_modules/.bin/playwright" ]]; then
  pass "playwright available"
else
  warn "playwright not found — run: npx playwright install"
fi

# ── 3. Environment Variables ──────────────────────────────
section "Environment Variables"

ENV_FILE=".env"
if [[ -f "$ENV_FILE" ]]; then
  pass ".env file exists"
else
  warn ".env file missing — copy from .env.example"
fi

check_env() {
  local VAR="$1"
  local REQUIRED="${2:-true}"
  if grep -q "^${VAR}=" "${ENV_FILE}" 2>/dev/null; then
    VALUE=$(grep "^${VAR}=" "${ENV_FILE}" | cut -d= -f2-)
    if [[ -n "$VALUE" && "$VALUE" != '""' && "$VALUE" != "''" ]]; then
      pass "$VAR is set"
    else
      if [[ "$REQUIRED" == "true" ]]; then
        fail "$VAR is empty in .env"
      else
        warn "$VAR is empty (optional)"
      fi
    fi
  else
    if [[ "$REQUIRED" == "true" ]]; then
      fail "$VAR missing from .env"
    else
      warn "$VAR not set (optional)"
    fi
  fi
}

if [[ -f "$ENV_FILE" ]]; then
  check_env "VITE_API_KEY"
  check_env "VITE_FIREBASE_API_KEY"
  check_env "VITE_FIREBASE_PROJECT_ID"
  check_env "VITE_FIREBASE_AUTH_DOMAIN"
  check_env "VITE_FIREBASE_STORAGE_BUCKET"
  check_env "VITE_VERTEX_PROJECT_ID" false
  check_env "VITE_VERTEX_LOCATION" false
fi

# ── 4. Git Hygiene ────────────────────────────────────────
section "Git Hygiene"

if [[ -d ".git" ]]; then
  pass "Git repository initialized"

  BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  pass "Current branch: $BRANCH"

  UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
  if [[ "$UNCOMMITTED" -eq 0 ]]; then
    pass "Working tree clean"
  elif [[ "$UNCOMMITTED" -le 3 ]]; then
    warn "$UNCOMMITTED uncommitted change(s) — consider committing"
  else
    fail "$UNCOMMITTED uncommitted changes — commit or stash before shipping"
  fi

  # Check husky hooks
  if [[ -f ".husky/pre-commit" ]]; then
    pass "Husky pre-commit hook active"
  else
    warn "No pre-commit hook — run: npx husky init"
  fi

  if [[ -f ".husky/commit-msg" ]]; then
    pass "Husky commit-msg hook active (Conventional Commits)"
  else
    warn "No commit-msg hook — conventional commits not enforced"
  fi
else
  fail "Not a git repository"
fi

# ── 5. AI Sidecar ─────────────────────────────────────────
section "AI Sidecar (Python)"

SIDECAR_URL="http://localhost:50080/health"
if command -v curl &>/dev/null; then
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$SIDECAR_URL" 2>/dev/null || echo "000")
  if [[ "$HTTP_STATUS" == "200" ]]; then
    pass "AI Sidecar is running at :50080"
  else
    warn "AI Sidecar not running (HTTP $HTTP_STATUS) — start with: docker compose up -d"
  fi
else
  warn "curl not available — cannot check sidecar"
fi

# ── 6. Firebase Tools ─────────────────────────────────────
section "Firebase Tools"

if command -v firebase &>/dev/null; then
  FB_VERSION=$(firebase --version 2>/dev/null || echo "unknown")
  pass "Firebase CLI: $FB_VERSION"
else
  warn "Firebase CLI not found — run: npm install -g firebase-tools"
fi

if [[ -f "firebase.json" ]]; then
  pass "firebase.json exists"
else
  fail "firebase.json missing"
fi

# ── 7. TypeScript Build Check ─────────────────────────────
section "TypeScript Quick Check"

if npx tsc -b packages/shared --noEmit 2>/dev/null; then
  pass "packages/shared typecheck passed"
else
  fail "packages/shared has TypeScript errors — run: npm run typecheck:renderer"
fi

# ── Summary ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  ${GREEN}${PASS} passed${RESET}  ${YELLOW}${WARN} warnings${RESET}  ${RED}${FAIL} failed${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}${BOLD}Environment has critical issues. Fix before shipping.${RESET}"
  echo ""
  exit 1
elif [[ "$WARN" -gt 0 ]]; then
  echo -e "${YELLOW}Environment ready with warnings.${RESET}"
  echo ""
  exit 0
else
  echo -e "${GREEN}${BOLD}✓ Environment is healthy and ready to ship.${RESET}"
  echo ""
  exit 0
fi
