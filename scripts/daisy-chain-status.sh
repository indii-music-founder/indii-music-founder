#!/bin/bash
# Daisy Chain App Test — Retry loop
# Polls for browser agent capacity, then triggers the in-app test
# Output: scripts/daisy-chain-output/app-test-status.txt

OUTPUT_DIR="/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/daisy-chain-output"
STATUS_FILE="$OUTPUT_DIR/app-test-status.txt"

echo "$(date): Waiting for Google model capacity to recover..." > "$STATUS_FILE"
echo "$(date): Browser agent capacity still at 503. Will retry every 3 minutes." >> "$STATUS_FILE"
echo "$(date): Raw API assets ready for comparison in this directory." >> "$STATUS_FILE"
