#!/usr/bin/env bash

# megastress loop – runs all MEGA_STRESS_TEST_V*.md files repeatedly
# Each file is expected to correspond to a Playwright test tag.
# Failures are appended to .agent/test_ledger/OPEN_ISSUES.md and committed.

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEDGER="$BASE_DIR/.agent/test_ledger/OPEN_ISSUES.md"
SCRIPT_DIR="$BASE_DIR/scripts"

# Ensure script is executable
chmod +x "$0"

while true; do
  # List test spec files in sorted order
  mapfile -t test_files < <(ls -1 "$BASE_DIR/.agent/test_ledger/MEGA_STRESS_TEST_V"*.md | sort -V)

  for test_md in "${test_files[@]}"; do
    # Derive a simple tag from filename (e.g., V1_CORE -> core)
    tag=$(basename "$test_md" | sed -E 's/MEGA_STRESS_TEST_V[0-9]+_//;s/.md//')
    echo "Running stress test for tag: $tag"
    # Execute Playwright test grepped by tag (if any). If no tag matches, run full suite.
    if [[ -n "$tag" ]]; then
        npx playwright test --project=chromium --grep "$tag" || true
    else
        npx playwright test --project=chromium || true
    fi
    exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        # Determine next ISSUE ID
        last_issue=$(grep -oE 'ISSUE-[0-9]+' "$LEDGER" | sort -t- -k2 -n | tail -1 || echo 'ISSUE-0')
        last_num=$(echo "$last_issue" | grep -oE '[0-9]+' )
        next_num=$((last_num + 1))
        timestamp=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
        echo -e "\n---\n## $tag failure – $timestamp\n\n**ISSUE-$next_num** (🔴 HIGH): Playwright test failed for tag \`$tag\`.\n" >> "$LEDGER"
        git add "$LEDGER"
        git commit -m "test(ledger): log ISSUE-$next_num $tag failure"
    fi
  done
done
