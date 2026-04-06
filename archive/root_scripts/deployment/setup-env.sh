#!/bin/bash
# Quick setup script for .env configuration

echo "🔧 indiiOS Environment Setup"
echo "======================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "📋 Current .env status:"
echo ""

# Check each required key
check_key() {
    local key=$1
    local value=$(grep "^${key}=" .env | cut -d'=' -f2-)
    if [ -z "$value" ]; then
        echo "  ❌ $key - MISSING"
        return 1
    else
        echo "  ✅ $key - SET"
        return 0
    fi
}

required_missing=0

echo "Required Keys:"
check_key "VITE_API_KEY" || ((required_missing++))
check_key "VITE_FIREBASE_API_KEY" || ((required_missing++))
check_key "VITE_FIREBASE_MESSAGING_SENDER_ID" || ((required_missing++))
check_key "VITE_FIREBASE_APP_ID" || ((required_missing++))

echo ""
echo "Optional Keys:"
check_key "VITE_FIREBASE_MEASUREMENT_ID"
check_key "VITE_GOOGLE_MAPS_API_KEY"

echo ""
echo "======================================"

if [ $required_missing -gt 0 ]; then
    echo "⚠️  $required_missing required key(s) missing"
    echo ""
    echo "To add keys:"
    echo "  1. Get Gemini API key: https://aistudio.google.com/app/apikey"
    echo "  2. Get Firebase config: https://console.firebase.google.com/project/indiios-v-1-1/settings/general"
    echo "  3. Edit .env: nano .env"
    echo ""
    exit 1
else
    echo "✅ All required keys configured!"
    echo ""
    echo "Ready to start development:"
    echo "  npm run dev"
    echo ""
    exit 0
fi
