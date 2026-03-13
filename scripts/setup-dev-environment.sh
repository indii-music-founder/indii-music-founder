#!/bin/bash
# ============================================================================
# indiiOS Developer Environment Setup
# One-click bootstrap for all Google Cloud CLI tools + dependencies
# ============================================================================
# Usage: chmod +x scripts/setup-dev-environment.sh && ./scripts/setup-dev-environment.sh
# ============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

log_info()  { echo -e "${BLUE}ℹ${NC}  $1"; }
log_ok()    { echo -e "${GREEN}✓${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
log_err()   { echo -e "${RED}✗${NC}  $1"; }
log_step()  { echo -e "\n${BOLD}${BLUE}━━━ $1 ━━━${NC}"; }

TOTAL_STEPS=11
CURRENT_STEP=0
step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  log_step "[$CURRENT_STEP/$TOTAL_STEPS] $1"
}

# ============================================================================
# Prerequisites Check
# ============================================================================
echo -e "\n${BOLD}🚀 indiiOS Developer Environment Setup${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

step "Checking prerequisites"

if ! command -v brew &>/dev/null; then
  log_err "Homebrew is required. Install it first:"
  echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  exit 1
fi
log_ok "Homebrew $(brew --version | head -1 | awk '{print $2}')"

if ! command -v node &>/dev/null; then
  log_err "Node.js 22+ is required. Install via: brew install node@22"
  exit 1
fi
NODE_VERSION=$(node --version)
log_ok "Node.js $NODE_VERSION"

if ! command -v python3 &>/dev/null; then
  log_warn "Python 3 not found. Some tools may not be available."
else
  PYTHON_VERSION=$(python3 --version)
  log_ok "$PYTHON_VERSION"
fi

# ============================================================================
# Google Cloud SDK (gcloud, gsutil, bq)
# ============================================================================
step "Google Cloud SDK (gcloud, gsutil, bq)"

if command -v gcloud &>/dev/null; then
  GCLOUD_VERSION=$(gcloud --version 2>/dev/null | head -1)
  log_ok "Already installed: $GCLOUD_VERSION"
else
  log_info "Installing Google Cloud SDK..."
  brew install --cask google-cloud-sdk
  log_ok "Google Cloud SDK installed"
fi

# ============================================================================
# Firebase CLI
# ============================================================================
step "Firebase CLI (firebase-tools)"

if command -v firebase &>/dev/null; then
  FIREBASE_VERSION=$(firebase --version 2>/dev/null)
  log_ok "Already installed: firebase $FIREBASE_VERSION"
else
  log_info "Installing Firebase CLI..."
  npm install -g firebase-tools
  log_ok "Firebase CLI installed"
fi

# ============================================================================
# Gemini CLI
# ============================================================================
step "Gemini CLI"

if command -v gemini &>/dev/null; then
  GEMINI_VERSION=$(gemini --version 2>/dev/null)
  log_ok "Already installed: gemini $GEMINI_VERSION"
else
  log_info "Installing Gemini CLI..."
  npm install -g @anthropic-ai/claude-code 2>/dev/null || brew install gemini-cli 2>/dev/null || log_warn "Could not install Gemini CLI automatically"
fi

# ============================================================================
# Google Workspace CLI (gws)
# ============================================================================
step "Google Workspace CLI (gws)"

if command -v gws &>/dev/null; then
  log_ok "Already installed: gws"
else
  log_info "Installing Google Workspace CLI..."
  npm install -g @googleworkspace/cli
  log_ok "gws installed"
fi

# ============================================================================
# Google Apps Script CLI (clasp)
# ============================================================================
step "Google Apps Script CLI (clasp)"

if command -v clasp &>/dev/null; then
  CLASP_VERSION=$(clasp --version 2>/dev/null)
  log_ok "Already installed: clasp $CLASP_VERSION"
else
  log_info "Installing clasp..."
  npm install -g @google/clasp
  log_ok "clasp installed"
fi

# ============================================================================
# Python Fire
# ============================================================================
step "Python Fire (CLI generation library)"

