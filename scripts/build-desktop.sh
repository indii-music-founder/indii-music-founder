#!/bin/bash

# Build script for indiiOS Studio Desktop Application
# This script builds the web app and packages it with Electron

set -e

echo "🚀 Building indiiOS Studio for Desktop..."

# Parse command line arguments
BUILD_MODE="${1:-release}"  # debug, release, staging
PLATFORM="${2:-all}"     # mac, win, linux, all
ARCH="${3:-}"           # x64, arm64

# Validate inputs
if [[ ! "$BUILD_MODE" =~ ^(debug|release|staging)$ ]]; then
  echo "❌ Invalid build mode. Use: $0 [debug|release|staging] [mac|win|linux|all] [x64|arm64]"
  exit 1
fi

echo "================================"
echo "Build Configuration"
echo "=================================="
echo "Mode: $BUILD_MODE"
echo "Platform(s): $PLATFORM"
echo "Architecture: ${ARCH:-all}"
echo "================================"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist dist-electron dist-electron-studio

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Build web assets first
echo "🌐 Building web assets..."
if [ "$BUILD_MODE" = "staging" ]; then
  npm run build:staging
else
  npm run build
fi

# Prepare Electron assets
echo "🔨 Preparing Electron assets..."

# Copy web build to electron resources
mkdir -p dist-electron-studio
cp -r dist/* dist-electron-studio/

# Create electron package
if [[ "$PLATFORM" = "all" || "$PLATFORM" = "mac" ]]; then
  echo "🍎 Preparing macOS build..."
fi

if [[ "$PLATFORM" = "all" || "$PLATFORM" = "win" ]]; then
  echo "🪟 Preparing Windows build..."
fi

if [[ "$PLATFORM" = "all" || "$PLATFORM" = "linux" ]]; then
  echo 🐧 Preparing Linux build...
fi

# Build Electron app
echo "🔨 Building Electron application..."
if [ "$BUILD_MODE" = "debug" ]; then
  # For debugging, use vite dev with electron
  npm run electron:dev &
  DEV_PID=$!
else
  # Production build
  if [[ "$PLATFORM" = "all" ]]; then
    # Build all platforms
    npm run electron:build
  else
    # Build specific platform
    npm run build:electron -- --$PLATFORM -- --$BUILD_MODE
  fi
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "Artifacts:"
if [[ "$PLATFORM" = "all" || "$PLATFORM" = "mac" ]]; then
  echo "  macOS: dist-electron-studio/indiiOS Studio.dmg"
fi
if [[ "$PLATFORM" = "all" || "$PLATFORM" = "win" ]]; then
  echo "  Windows: dist-electron-studio/indiiOS-Studio Setup.exe"
fi
if [[ "$PLATFORM" = "all" || "$PLATFORM" = "linux" ]]; then
  echo "  Linux: dist-electron-studio/indiiOS-studio.AppImage"
fi
