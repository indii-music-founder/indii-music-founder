#!/usr/bin/env bash
# =============================================================================
# build_sidecar.sh — Build the bundled Python agent sidecar binary
#
# Produces a single-file executable via PyInstaller that Electron spawns
# instead of requiring Docker for packaged desktop builds.
#
# Usage:
#   ./scripts/build_sidecar.sh 
#   (Note: --platform [mac|win|linux] is planned for future cross-compilation)
#
# The output binary is placed at:
#   dist/agent_sidecar          (macOS / Linux)
#   dist/agent_sidecar.exe      (Windows)
#
# After building, run `npm run build:desktop` which will copy the binary
# into the app package via electron-builder's extraResources config.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_FILE="$REPO_ROOT/python/build/agent_sidecar.spec"
OUTPUT_DIR="$REPO_ROOT/dist"

# ---------------------------------------------------------------------------
# Requirements check
# ---------------------------------------------------------------------------
if ! command -v python3 &>/dev/null; then
    echo "❌  python3 not found. Install Python 3.10+ before building the sidecar."
    exit 1
fi

if ! python3 -c "import PyInstaller" &>/dev/null 2>&1; then
    echo "📦  PyInstaller not found — installing…"
    pip install pyinstaller
fi

# ---------------------------------------------------------------------------
# Optional: install Python deps from requirements if present
# ---------------------------------------------------------------------------
REQS="$REPO_ROOT/python/requirements.txt"
if [[ -f "$REQS" ]]; then
    echo "📦  Installing Python dependencies from $REQS…"
    pip install -r "$REQS"
fi

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo "🔨  Building agent_sidecar binary…"
python3 -m PyInstaller \
    --clean \
    --noconfirm \
    --distpath "$OUTPUT_DIR" \
    --workpath "$REPO_ROOT/.pyinstaller-build" \
    "$SPEC_FILE"

BINARY="$OUTPUT_DIR/agent_sidecar"
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "win32"* ]]; then
    BINARY="${BINARY}.exe"
fi

if [[ ! -f "$BINARY" ]]; then
    echo "❌  Build failed — binary not found at $BINARY"
    exit 1
fi

# Make executable on Unix
if [[ "$OSTYPE" != "msys"* ]] && [[ "$OSTYPE" != "win32"* ]]; then
    chmod +x "$BINARY"
fi

echo "✅  Sidecar binary ready: $BINARY"
echo "    Size: $(du -sh "$BINARY" | cut -f1)"

# ---------------------------------------------------------------------------
# Stage for electron-builder extraResources
# ---------------------------------------------------------------------------
STAGING="$REPO_ROOT/dist-sidecar"
mkdir -p "$STAGING"
cp "$BINARY" "$STAGING/"
echo "📂  Staged to $STAGING/ for electron-builder packaging"
