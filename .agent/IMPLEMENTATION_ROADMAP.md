---
description: Remaining implementation work for world-class testing system (Phase 2-4)
---

# Implementation Roadmap — Testing System Phases 2–4

**Status:** Phase 1 (planning + stubs) complete. Phases 2–4 (real implementation) pending.

**Current Date:** 2026-06-03  
**Last Updated By:** Haiku 4.5  
**For Next Agent:** Implement real integration tests, health dashboard, and continuous monitoring

---

## Executive Summary

**What's Done:**
- ✅ Planning document (`encapsulated-riding-spark.md`) with full vision
- ✅ Integration guide (`TESTING_INTEGRATION_GUIDE.md`) explaining how Rabbit/Sentry/Agents work together
- ✅ npm scripts wired up: `test:integration:ci`, `health:check`, `health:generate-dashboard`
- ✅ Workflow stubs created: `health_audit.md`, `auto-fix.md` updated, `go.md` updated
- ✅ Health dashboard stub: `scripts/generate-health-dashboard.ts` (basic template only)
- ✅ Documentation is now **factually accurate** (no more false "real APIs" claims)

**What's Missing (Real Work):**
- ❌ Actual integration tests calling real Google APIs
- ❌ Real health dashboard with live metrics from GitHub/Sentry/Firebase
- ❌ Scheduled health checks (GitHub Actions or Cloud Scheduler)
- ❌ Sentry API integration for metrics fetching
- ❌ GitHub Issues automation for health check failures
- ❌ Firebase Firestore `healthChecks` collection schema and writes

---

## Phase 2: Real Health Dashboard Implementation

**Goal:** Create executable, metrics-driven dashboard that proves the app works.

**Files to Modify/Create:**

### 1. Enhance `scripts/generate-health-dashboard.ts`
**Current State:** Generates empty template HTML  
**Required Changes:**
- Fetch GitHub CI logs → extract test pass rate, latest commit, build status
- Fetch Sentry metrics via SentryService → error rate, API latency (p50/p99), uptime %
- Fetch integration test results (from Firestore `healthChecks` collection when available)
- Render real data into HTML dashboard
- Add styling: status color indicators (green/yellow/red), metric boxes, SLA compliance badges
- Export static HTML to `packages/renderer/public/health.html`

**Acceptance Criteria:**
```bash
npm run health:generate-dashboard
# Output: packages/renderer/public/health.html exists with:
# - Build status (pass rate, latest commit)
# - Integration health (test results)
# - Sentry metrics (error rate, latency)
# - SLA compliance (uptime %, response times vs targets)
# All sections populated with real data (not placeholders)
```

### 2. Create `scripts/fetch-metrics.ts` (Shared Utilities)
**Purpose:** Reusable functions to fetch metrics from GitHub, Sentry, Firebase

**Functions Needed:**
```typescript
getGitHubCIStatus() → { passRate, latestCommit, buildStatus }
getSentryMetrics() → { errorRate, apiLatencyP50, apiLatencyP99, uptimePercent }
getIntegrationTestResults() → { passRate, totalTests, latencies }
```

**Implementation Notes:**
- Use existing SentryService for Sentry metrics
- Use GitHub API (`gh api`) for CI logs
- Query Firestore for integration test results (schema defined in Phase 3)

### 3. Update `packages/renderer/public/index.html` (or add link)
- Add link to health dashboard at `/health.html`
- Deploy dashboard to Firebase Hosting with Firebase Auth protection
- Verify accessible to team only

---

## Phase 3: Real Integration Tests (Calling Actual APIs)

**Goal:** Create tests that validate the app actually works with real services.

**Current Blockers:**
- ❌ Google GenAI API credentials not in `.env`
- ❌ Firebase Admin SDK credentials not configured for integration tests
- ❌ Integration test files don't exist yet

**Files to Create:**

### 1. `packages/firebase/src/test/integration.setup.ts`
**Purpose:** Shared utilities for all integration tests

