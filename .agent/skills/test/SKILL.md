---
name: test
description: Context-aware test runner for indiiOS. Automatically identifies which tests to run based on the current modified files, then triages failures. Covers Vitest unit tests, Playwright E2E, and Python pytest.
---

# @test — Smart Test Runner

## Purpose

Intelligently selects and runs the correct tests based on what has been modified, without the agent having to manually figure it out. If a file path is known, this skill maps it to the right test file and runner.

## When to Invoke

- After any code change, before committing
- As part of the `/go` Gauntlet step
- When a CI pipeline fails and you need to reproduce locally
- After fixing a bug, to confirm the fix holds

---

## Step 1 — Test Discovery

Map the changed file → correct test:

| Changed File Pattern | Test to Run |
|---------------------|------------|
| `src/services/X.ts` | `X.test.ts` or `find("*X*test*")` |
| `src/modules/**/Comp.tsx` | `Comp.test.tsx` or `__tests__/Comp.test.tsx` |
| `firestore.rules` | `firestore.rules.test.ts` |
| `execution/*.py` | `python3 -m pytest execution/tests/` |
| `functions/src/*.ts` | `functions/src/__tests__/*.test.ts` |
| No specific match | Run full unit suite: `npm test -- --run` |

```bash
# Find related test file for a given source file
find . -name "*ComponentName*test*" -o -name "*ComponentName*spec*" | grep -v node_modules
```

---

## Step 2 — Execution Protocol

### Unit Tests (Vitest)

```bash
# Run specific file
npm test -- --run src/services/rag/GeminiRetrievalService.test.ts

# Run all, once
npm test -- --run

# With coverage
npm test -- --run --coverage
```

### E2E Tests (Playwright)

```bash
# Requires dev server running on :4242
npm run dev &
npm run test:e2e -- --grep "feature name"

# Full E2E suite
npm run test:e2e
```

### Python Tests

```bash
python3 -m pytest execution/tests/ -v
python3 -m pytest python/tools/ -v
```

---

## Step 3 — Triage Protocol

If any tests fail:

```bash
# Pipe failures to log
npm test -- --run 2>&1 | tee test_failures.log

# Look for patterns
grep -E "FAIL|Error|expect|received" test_failures.log | head -30
```

**Two-Strike Pivot Rule:**

- Fix attempt #1 → re-run tests
- Fix attempt #2 → re-run tests  
- If still failing → **stop patching**, add extensive logging, re-diagnose root cause from scratch

---

## Step 4 — Fallback

If no related test file found:

```bash
npm run typecheck   # TypeScript must pass with 0 errors
npm run lint        # ESLint must pass
```

---

## Test Setup Reference

Key mocks provided globally in `src/test/setup.ts`:

- Firebase (auth, firestore, storage, functions, messaging, app-check, AI)
- AgentZeroService — mocked to prevent 60s timeouts
- ResizeObserver, Canvas, matchMedia
- `@testing-library/jest-dom` matchers

Any test importing Firebase services automatically gets the mock — no manual setup needed.
