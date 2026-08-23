#!/bin/bash
#
# release-macos.sh — build a SIGNED + NOTARIZED macOS build and publish it to
# the auto-update feed (GitHub Releases).
#
# This is the "one command once you have Apple credentials" path. The normal
# `npm run build:desktop:mac` stays `--publish never` and unsigned for local
# installs; this script is for shipping a build users can install without
# Gatekeeper friction and that electron-updater can serve.
#
# Requirements (all via environment, nothing secret is stored in the repo):
#   Signing identity:  a Developer ID Application cert in your login keychain,
#                      OR CSC_LINK (base64 .p12) + CSC_KEY_PASSWORD.
#   Notarization:      APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID
#                      (Apple-ID route), OR the notarytool API-key route
#                      (APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER).
#   Publish:           GH_TOKEN with repo write scope.
#
# Usage:
#   APPLE_ID=... APPLE_APP_SPECIFIC_PASSWORD=... APPLE_TEAM_ID=... \
#   GH_TOKEN=... ./scripts/release-macos.sh [stable|beta]
#
set -euo pipefail

CHANNEL="${1:-stable}"
if [[ "$CHANNEL" != "stable" && "$CHANNEL" != "beta" ]]; then
  echo "Usage: $0 [stable|beta]" >&2
  exit 2
fi

# ── Credential gate: fail loudly BEFORE a 10-minute build, not after ────────
if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "❌ GH_TOKEN is required to publish the auto-update feed (repo write scope)." >&2
  exit 1
fi

HAVE_APPLE_ID_ROUTE=$([[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]] && echo yes || echo no)
HAVE_API_KEY_ROUTE=$([[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]] && echo yes || echo no)

if [[ "$HAVE_APPLE_ID_ROUTE" != "yes" && "$HAVE_API_KEY_ROUTE" != "yes" ]]; then
  echo "❌ Notarization credentials missing. Provide EITHER:" >&2
  echo "     APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID" >&2
  echo "   OR (recommended, non-expiring):" >&2
  echo "     APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER" >&2
  echo "   See docs/MACOS_SIGNING_AND_RELEASE.md for how to create them." >&2
  exit 1
fi

if [[ -z "${CSC_LINK:-}" ]] && ! security find-identity -v -p codesigning 2>/dev/null | grep -q 'Developer ID Application'; then
  echo "❌ No Developer ID Application signing identity found." >&2
  echo "   Install the cert in your login keychain, or set CSC_LINK + CSC_KEY_PASSWORD." >&2
  exit 1
fi

echo "🚀 Building signed + notarized macOS release (channel: ${CHANNEL})..."
npm run preflight:prod
electron-vite build
npx electron-builder --mac --publish always

echo ""
echo "✅ Release built, notarized, and published."
echo "   Artifacts: dist-electron/ (dmg, zip, latest-mac.yml)"
echo "   Auto-update feed: GitHub Releases → indii-music-founder/indii-music-founder"
