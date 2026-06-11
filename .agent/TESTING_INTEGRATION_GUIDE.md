# Testing System Integration Guide
## For All Agents: How Testing, Rabbit, Sentry & AI Work Together

**This document is available to all agents. Reference it when:**
- Automating code reviews (Rabbit)
- Running integration tests
- Creating GitHub Issues from failures
- Fetching health/monitoring data
- Making quality decisions

---

## The Four Pillars (All Connected)

### 1. **Rabbit (CodeRabbit)** — Code Review Automation
- **What it does:** Automated comments on PRs
- **Where to find:** GitHub PR comments, fetched by `auto-fix.md` workflow
- **Integration with testing:** Rabbit-approved code → must pass integration tests
- **Health metric:** % of PRs passing both Rabbit + integration tests

### 2. **Integration Tests** — Real Validation
- **What it does:** Tests internal code paths with mocked boundaries; validates routing, orchestration, service integration
- **Where to find:** `packages/renderer/src/services/**/*.integration.test.ts` (20+ files)
- **Runs:** After staging deploy (smoke tests), daily (health checks)
- **Health metric:** Integration test pass rate, latency, feature validation
- **Note:** Currently mocked at external boundaries; future: real Google API integration when credentials available

### 3. **Sentry** — Real-World Monitoring
- **What it does:** Tracks errors, APM, user sessions, performance
- **Where to find:** SentryService, dashboard at `/health.html`
- **Integration with testing:** Health checks logged to Sentry, failed tests create events
- **Health metric:** Error rate, API response times (p50/p99), uptime SLA

### 4. **AI System (Antigravity)** — Orchestration
- **What it does:** Agents automate code fixes, testing, issue creation
- **Where to find:** `.agent/workflows/` (auto-fix, health_audit, go, etc.)
- **Integration with testing:** Agents trigger health checks, fetch metrics, create issues
- **Health metric:** Agent automation uptime, issue resolution time

---

## Workflows Using This System

### `auto-fix.md` — Auto-Fix Rabbit + Sentry Issues
```
Rabbit comments on PR → Fetch via GitHub API → Fix code → Run integration tests → Verify pass
Sentry error → Fetch from Sentry API → Fix code → Run integration tests → Verify pass
Create GitHub Issue if tests fail
```
**How testing integrates:** Integration tests are the gatekeeper—fix must actually work, not just look good.

### `ci-validate.md` — CI Validation Gate
```
Run integration tests (real APIs, not mocks)
Fetch Rabbit PR comments → if critical, block merge
Fetch Sentry health → if SLA breached, block merge
Create health report
```
**How testing integrates:** Integration tests are mandatory; Rabbit/Sentry are gates.

### `health_audit.md` — Daily Health Check
```
Run integration tests (subset for speed)
Log results to Sentry
Update health dashboard
If fail: Auto-create GitHub Issue
```
**How testing integrates:** Integration tests feed the health dashboard; Sentry tracks trends.

### `go.md` — Recursive Execution Loop
```
Check Sentry health
Run integration tests
Auto-fix Rabbit comments
Create/update GitHub Issues
Loop until all green
```
**How testing integrates:** Integration tests are the inner loop; Sentry + Rabbit inform decisions.

---

## The Health Dashboard (Unified View - Planned)

**Planned Location:** `/health.html` (static, Firebase Hosting, protected by Firebase Auth)

**Will Show (When Implemented):**
```
BUILD STATUS (GitHub)          RABBIT QUALITY              SENTRY METRICS
↓ CI pass rate                 ↓ PR review velocity        ↓ Error rate
↓ Latest commit                ↓ Critical comments         ↓ API latency (p50/p99)
                               ↓ Auto-fix success rate     ↓ Uptime %

INTEGRATION HEALTH (Daily)     FEATURE VALIDATION          SLA COMPLIANCE
↓ Test results                 ↓ API routing: 100%         ↓ Tests <500ms p50 ✓
↓ Service status               ↓ Distribution: 98.3% pass  ↓ Coverage 70%+ ✓
↓ Test latencies               ↓ Video: 94.1% pass         ↓ Uptime 99.97% ✓
↓ Overall health               ↓ Orchestration working     ↓ All SLAs met ✓
```

