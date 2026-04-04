#!/bin/bash
# Installs local git hooks for indiiOS.
# Run once per machine: bash .claude/scripts/setup-git-hooks.sh

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Not a git repo"; exit 1; }
HOOKS_DIR="$REPO_ROOT/.git/hooks"

cat > "$HOOKS_DIR/pre-commit" <<'HOOK'
#!/bin/bash
# indiiOS pre-commit: lint + typecheck staged TS/TSX files

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')

if [ -z "$STAGED" ]; then
  exit 0
fi

# Skip if node_modules not installed
if [ ! -d "node_modules" ]; then
  echo "⚠ Skipping lint/typecheck — run npm install first"
  exit 0
fi

echo "Running ESLint on staged files..."
LINT_OUTPUT=$(echo "$STAGED" | xargs npx eslint --max-warnings=0 2>&1)
LINT_EXIT=$?

# Exit code 2 = ESLint config/env error (not a lint failure) — let it through
if [ $LINT_EXIT -eq 2 ]; then
  echo "⚠ ESLint config error (skipping): $LINT_OUTPUT"
  exit 0
fi

if [ $LINT_EXIT -ne 0 ]; then
  echo "$LINT_OUTPUT"
  echo ""
  echo "ESLint errors found. Fix before committing (npm run lint:fix)"
  exit 1
fi

echo "Running TypeScript check..."
TS_OUTPUT=$(npm run typecheck 2>&1)
TC_EXIT=$?

if [ $TC_EXIT -ne 0 ]; then
  echo "$TS_OUTPUT"
  echo ""
  echo "TypeScript errors found. Fix before committing."
  exit 1
fi

exit 0
HOOK

chmod +x "$HOOKS_DIR/pre-commit"
echo "✓ pre-commit hook installed at $HOOKS_DIR/pre-commit"
