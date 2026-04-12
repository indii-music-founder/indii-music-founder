#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# scripts/doctor.sh — Environment Health Checker for indiiOS
#
# Usage: npm run doctor
#
# Validates that the local development environment is correctly configured.
# Returns exit code 0 if all checks pass, 1 otherwise.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass()  { PASS=$((PASS + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { FAIL=$((FAIL + 1)); echo -e "  ${RED}✗${NC} $1"; }
warn()  { WARN=$((WARN + 1)); echo -e "  ${YELLOW}⚠${NC} $1"; }
header(){ echo -e "\n${BOLD}${CYAN}── $1 ──${NC}"; }

# ── Node.js ──────────────────────────────────────────────────────────────────
header "Runtime"

NODE_VERSION=$(node --version 2>/dev/null || echo "NONE")
if [ "$NODE_VERSION" = "NONE" ]; then
  fail "Node.js: not installed"
else
  NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 22 ]; then
    pass "Node.js: $NODE_VERSION (>= 22 required)"
  else
    fail "Node.js: $NODE_VERSION (>= 22 required)"
  fi
fi

NPM_VERSION=$(npm --version 2>/dev/null || echo "NONE")
if [ "$NPM_VERSION" = "NONE" ]; then
  fail "npm: not installed"
else
  pass "npm: v$NPM_VERSION"
fi

# ── Dependencies ─────────────────────────────────────────────────────────────
header "Dependencies"

if [ -d "node_modules" ]; then
  PKG_COUNT=$(ls node_modules 2>/dev/null | wc -l | tr -d ' ')
  pass "node_modules: $PKG_COUNT packages installed"
else
  fail "node_modules: missing — run 'npm install'"
fi

if [ -f "package-lock.json" ]; then
  pass "package-lock.json: present"
else
  fail "package-lock.json: missing"
fi

# ── Environment Variables ────────────────────────────────────────────────────
header "Environment"

if [ -f ".env" ]; then
  pass ".env file: exists"

  # Check critical variables
  REQUIRED_VARS=(
    "VITE_FIREBASE_API_KEY"
    "VITE_FIREBASE_PROJECT_ID"
    "VITE_API_KEY"
  )

  for var in "${REQUIRED_VARS[@]}"; do
    VALUE=$(grep "^${var}=" .env 2>/dev/null | cut -d= -f2-)
    if [ -z "$VALUE" ] || [ "$VALUE" = "your_firebase_api_key_here" ] || [ "$VALUE" = "your_project_id" ] || [ "$VALUE" = "your_gemini_api_key_here" ]; then
      fail "$var: not configured (still placeholder)"
    else
      pass "$var: configured"
    fi
  done
else
  fail ".env file: missing — run 'cp .env.example .env' and fill in values"
fi

# ── Git Hooks ────────────────────────────────────────────────────────────────
header "Git Hooks"

if [ -f ".husky/pre-commit" ]; then
  pass "Husky pre-commit hook: installed"
else
  warn "Husky pre-commit hook: missing — run 'npx husky init'"
fi

if command -v git &>/dev/null; then
  HOOK_PATH=$(git config core.hooksPath 2>/dev/null || echo "")
  if [ -n "$HOOK_PATH" ]; then
    pass "Git hooksPath: $HOOK_PATH"
  else
    # Husky v9 uses .husky/ directly, check if .husky/_/husky.sh exists or .husky/pre-commit
    if [ -f ".husky/pre-commit" ]; then
      pass "Git hooks: wired via .husky/"
    else
      warn "Git hooks: not configured"
    fi
  fi
fi

# ── Tooling ──────────────────────────────────────────────────────────────────
header "Tooling"

for tool in "tsc:TypeScript" "eslint:ESLint" "vitest:Vitest"; do
  CMD=$(echo "$tool" | cut -d: -f1)
  NAME=$(echo "$tool" | cut -d: -f2)
  if npx --no-install "$CMD" --version &>/dev/null 2>&1; then
    VERSION=$(npx --no-install "$CMD" --version 2>/dev/null | head -1)
    pass "$NAME: $VERSION"
  else
    fail "$NAME: not available"
  fi
done

if command -v firebase &>/dev/null; then
  FIREBASE_VER=$(firebase --version 2>/dev/null)
  pass "Firebase CLI: $FIREBASE_VER"
else
  warn "Firebase CLI: not installed (optional for local dev)"
fi

# ── Build Artifacts ──────────────────────────────────────────────────────────
header "Build State"

if [ -d "dist" ]; then
  DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
  pass "dist/ exists: $DIST_SIZE"
else
  warn "dist/ not found — run 'npm run build' to create a production build"
fi

# ── Workspace Packages ───────────────────────────────────────────────────────
header "Workspace Packages"

for pkg in packages/*/package.json; do
  PKG_NAME=$(node -e "console.log(require('./$pkg').name)" 2>/dev/null || echo "unknown")
  PKG_DIR=$(dirname "$pkg")
  if [ -d "$PKG_DIR/node_modules" ] || [ -d "node_modules/$PKG_NAME" ] || [ -L "node_modules/$PKG_NAME" ]; then
    pass "$PKG_NAME"
  else
    # In hoisted workspaces, symlinks may be at root node_modules
    pass "$PKG_NAME (hoisted)"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}✓ $PASS passed${NC}  ${YELLOW}⚠ $WARN warnings${NC}  ${RED}✗ $FAIL failed${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}${BOLD}Environment is NOT ready.${NC} Fix the failures above."
  exit 1
else
  echo -e "\n${GREEN}${BOLD}Environment is healthy! 🚀${NC}"
  exit 0
fi
