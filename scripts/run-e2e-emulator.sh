#!/bin/bash
set -e

echo "======================================"
echo "    E2E Test Runner with Emulator     "
echo "======================================"

# Teardown any lingering java processes on port 8080 (Firestore emulator default)
if lsof -i :8080 | grep java > /dev/null; then
    echo "⚠️  Found lingering java process on port 8080. Terminating..."
    kill -9 $(lsof -t -i :8080)
    sleep 2
fi

# Ensure port 4242 is also free if Vite is lingering
if lsof -i :4242 > /dev/null; then
    echo "⚠️  Found lingering process on port 4242. Terminating..."
    kill -9 $(lsof -t -i :4242)
    sleep 2
fi

echo "🚀 Starting Playwright E2E tests with Firestore Emulator..."
npx firebase emulators:exec --only firestore "npm run test:e2e"
