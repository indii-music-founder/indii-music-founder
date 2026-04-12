---
description: Comprehensive Developer Experience audit — run periodically to keep DX at 10/10.
---

# /devex-review — Developer Experience Audit

**Run this quarterly or after major architectural changes.**

## 1. Scan Environment Health

// turbo

```bash
npm run doctor
```

Verify all checks pass. If any fail, fix them before proceeding.

## 2. Audit Root Hygiene

// turbo

```bash
# Count files in root (should be < 50)
ls -1 | wc -l

# Look for common stale patterns
ls *.log *.pid *.html *.csv 2>/dev/null && echo "STALE FILES FOUND" || echo "Root is clean"
```

Files that don't belong in root: debug outputs, one-off scripts, temporary data.
Move or delete them.

## 3. Verify Git Hooks

// turbo

```bash
# Check husky is installed and hooks are wired
ls .husky/pre-commit 2>/dev/null && echo "HOOK OK" || echo "HOOK MISSING"
node -e "try{require.resolve('lint-staged');console.log('lint-staged: OK')}catch(e){console.log('lint-staged: MISSING')}"
```

## 4. Audit Script Ergonomics

Review `package.json` scripts section for:

- **Duplicates:** Two scripts that do the same thing
- **Missing:** Common operations that require multi-step manual work
- **Naming:** Consistent `noun:verb` naming convention

## 5. Dependency Health

// turbo

```bash
npm audit --audit-level=high 2>&1 | tail -5
npm outdated --depth=0 2>&1 | head -20
```

## 6. Build Performance

// turbo

```bash
time npm run build 2>&1 | tail -3
```

Target: < 60s for renderer build.

## 7. Test Health

// turbo

```bash
vitest run --reporter=verbose 2>&1 | tail -10
```

Check for:

- Flaky tests (different results on re-run)
- Slow tests (> 5s individual)
- Dead test files (imported but never run)

## 8. Generate Report

Create an artifact at `docs/DEVELOPER_EXPERIENCE_REVIEW.md` with:

- Date and scores (1-10) for each area
- Action items with owners
- Comparison to last review if available

## 9. Update task.md

If issues are found, create `task.md` entries and invoke `/go`.