if python3 -c "import fire" 2>/dev/null; then
  FIRE_VERSION=$(python3 -c "import fire; print(fire.__version__)" 2>/dev/null)
  log_ok "Already installed: fire $FIRE_VERSION"
else
  log_info "Installing Python Fire..."
  pip3 install --break-system-packages fire 2>/dev/null || pip3 install --user fire 2>/dev/null || log_warn "Could not install Python Fire. Try: pip3 install fire"
fi

# ============================================================================
# Android SDK Command-Line Tools
# ============================================================================
step "Android SDK Command-Line Tools"

if command -v sdkmanager &>/dev/null; then
  log_ok "Already installed: Android SDK tools"
else
  log_info "Installing Android SDK Command-Line Tools..."
  brew install --cask android-commandlinetools
  log_ok "Android SDK tools installed"
fi

# Java Runtime (required by Android SDK)
if command -v java &>/dev/null; then
  JAVA_VERSION=$(java -version 2>&1 | head -1)
  log_ok "Java: $JAVA_VERSION"
else
  log_info "Installing Temurin JDK (required by Android SDK)..."
  brew install --cask temurin
  log_ok "Temurin JDK installed"
fi

# ============================================================================
# gcloud Emulators
# ============================================================================
step "gcloud Emulators (Firestore, Pub/Sub, Datastore, Bigtable)"

if command -v gcloud &>/dev/null; then
  INSTALLED_COMPONENTS=$(gcloud components list --format="value(id)" --filter="state.name=Installed" 2>/dev/null)
  EMULATORS_NEEDED=""

  for emulator in cloud-firestore-emulator pubsub-emulator cloud-datastore-emulator bigtable; do
    if echo "$INSTALLED_COMPONENTS" | grep -q "^${emulator}$"; then
      log_ok "Emulator: $emulator"
    else
      EMULATORS_NEEDED="$EMULATORS_NEEDED $emulator"
    fi
  done

  if [ -n "$EMULATORS_NEEDED" ]; then
    log_info "Installing missing emulators:$EMULATORS_NEEDED"
    gcloud components install $EMULATORS_NEEDED --quiet
    log_ok "Emulators installed"
  fi
else
  log_warn "gcloud not found, skipping emulators"
fi

# ============================================================================
# gcloud Update
# ============================================================================
step "Updating gcloud components"

if command -v gcloud &>/dev/null; then
  log_info "Checking for updates..."
  gcloud components update --quiet 2>/dev/null && log_ok "gcloud updated" || log_warn "Update check failed (may need gcloud init first)"
else
  log_warn "gcloud not found, skipping update"
fi

# ============================================================================
# Final Report
# ============================================================================
echo -e "\n${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅ indiiOS Developer Environment Setup Complete!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Installed Tools:${NC}"
echo "  gcloud ........... $(gcloud --version 2>/dev/null | head -1 || echo 'not found')"
echo "  gsutil ........... $(gsutil --version 2>/dev/null || echo 'not found')"
echo "  bq ............... $(bq version 2>/dev/null | head -1 || echo 'not found')"
echo "  firebase ......... $(firebase --version 2>/dev/null || echo 'not found')"
echo "  gemini ........... $(gemini --version 2>/dev/null || echo 'not found')"
echo "  clasp ............ $(clasp --version 2>/dev/null || echo 'not found')"
echo "  gws .............. $(which gws 2>/dev/null && echo 'installed' || echo 'not found')"
echo "  python-fire ...... $(python3 -c 'import fire; print(fire.__version__)' 2>/dev/null || echo 'not found')"
echo "  sdkmanager ....... $(which sdkmanager 2>/dev/null && echo 'installed' || echo 'not found')"
echo "  java ............. $(java -version 2>&1 | head -1 || echo 'not found')"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Run 'gcloud auth login' to authenticate with Google Cloud"
echo "  2. Run 'firebase login' to authenticate with Firebase"
echo "  3. Run 'clasp login' to authenticate with Apps Script"
echo "  4. Run 'npm run dev' to start the app"
echo ""
