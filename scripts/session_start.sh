#!/bin/bash
set -e

node scripts/assert-canonical-repo.mjs

echo "🧹 Cleaning environment..."

# 1. Faster dependency check
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules missing. Performing full install..."
    npm install
else
    # Quick update if package.json is newer than node_modules
    if [ "package.json" -nt "node_modules" ]; then
        echo "🔄 package.json updated. Synchronizing dependencies..."
        npm install --prefer-offline --no-audit --no-fund
    else
        echo "✅ Dependencies are up to date."
    fi
fi

# 2. Critical type sync
echo "🧬 Generating types..."
npm run generate-types || echo "⚠️ Type generation failed, proceeding with caution."

echo "Environment ready."
