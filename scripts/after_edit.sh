#!/bin/bash

# $1 is the filename passed by the agent
CHANGED_FILE="$1"

echo "🤖 Guardrails active on: $CHANGED_FILE"

# 1. Frontend Guardrails (JavaScript/TypeScript)
if [[ "$CHANGED_FILE" == *.ts ]] || [[ "$CHANGED_FILE" == *.tsx ]]; then
    # Automatically fix syntax/linting errors so the AI doesn't have to
    echo "Running ESLint Fix..."
    npx eslint "$CHANGED_FILE" --fix
fi

# 2. Backend Guardrails (Rust/Server) - As per Source 17
if [[ "$CHANGED_FILE" == *.rs ]]; then
    echo "Running Cargo Clippy..."
    # --allow-dirty ensures it runs even with uncommitted changes
    cargo clippy --fix --allow-dirty --allow-staged
    
    # 3. Type Synchronization (Source 9, 12)
    # If backend changes, regenerate frontend bindings immediately
    echo "Regenerating Types for Frontend..."
    # Replace this with your specific binding generator command
    npm run generate-types
fi

# Always return true so we don't crash the agent on a warning
exit 0
