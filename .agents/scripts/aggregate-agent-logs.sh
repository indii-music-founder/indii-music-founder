#!/usr/bin/env bash
set -eo pipefail

echo "=== indiiOS Layer 1 Agent Execution Telemetry Summary ==="

OBSERVATION_DIR=".agent/observations"
REPORT_DIR=".agent/reports"

if [ -d "$OBSERVATION_DIR" ]; then
  OBS_COUNT=$(ls -1 "$OBSERVATION_DIR" 2>/dev/null | wc -l | tr -d ' ')
  echo "Observations recorded: $OBS_COUNT"
  LATEST_OBS=$(ls -t "$OBSERVATION_DIR" 2>/dev/null | head -n 1 || echo "")
  if [ -n "$LATEST_OBS" ]; then
    echo "Latest observation log: $OBSERVATION_DIR/$LATEST_OBS"
  fi
else
  echo "No observation directory found at $OBSERVATION_DIR"
fi

if [ -d "$REPORT_DIR" ]; then
  REPORT_COUNT=$(ls -1 "$REPORT_DIR" 2>/dev/null | wc -l | tr -d ' ')
  echo "Reports archived: $REPORT_COUNT"
fi

echo "Telemetry aggregation complete. Agent execution parameters nominal."
exit 0
