#!/bin/bash
set -e

echo "======================================"
echo "    Pre-Push CI Validation Script     "
echo "======================================"

fail=0

echo "--> Step 1: Duplicate Identifier Check in appSlice.ts"
if [ -f packages/renderer/src/core/store/slices/appSlice.ts ]; then
  duplicates=$(grep -rn "^  _last\|^  _cached\|^  current\|^  is" packages/renderer/src/core/store/slices/appSlice.ts | sort | uniq -d)
  if [ -n "$duplicates" ]; then
    echo "❌ Duplicate identifiers found in appSlice.ts:"
    echo "$duplicates"
    fail=1
  else
    echo "✅ No duplicate identifiers."
  fi
fi

echo "--> Step 2: Missing Electron Mocks Check"
if [ -d packages/main/src ]; then
  # Match both vi.mock('electron'...) and vi.doMock('electron'...) — doMock is required
  # in tests that import the SUT dynamically inside beforeAll/beforeEach.
  missing_mocks=$(grep -rLE "vi\.(do)?[Mm]ock.*electron" packages/main/src --include="*.test.ts" | xargs grep -l "electron" 2>/dev/null || true)
  if [ -n "$missing_mocks" ]; then
    echo "❌ Missing vi.mock('electron') in the following packages/main/ tests:"
    echo "$missing_mocks"
    fail=1
  else
    echo "✅ No missing electron mocks."
  fi
fi

echo "--> Step 3: Fast Typecheck"
if ! npm run typecheck; then
  echo "❌ Typecheck failed."
  fail=1
else
  echo "✅ Typecheck passed."
fi

echo "--> Step 4: Running Sharded Tests"
npm test -- --run --reporter=dot --pool=forks --testTimeout=60000 --bail=3 --shard=1/4 &
PID1=$!
npm test -- --run --reporter=dot --pool=forks --testTimeout=60000 --bail=3 --shard=2/4 &
PID2=$!
npm test -- --run --reporter=dot --pool=forks --testTimeout=60000 --bail=3 --shard=3/4 &
PID3=$!
npm test -- --run --reporter=dot --pool=forks --testTimeout=60000 --bail=3 --shard=4/4 &
PID4=$!

wait $PID1 || fail=1
wait $PID2 || fail=1
wait $PID3 || fail=1
wait $PID4 || fail=1

if [ $fail -ne 0 ]; then
  echo "❌ CI Validation FAILED."
  exit 1
else
  echo "✅ All CI checks passed successfully! Ready to push."
  exit 0
fi
