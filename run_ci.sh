#!/bin/bash
set -e
export NODE_OPTIONS="--max-old-space-size=8192"
echo "Installing..."
npm install --no-audit --no-fund --maxsockets=3
echo "Committing..."
git commit -am "fix(ci): restore package.json and lint variables" || true
echo "Typechecking..."
npm run typecheck
echo "Testing..."
npm test -- --run
echo "Pushing..."
git push origin main
