#!/bin/bash
# ==============================================================================
# indii .env Guardian
# Backs up and restores the .env file from a safe location outside the repo.
# Run this script whenever the .env file goes missing.
# Safe location: ~/.config/indii/.env
# ==============================================================================

SAFE_COPY="$HOME/.config/indii/.env"
set -euo pipefail

SAFE_COPY="$HOME/.config/indii/.env"
if ! GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "❌ Not inside a git repository."
  exit 1
fi
PROJECT_ENV="$GIT_ROOT/.env"

case "$1" in
  backup)
    if [ -f "$PROJECT_ENV" ]; then
      mkdir -p "$(dirname "$SAFE_COPY")"
      cp "$PROJECT_ENV" "$SAFE_COPY"
      echo "✅ .env backed up to $SAFE_COPY"
    else
      echo "❌ No .env found in project root to back up."
      exit 1
    fi
    ;;
  restore)
    if [ -f "$SAFE_COPY" ]; then
      cp "$SAFE_COPY" "$PROJECT_ENV"
      echo "✅ .env restored from $SAFE_COPY"
    else
      echo "❌ No backup found at $SAFE_COPY. Run: bash scripts/env-guardian.sh backup"
      exit 1
    fi
    ;;
  check)
    if [ -f "$PROJECT_ENV" ]; then
      echo "✅ .env exists in project root."
    else
      echo "⚠️  .env is MISSING from project root."
      if [ -f "$SAFE_COPY" ]; then
        echo "   Restoring from backup automatically..."
        cp "$SAFE_COPY" "$PROJECT_ENV"
        echo "✅ Restored from $SAFE_COPY"
      else
        echo "❌ No backup found. Run: bash scripts/env-guardian.sh restore"
        exit 1
      fi
    fi
    ;;
  *)
    echo "Usage: bash scripts/env-guardian.sh [backup|restore|check]"
    echo ""
    echo "  backup   Copy project .env to ~/.config/indii/.env"
    echo "  restore  Copy ~/.config/indii/.env back to project root"
    echo "  check    Verify .env exists; auto-restore if missing"
    ;;
esac
