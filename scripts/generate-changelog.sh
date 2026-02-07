#!/usr/bin/env bash
#
# generate-changelog.sh
# Generates a changelog section from conventional commits since the last tag.
#
# Usage:
#   ./scripts/generate-changelog.sh              # Print to stdout
#   ./scripts/generate-changelog.sh --prepend    # Prepend to CHANGELOG.md
#
# Commit format: type(scope): description
#   feat:     New features        -> "Added"
#   fix:      Bug fixes           -> "Fixed"
#   perf:     Performance         -> "Performance"
#   refactor: Refactoring         -> "Changed"
#   docs:     Documentation       -> "Documentation"
#   test:     Testing             -> "Testing"
#   ci:       CI/CD               -> "CI/CD"
#   chore:    Maintenance         -> "Maintenance"

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Get the latest tag, or use initial commit if no tags exist
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)
VERSION=$(node -p "require('./package.json').version")
DATE=$(date +%Y-%m-%d)

# Collect commits since last tag
declare -A SECTIONS
SECTIONS=(
    [feat]="Added"
    [fix]="Fixed"
    [perf]="Performance"
    [refactor]="Changed"
    [docs]="Documentation"
    [test]="Testing"
    [ci]="CI/CD"
    [chore]="Maintenance"
)

OUTPUT=""

for type in feat fix perf refactor docs test ci chore; do
    # Get commits matching this type
    COMMITS=$(git log "${LAST_TAG}..HEAD" --pretty=format:"- %s (%h)" --grep="^${type}" 2>/dev/null || true)

    if [ -n "$COMMITS" ]; then
        # Clean up: remove the type prefix from commit messages
        CLEANED=$(echo "$COMMITS" | sed "s/- ${type}[^:]*: /- /")
        OUTPUT+="### ${SECTIONS[$type]}\n\n${CLEANED}\n\n"
    fi
done

# Uncategorized commits (don't match conventional format)
UNCATEGORIZED=$(git log "${LAST_TAG}..HEAD" --pretty=format:"- %s (%h)" \
    --invert-grep \
    --grep="^feat" --grep="^fix" --grep="^perf" --grep="^refactor" \
    --grep="^docs" --grep="^test" --grep="^ci" --grep="^chore" \
    --grep="^Merge" --grep="^merge" 2>/dev/null || true)

if [ -n "$UNCATEGORIZED" ]; then
    OUTPUT+="### Other\n\n${UNCATEGORIZED}\n\n"
fi

if [ -z "$OUTPUT" ]; then
    echo "No new commits since ${LAST_TAG}"
    exit 0
fi

HEADER="## [${VERSION}] - ${DATE}\n\n"
FULL_OUTPUT="${HEADER}${OUTPUT}---\n"

if [ "${1:-}" = "--prepend" ]; then
    # Prepend to CHANGELOG.md after the header
    CHANGELOG="$REPO_ROOT/CHANGELOG.md"
    if [ -f "$CHANGELOG" ]; then
        # Insert after "## [Unreleased]" section
        TEMP=$(mktemp)
        echo -e "$FULL_OUTPUT" > "$TEMP"
        # Simple approach: prepend new section after first ---
        awk -v new="$(cat "$TEMP")" '
            /^## \[Unreleased\]/ { print; found=1; next }
            found && /^---/ { print "\n" new; found=0; next }
            { print }
        ' "$CHANGELOG" > "${CHANGELOG}.tmp"
        mv "${CHANGELOG}.tmp" "$CHANGELOG"
        rm "$TEMP"
        echo "Changelog updated: ${CHANGELOG}"
    else
        echo -e "# Changelog\n\nAll notable changes to indiiOS are documented in this file.\n\n## [Unreleased]\n\n---\n\n${FULL_OUTPUT}" > "$CHANGELOG"
        echo "Changelog created: ${CHANGELOG}"
    fi
else
    echo -e "$FULL_OUTPUT"
fi
