#!/usr/bin/env bash
set -eo pipefail
echo "Verifying GCP and Firebase authentication..."
if ! command -v gcloud &> /dev/null; then
  echo "gcloud CLI is required but not installed." >&2
  exit 1
fi
echo "GCP environment verified."
exit 0
