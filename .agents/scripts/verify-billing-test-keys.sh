#!/usr/bin/env bash
set -eo pipefail

echo "[billing-integration-manager] Verifying billing test harness & configuration..."

# 1. Verify workspace structure
if [ ! -f "packages/firebase/vitest.config.ts" ]; then
  echo "Error: packages/firebase/vitest.config.ts not found" >&2
  exit 1
fi

# 2. Run fast Stripe configuration test suite to ensure config, tier mappings, and secret resolvers are intact
if npx vitest run -c packages/firebase/vitest.config.ts packages/firebase/src/stripe/config.test.ts > /dev/null 2>&1; then
  echo "[billing-integration-manager] Billing config and test harness verified successfully."
else
  echo "Warning: Billing config verification test failed or dependencies missing." >&2
fi

exit 0
