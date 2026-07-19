#!/bin/bash
# Local-only handoff snapshot: runs on every Stop event.
# It must never stage, commit, or push repository history.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
DATE=$(date "+%Y-%m-%d %H:%M %Z")
COMMITS=$(git log --oneline -10 2>/dev/null || echo "none")
STATUS=$(git status --short 2>/dev/null || echo "")
HANDOFF_PATH=".agent/checkpoints/local/HANDOFF_STATE.md"

mkdir -p "$(dirname "$HANDOFF_PATH")"

cat > "$HANDOFF_PATH" <<EOF
# Handoff State
**Updated:** $DATE
**Branch:** \`$BRANCH\`

## Recent Commits
\`\`\`
$COMMITS
\`\`\`

## Working State
\`\`\`
${STATUS:-clean working tree}
\`\`\`

## Decisions
- Session checkpoint created
- Work state preserved for context continuity

## Next Steps
- Review working state changes
- Continue development from last known state
- Run tests if changes are significant

---
*Auto-generated locally by the Stop hook. This file is ignored and must never be committed.*
EOF

printf 'Local handoff saved to %s; no git commit or push performed.\n' "$HANDOFF_PATH"
