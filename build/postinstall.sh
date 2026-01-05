#!/bin/bash

# Post-installation script for indiiOS Studio
# This script runs after installation to complete setup

set -e

echo "✓ Starting indiiOS Studio post-installation..."

# Create user data directory
mkdir -p ~/Library/Application\ Support/indiiOS-Studio
mkdir -p ~/Documents/indiiOS-Studio/Projects
mkdir -p ~/Documents/indiiOS-Studio/Templates
mkdir -p ~/Library/Application\ Support/indiiOS-Studio/Logs

# Create template projects
TEMPLATE_DIR=~/Documents/indiiOS-Studio/Templates
if [ ! -d "$TEMPLATE_DIR/Music Release" ]; then
    mkdir -p "$TEMPLATE_DIR/Music Release"
    touch "$TEMPLATE_DIR/Music Release/brief.md"
    echo "# Music Release Template" > "$TEMPLATE_DIR/Music Release/brief.md"
    echo "- Release name" >> "$TEMPLATE_DIR/Music Release/brief.md"
    echo "- Release date" >> "$TEMPLATE_DIR/Music Release/brief.md"
    echo "- Distributor requirements" >> "$TEMPLATE_DIR/MusicRelease/brief.md"
    
    mkdir -p "$TEMPLATE_DIR/Music Release/assets"
    mkdir -p "$TEMPLATE_DIR/Music Release/artwork"
    mkdir -p "$TEMPLATE_DIR/Music Release/tracks"
    mkdir -p "$TEMPLATE_DIR/Music Release/metadata"
fi

if [ ! -d "$TEMPLATE_DIR/Social Campaign" ]; then
    mkdir -p "$TEMPLATE_DIR/Social Campaign"
    touch "$TEMPLATE_DIR/Social Campaign/campaign.md"
    echo "# Social Campaign Template" > "$TEMPLATE_DIR/Social Campaign/campaign.md"
    echo "- Campaign name" >> "$TEMPLATE_DIR/Social Campaign/campaign.md"
    echo "- Launch date" >> "$TEMPLATE_DIR/Social Campaign/campaign.md"
    echo "- Platform targets" >> "$TEMPLATE_DIR/Social Campaign/campaign.md"
fi

# Set up resource directories
RESOURCES_DIR=~/Library/Application\ Support/indiiOS-Studio/Resources
mkdir -p "$RESOURCES_DIR/instruments"

echo "✓ Created resource directories"

# Check for required dependencies
echo "✓ Checking system dependencies..."

# Check for FFMPEG (required for video processing)
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version 2>&1 | grep -oP 'ffmpeg version \K[^\s]*\K[^\s]*(\d+\.\d+\.\d+)')
    echo "✓ FFMPEG found: $FFMPEG_VERSION"
else
    echo "⚠️  FFMPEG not found. Video features may be limited."
fi

# Check for Python (for future Python instruments)
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -V 2>&1 | grep -oP 'Python \K[^\s]*\K[^\s]*(\d+\.\d+\.\d+)')
    echo "✓ Python found: $PYTHON_VERSION"
else
    echo "ℹ️  Python not found. Local mode instruments unavailable (fallback to cloud)."
fi

# Create log file
LOG_FILE=~/Library/Application\ Support/indiiOS-Studio/Logs/setup.log
echo "$(date): indiiOS Studio installation completed" >> "$LOG_FILE"

echo "✓ indiiOS Studio post-installation complete"
echo ""
echo "To get started:"
echo "  1. Open indiiOS Studio from Applications"
echo "  2. Sign in with your account"
echo "  3. Check usage dashboard at Settings → Usage"
echo " 4. Explore available instruments in Agent module"
