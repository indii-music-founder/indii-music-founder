#!/bin/bash
# SessionStart hook: injects HANDOFF_STATE.md as context.
# If node_modules is missing/empty (fresh machine after mobile), auto-suggests /walk.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [ ! -f .agent/HANDOFF_STATE.md ]; then
  exit 0
fi

HANDOFF=$(cat .agent/HANDOFF_STATE.md)

# Detect fresh machine: node_modules absent or empty
FRESH_MACHINE=false
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  FRESH_MACHINE=true
fi

if [ "$FRESH_MACHINE" = true ]; then
  # Inject handoff + walk prompt
  jq -Rs '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":("## Mobile session detected — run /walk to resume and drive to prime\n\n" + .)}}' \
    .agent/HANDOFF_STATE.md
else
  # Standard context injection
  jq -Rs '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":("## Resuming from previous session:\n\n" + .)}}' \
    .agent/HANDOFF_STATE.md
fi
