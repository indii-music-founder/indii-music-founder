#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== indiiOS Gemini Secret Update ===${NC}"

# Check for firebase-tools
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Error: firebase-tools is not installed.${NC}"
    exit 1
fi

KEY="$1"

# If no key provided, try to find it or ask
if [ -z "$KEY" ]; then
    # Try to grep from local .env if it exists
    if [ -f .env ]; then
        # Use exact match with ^GEMINI_API_KEY= (anchored to line start)
        # Extract everything after the first '=' to handle keys containing '='
        DETECTED_KEY=$(grep -E "^GEMINI_API_KEY=" .env | head -1 | sed 's/^GEMINI_API_KEY=//')

        # Fallback to VITE_API_KEY if GEMINI_API_KEY not found
        if [ -z "$DETECTED_KEY" ]; then
            DETECTED_KEY=$(grep -E "^VITE_API_KEY=" .env | head -1 | sed 's/^VITE_API_KEY=//')
        fi

        if [ -n "$DETECTED_KEY" ]; then
            echo -e "Found API key in .env"
        DETECTED_KEY=$(grep VITE_API_KEY .env | cut -d '=' -f2)
        if [ ! -z "$DETECTED_KEY" ]; then
            echo -e "Found key in .env: ${DETECTED_KEY:0:5}..."
            read -p "Use this key? (y/n) " USE_DETECTED
            if [[ "$USE_DETECTED" == "y" ]]; then
                KEY="$DETECTED_KEY"
            fi
        fi
    fi
fi

if [ -z "$KEY" ]; then
    echo -e "${RED}Please provide the Gemini API Key.${NC}"
    read -s -p "Enter API Key: " KEY
    echo ""
fi

if [ -z "$KEY" ]; then
    echo -e "${RED}No key provided. Aborting.${NC}"
    exit 1
fi

echo -e "Updating GEMINI_API_KEY secret in Firebase..."

# Pipe the key to firebase functions:secrets:set to avoid interactive prompt
echo -n "$KEY" | firebase functions:secrets:set GEMINI_API_KEY

echo -e "${GREEN}Secret updated successfully!${NC}"
echo -e "You may need to redeploy functions for the change to take effect immediately, although secrets are usually live."
echo -e "Run: firebase deploy --only functions:generateImageV3,functions:editImage"
