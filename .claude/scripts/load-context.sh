#!/bin/bash
# SessionStart hook: injects .agent/HANDOFF_STATE.md as context.
# Runs automatically at the start of every session.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [ -f .agent/HANDOFF_STATE.md ]; then
  jq -Rs '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":("## Resuming from previous session:\n\n" + .)}}' \
    .agent/HANDOFF_STATE.md
fi
