#!/bin/bash
# Deploy Firebase Storage CORS configuration
# Usage: ./scripts/deploy-cors.sh
# Requires: gsutil (part of Google Cloud SDK)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CORS_FILE="$PROJECT_ROOT/cors.json"

# Get bucket from firebase config or .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    BUCKET=$(grep VITE_FIREBASE_STORAGE_BUCKET "$PROJECT_ROOT/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
fi

if [ -z "${BUCKET:-}" ]; then
    echo "❌ VITE_FIREBASE_STORAGE_BUCKET not found in .env"
    echo "   Set it manually: BUCKET=your-bucket.firebasestorage.app ./scripts/deploy-cors.sh"
    exit 1
fi

echo "📦 Deploying CORS config to gs://$BUCKET"
echo "   Config: $CORS_FILE"

gsutil cors set "$CORS_FILE" "gs://$BUCKET"

echo "✅ CORS deployed. Verifying..."
gsutil cors get "gs://$BUCKET"
