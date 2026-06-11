# Testing System Quick Reference
## For All Agents to Use

**You need this if you're working on:**
- Fixing code (use integration tests to verify)
- Creating GitHub Issues
- Running workflows (auto-fix, ci-validate, go)
- Making quality decisions

---

## TL;DR: The Four Systems

| System | Does What | You Use It By |
|--------|-----------|---------------|
| **Rabbit** | Code review automation | Fetch PR comments, auto-fix them |
| **Integration Tests** | Real API validation | Run `npm run test:integration:ci` after fixes |
| **Sentry** | Real-world monitoring | Fetch errors, fix, verify with tests |
| **Health Dashboard** | Executive view | `npm run health:generate-dashboard` daily |

---

## The Pattern (Every Agent Should Follow)

```
1. Get task (Sentry error, Rabbit comment, GitHub Issue)
2. Fix code
3. Run: npm run test:integration:ci (MANDATORY - not lint/typecheck alone)
4. If tests pass → commit + push
5. If tests fail → create GitHub Issue with error
6. Done
```

**Key rule:** Integration tests are mandatory. Lint/typecheck alone isn't enough.

---

## Where to Find Everything

| Thing | Location |
|-------|----------|
| Full guide | `.agent/TESTING_INTEGRATION_GUIDE.md` |
| Integration tests | `packages/renderer/src/services/**/*.integration.test.ts` (~20+ files) |
| Sentry service | `packages/renderer/src/services/observability/SentryService.ts` |
| Health dashboard | Planned (see `.claude/plans/encapsulated-riding-spark.md`) |

---

## Commands You'll Use

```bash
# Run integration tests (real APIs, not mocks)
npm run test:integration:ci

# Generate health dashboard (Sentry + CI + test metrics)
npm run health:generate-dashboard

# Run health checks (daily scheduled)
npm run health:check

# Fetch Sentry errors (in your code/script)
// Use SentryService.ts or Sentry API directly

# Fetch Rabbit comments (in your code/script)
gh api repos/OWNER/REPO/pulls/NUMBER/comments --jq '.[] | select(.user.login | contains("rabbit"))'
```

---

## Integration Tests: What They Test

✓ Service orchestration and routing logic  
✓ API handler code paths (with mocked Firebase boundaries)  
✓ Multi-service delegation and error handling  
✓ Response format, status codes, timing  

**Current Design (Mocked):**
External dependencies (Google APIs, Firebase Admin) are mocked to avoid credential requirements in CI. Tests exercise real internal code paths but assume stable mocked boundaries.

**Future Enhancement:**
Real Google API integration tests when credentials/infrastructure available.

**NOT tested by integration tests:**
- Code style (Rabbit does this)
- Production errors (Sentry tracks these)
- Unit-level logic (unit tests do this)

---

## GitHub Issue Creation (When Tests Fail)

```bash
gh issue create --title "Integration test failed: $REASON" \
  --body "Test failure details. Run: npm run test:integration:ci to reproduce." \
  --label "health-check-failure"
```

**This creates a record. Rabbit will see it and comment if it's code-related.**

---

## When You're Stuck

1. Check `.agent/TESTING_INTEGRATION_GUIDE.md` (full details)
2. Check ERROR_LEDGER.md (common patterns)
3. Run integration tests locally: `npm run test:integration`
4. Create GitHub Issue with output
5. Rabbit will comment

---

## Which Workflows Use This?

- `auto-fix.md` — Fix Sentry/Rabbit issues + verify with tests
- `ci-validate.md` — Gate PRs: integration tests + Rabbit + Sentry
- `go.md` — Recursive loop: fix → test → issue → loop
- `health_audit.md` — Daily health check: run tests → dashboard → issues

---

**All workflows are updated to require integration tests before committing.**

**Last updated:** 2026-06-03
