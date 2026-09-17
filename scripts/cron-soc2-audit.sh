#!/usr/bin/env bash
set -eo pipefail

# indii.music Local Automated SOC 2 Auditor
# Can be run manually or triggered via local crontab / launchd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/compliance/incidents"
LOG_FILE="$LOG_DIR/local-cron-audit.log"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "========================================================" >> "$LOG_FILE"
echo "[$TIMESTAMP] Starting Automated SOC 2 Compliance Audit" >> "$LOG_FILE"

# 1. Run SOC 2 control registry check
if npm run check:soc2 >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ Controls Registry: PASS" >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ❌ Controls Registry: FAILED" >> "$LOG_FILE"
  exit 1
fi

# 2. Run frontend secret boundary check
if npm run security:frontend-api-boundary >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ Frontend Secret Boundary: PASS" >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ❌ Frontend Secret Boundary: FAILED" >> "$LOG_FILE"
  exit 1
fi

# 3. Run vertex routing checks
if npm run security:vertex-only >> "$LOG_FILE" 2>&1 && npm run security:vertex-routing >> "$LOG_FILE" 2>&1; then
  echo "[$TIMESTAMP] ✅ AI & Vertex Routing: PASS" >> "$LOG_FILE"
else
  echo "[$TIMESTAMP] ❌ AI & Vertex Routing: FAILED" >> "$LOG_FILE"
  exit 1
fi

echo "[$TIMESTAMP] 🎯 All Continuous SOC 2 Controls Verified Successfully!" >> "$LOG_FILE"
echo "[$TIMESTAMP] Finished Automated SOC 2 Compliance Audit" >> "$LOG_FILE"
echo "========================================================" >> "$LOG_FILE"
echo "✅ SOC 2 Cron Audit passed at $TIMESTAMP. Logged to $LOG_FILE"