**Required Exports:**
```typescript
// Test request/response builders
createTestRequest(method, path, body?, headers?)
createTestResponse()

// Auth helpers
createTestFirebaseToken()
getTestUserContext()

// Service initialization with real credentials
initializeRealServices()
teardownServices()

// Assertion helpers
assertApiLatency(actual, targetMs)
assertSuccess(response, expectedStatus = 200)
```

### 2. `packages/firebase/src/functions/api/__tests__/router.integration.test.ts`
**What to Test:**
- `getTrack()` → calls Firebase, returns real track data
- `createTrack()` → creates real Firestore document
- `updateTrack()` → modifies real Firestore document
- `deleteTrack()` → removes real Firestore document
- Error cases: 404, 403 (auth), validation errors

**Structure:**
```typescript
describe('API Router (Integration)', () => {
  beforeAll(() => initializeRealServices())
  afterAll(() => teardownServices())
  
  it('should fetch track from Firestore', async () => {
    const response = await getTrack(testTrackId)
    assertSuccess(response)
    expect(response.body).toHaveProperty('id', 'title', 'metadata')
  })
  
  it('should create and store track in Firestore', async () => {
    const response = await createTrack(validTrackData)
    assertSuccess(response, 201)
    // Verify document exists in Firestore
  })
  
  // ... more tests
})
```

### 3. `packages/firebase/src/functions/creative/__tests__/gateway.integration.test.ts`
**What to Test:**
- `generateImageV3()` → calls REAL Google GenAI API, returns image
- `generateVideoV2()` → calls REAL Google GenAI API, returns video
- Latency assertions: image <3s p50, video <15s p50
- Error handling: quota exceeded, invalid prompt

**Acceptance Criteria:**
```bash
npm run test:integration:ci
# Output: All tests pass with real API calls
# - No mocks for Google GenAI API
# - Actual generation happens
# - Latencies measured and logged
```

### 4. `packages/renderer/src/services/agent/__tests__/AgentExecutor.integration.test.ts`
**What to Test:**
- Multi-agent orchestration with real tool execution
- Swarm delegation (one agent calling another)
- Tool invocation (real API calls, not mocks)
- Agent communication through Firestore

---

## Phase 4: Continuous Monitoring (Scheduled Health Checks)

**Goal:** Run integration tests on a schedule, log results, alert on failures.

**Files to Create:**

### 1. `.github/workflows/health-check.yml`
**Purpose:** Scheduled workflow to run integration tests daily (or hourly)

**Spec:**
```yaml
name: Health Check
on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9am UTC (or adjust to user's timezone)

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-env  # Existing setup action
      - run: npm run test:integration:ci
      - run: npm run health:generate-dashboard
      - name: Upload results to Firestore
        run: npm run scripts/log-health-check.ts
      - name: Create GitHub Issue on failure
        if: failure()
        run: |
          gh issue create --title "Health Check Failed" \
            --body "Integration tests or health checks failed. See logs." \
            --label "health-check-failure"
```

### 2. `scripts/log-health-check.ts`
**Purpose:** After integration tests run, log results to Firestore

**Required:**
```typescript
// Parse test results from stdout/logs
const results = parseTestOutput()

// Write to Firestore collection `healthChecks`
await admin.firestore().collection('healthChecks').add({
  timestamp: FieldValue.serverTimestamp(),
  testPassRate: results.passRate,
  testCount: results.total,
  failedTests: results.failures,
  latencies: results.latencies,
  sentryMetrics: fetchedFromSentry,
  ciStatus: gitHubCIStatus,
})

// Alert if SLA breached
if (results.latencies.p99 > SLA_TARGETS.apiLatencyP99) {
  // Create GitHub Issue
}
```

### 3. Update `packages/firebase/firestore.rules`
**Purpose:** Allow health-check service account to write results

**Add Rule:**
```
match /healthChecks/{document=**} {
  allow read: if request.auth.uid != null;
  allow create, update: if request.auth.uid == 'health-check-service' || isAdmin();
}
```