**Current Status:**
- Basic dashboard stub created: `packages/renderer/public/health.html`
- Generate command available: `npm run health:generate-dashboard`
- Full metrics integration coming (GitHub, Sentry, Firebase)

**Will Be Updated By (When Complete):**
- GitHub Actions (daily health check workflow)
- Sentry API (error/perf metrics)
- Integration test results

**Accessed By (When Complete):**
- All agents (via API, for decision-making)
- Executives (via dashboard link)

---

## For Agents: How to Integrate with These Systems

### Fetching Integration Test Results
```bash
npm run test:integration:ci          # Run integration tests
# Results logged to Firestore + Sentry
# Health dashboard auto-updates
```

### Creating GitHub Issues from Failures
```bash
gh issue create --title "Health check failed: API routing" \
  --body "Integration test failed. API latency >SLA. See health dashboard."
# Label auto-added: "health-check-failure"
# Rabbit will comment if it's a code issue
```

### Fetching Rabbit Comments on PRs
```bash
gh api repos/OWNER/REPO/pulls/NUMBER/comments \
  --jq '.[] | select(.user.login | contains("rabbit")) | .body'
```

### Fetching Sentry Metrics
```bash
# Via SentryService.ts (already available)
// Error rate, latency, uptime tracking
```

### Updating Workflow Documents
```
When adding new workflow:
1. Add to this guide's "Workflows Using This System" section
2. Explain how integration tests fit in
3. Link to auto-fix and Rabbit integration
4. Document GitHub Issue creation
```

---

## Quick Reference: Which System Does What

| System | Purpose | Automates | Tracks |
|--------|---------|-----------|--------|
| **Rabbit** | Code review quality | PR comments, reviews | Code quality, best practices |
| **Integration Tests** | Real API validation | Test execution, pass/fail | Latency, success rate, feature validation |
| **Sentry** | Real-world monitoring | Error tracking, APM | Errors, latency, sessions, uptime |
| **AI (Agents)** | Orchestration | Fix automation, issue creation, loop control | Automation success, fix quality |

---

## For Agents: Standard Integration Checklist

When you write a new workflow or modify an existing one:

- [ ] Does it use `auto-fix.md` pattern? (Rabbit → test → verify)
- [ ] Does it create GitHub Issues on failure?
- [ ] Does it log to Sentry for monitoring?
- [ ] Does it run integration tests (not mocks)?
- [ ] Does it update the health dashboard?
- [ ] Is it documented in this guide?

---

## Examples

### Example 1: Fix a Sentry Error
```
1. Fetch Sentry error from SentryService
2. Identify code causing it
3. Fix the code
4. Run: npm run test:integration:ci
5. If pass: Create commit + PR
   If fail: Create GitHub Issue with error details
6. Rabbit comments on PR
7. If Rabbit approves + integration tests pass → merge
```

### Example 2: Daily Health Check
```
1. Run: npm run health:check (integration tests)
2. Fetch latest Sentry metrics
3. Generate: npm run health:generate-dashboard
4. If any metric red: Auto-create GitHub Issue
5. If all green: Update dashboard, done
```

### Example 3: Agent Handles PR Review
```
1. Fetch Rabbit comments from PR
2. For each critical comment:
   a. Fix code
   b. Run integration tests
   c. Push fix commit
3. Rabbit auto-comments again
4. If all comments resolved + tests pass → mark ready for merge
```

---

## Notes for All Agents

- **Integration tests are mandatory.** Don't trust Rabbit comments alone; verify with real tests.
- **Sentry is the source of truth for production issues.** Always fetch latest metrics before deciding.
- **GitHub Issues are the record.** Every failure creates an issue for tracking and audit.
- **The dashboard is executive-facing.** Keep it green and accurate.
- **The health check is daily, scheduled.** Don't run it ad-hoc unless debugging.

---

*Last updated: 2026-06-03*  
*Available to: All agents via .agent/ folder*