### 4. Update `scripts/generate-health-dashboard.ts` (Phase 4 enhancement)
**Addition:**
- Fetch latest health check results from Firestore `healthChecks` collection
- Include 7-day trend graph (test pass rate over time)
- Show SLA breaches (if latencies exceeded targets)
- Display last-checked timestamp

---

## Prerequisites & Credentials

**Before Starting Implementation:**

1. **Google GenAI API Credentials**
   - Ensure API key is in `.env` (or secure credential store)
   - Test locally: `npm run test:integration:ci` should work with real API
   - Verify quota limits (image gen, video gen)

2. **Firebase Admin SDK**
   - Ensure service account JSON is in `.env` or `FIREBASE_ADMIN_SDK_JSON`
   - Integration tests must use real Firestore (not emulator)
   - Create test Firestore collection `healthChecks` with schema

3. **Sentry Access**
   - Ensure `SENTRY_TOKEN` is in `.env`
   - SentryService already exists; reuse it in `fetch-metrics.ts`

4. **GitHub Token**
   - Ensure `GITHUB_TOKEN` is in `.env` (for GitHub Issues creation)
   - Verify repo has branch protection disabled (for auto-fix commits)

---

## Execution Order (Recommended)

1. **Phase 2a:** Implement `scripts/fetch-metrics.ts` (fetch utilities)
2. **Phase 2b:** Enhance `scripts/generate-health-dashboard.ts` (real metrics)
3. **Verify:** `npm run health:generate-dashboard` produces dashboard with real data
4. **Phase 3:** Create integration tests (router, gateway, agent)
5. **Verify:** `npm run test:integration:ci` passes with real APIs
6. **Phase 4:** Create health-check workflow + Firestore logging
7. **Verify:** Health checks run daily, dashboard updates with latest results

---

## Success Criteria (End-to-End)

After all phases complete:

```bash
# 1. Integration tests work with real APIs
npm run test:integration:ci
# Output: All 15-20 tests pass (no mocks for external services)

# 2. Health dashboard generates with real metrics
npm run health:generate-dashboard
# Output: packages/renderer/public/health.html with:
#   ✓ Build status (GitHub CI)
#   ✓ Integration health (test results)
#   ✓ Sentry metrics (error rate, latency)
#   ✓ SLA compliance (uptime, response times)

# 3. Health checks run automatically
# (Verify via GitHub Actions logs or Firestore collection)
# Output: healthChecks collection in Firestore with daily entries

# 4. Executive dashboard is accessible
# https://[firebase-hosting]/health.html → shows all green metrics
```

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| API quota exceeded (Google GenAI) | Run health checks daily (not hourly); monitor quota in Sentry |
| Firebase credentials expire | Rotate service account keys; test in CI before deployment |
| Flaky tests (network latency) | Add retry logic (3 attempts) for integration tests; log timing anomalies |
| Metrics out of sync | Health dashboard updates only after successful health-check run |
| GitHub Issues spam | Use labels + dedup logic; only create issue if SLA breached for 2+ consecutive checks |

---

## For Next Agent

**Start Here:**
1. Read `encapsulated-riding-spark.md` (full vision)
2. Read `TESTING_INTEGRATION_GUIDE.md` (how systems integrate)
3. Review this roadmap to understand phases 2–4
4. Start with Phase 2a: `scripts/fetch-metrics.ts`

**Key Files to Know:**
- Planning: `.claude/plans/encapsulated-riding-spark.md`
- Integration Guide: `.agent/TESTING_INTEGRATION_GUIDE.md`
- Stubs: `scripts/generate-health-dashboard.ts`, `.agent/workflows/health_audit.md`
- npm scripts: `package.json` (test:integration:ci, health:check, health:generate-dashboard)

**Questions to Ask User:**
- What are acceptable SLA targets? (API latency p50/p99, image gen time, video gen time, uptime %)
- Should health checks run daily or hourly? (daily = cheaper, hourly = more responsive)
- Should health dashboard be public or auth-protected? (currently planned as protected)

---

*Last checkpoint: 2026-06-03*  
*Session created checkpoint at: `.agent/checkpoints/fix-testing-docs-review-corrections.md`*
