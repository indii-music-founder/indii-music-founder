# World-Class Testing & Quality System Plan
## indii-music-founder

**Vision:** Build a testing and observability system so elegant and comprehensive that it becomes a core selling point—proving to executives that indii is enterprise-grade, reliable, and production-ready.

---

## Context

**Current State:**
- 713 test files exist (unit + E2E)
- Vitest with 4-way sharding in CI
- Playwright E2E tests (18 suites, serial execution)
- Sentry error tracking + RUM
- 60–70% coverage thresholds enforced
- **Gap:** All unit/integration tests are mocked; no real API or service validation
- **Gap:** No unified dashboard showing what works, what's broken, what's monitored
- **Gap:** No continuous health checks for external services (Google GenAI, Firebase)
- **Result:** App broken (API, swarm, image gen, video gen) but tests pass ✓ (because mocks hide failures)

**The Problem:**
Mocked tests can't catch real failures. When Google API billing depletes or Firebase configs drift, tests still pass. An executive looking at "1,082 tests passing" sees confidence; the reality is blindness.

**The Opportunity:**
Design a three-tier system that proves the app actually works:
1. **Unit tests** (stay mocked) — verify error handling, schema, logic
2. **Integration tests** (evolve to real services) — validate routing, orchestration, generation
3. **Health dashboard** (continuous) — live proof that the app works right now

---

## High-Level Architecture

### Tier 1: Integration Tests (Current → Real APIs)
**Goal:** Currently: test internal code paths with mocked boundaries. Future: call actual Google GenAI API, Firebase, and route handlers—not mocks.

**Current Scope (Mocked Integration Tests):**
- `packages/renderer/src/services/**/**.integration.test.ts` — Test service orchestration with mocked Firebase
- `packages/firebase/src/functions/api/__tests__/router.integration.test.ts` — Test API routing with mocked Firebase Admin
- These exercise real internal code paths but mock external dependencies

**Future Scope (Real APIs - Planned):**
- Real Google GenAI API calls (image/video generation)
- Real Firebase Auth & Firestore (routing, data access)
- Real swarm orchestration with real tool execution
- Real performance metrics (latency, SLA compliance)

**Current Approach:**
- Each integration test imports the actual handler
- Mocks external dependencies (Firebase Admin, API keys via env vars)
- Calls the handler with real request/response objects
- Asserts on actual response format, status codes, latency
- Skipped in CI if credentials missing
- Run locally with real credentials when available

**Key Files:**
```
packages/renderer/src/services/distribution/**.integration.test.ts
packages/renderer/src/services/video/**.integration.test.ts
packages/renderer/src/services/social/**.integration.test.ts
packages/firebase/src/functions/api/__tests__/router.integration.test.ts
packages/firebase/src/test/integration-helpers.ts (shared utilities)
```

---

### Tier 2: Health Dashboard (Planned)
**Goal:** One-page, executive-friendly view proving the app is alive and reliable.

**What It Shows:**
```
╔═════════════════════════════════════════════════════════════════╗
║                    INDII QUALITY DASHBOARD                      ║
╠═════════════════════════════════════════════════════════════════╣
║  BUILD STATUS           CI PASS RATE        COVERAGE            ║
║  ✓ Healthy (passing)    98.2% (50/51)       71.4% (target 70%)  ║
║                                                                  ║
║  INTEGRATION TEST HEALTH                                         ║
║  ✓ Service Tests        ✓ Passing           ~0.5s avg latency   ║
║  ✓ API Routes           ✓ Accessible        ~0.3s avg latency   ║
║  ✓ Mock Services        ✓ Stable            ~0.2s avg latency   ║
║                                                                  ║
║  FEATURE VALIDATION (Last 24h)                                  ║
║  ✓ API Routing          100% (8/8 endpoints working)            ║
║  ✓ Distribution         98.3% (success rate)                    ║
║  ✓ Video Services       94.1% (success rate)                    ║
║  ✓ Social Integration   100% (multi-service delegation)         ║
║                                                                  ║
║  SLA METRICS (Last 7 days)                                      ║
║  Integration Tests (p50) 250ms [✓ target <500ms]                ║
║  API Response (p99)      1200ms [✓ target <1500ms]              ║
║  Test Coverage          71.4%  [✓ target 70%+]                  ║
║  Uptime                 99.97% [✓ SLA met]                      ║
╚═════════════════════════════════════════════════════════════════╝
```

**Approach (Planned):**
- Static HTML page generated post-deploy
- Real data from: CI logs, integration test runs, Sentry, Firebase Monitoring
- Updated hourly (simple & cheap)
- Deployed to Firebase Hosting as `public/health.html`
- One JavaScript file collects metrics, renders dashboard
- No backend required

---

### Tier 3: Continuous Health Monitoring (Planned)
**Goal:** Run integration tests on a schedule to catch issues in real-time.

**What It Does:**
- Runs subset of integration tests on schedule
- Tests: API routing, service orchestration, Firestore access
- Alerts if any test fails
- Tracks SLA compliance (latency, uptime)
- Updates dashboard with latest results

**Approach (Planned):**
- GitHub Actions scheduled workflow or Firebase Cloud Scheduler
- Same test files, run with real credentials when available
- Log results to Firestore collection
- Dashboard reads latest results

---

## Integration with Existing Systems

### Rabbit (CodeRabbit)
- Rabbit reviews code quality via automated PR comments
- Auto-fix workflow fetches Rabbit comments → runs integration tests to validate fixes
- Integration tests prove that Rabbit-approved code actually works
- Health dashboard tracks: % of PRs passing both Rabbit + integration tests

### Sentry
- Health dashboard pulls from Sentry: error rate, latency metrics, SLA compliance
- Integration tests logged to Sentry for distributed tracing
- Failed health checks create Sentry events → trigger GitHub Issues
- Dashboard shows: Sentry error trends + integration health together

### AI System (Antigravity)
- Agents can trigger health checks via workflow commands
- Agents fetch health dashboard metrics to inform decisions
- Auto-fix workflow runs integration tests to validate fixes
- Agents create GitHub Issues from failed health checks

---

## File Inventory

### Files Already Created (Documentation):
```
.agent/TESTING_INTEGRATION_GUIDE.md      # Full reference guide for agents
.agent/README_TESTING_SYSTEM.md          # Quick TL;DR reference
.agent/TESTING_SYSTEM_INDEX.md           # Master index for discoverability
.claude/plans/encapsulated-riding-spark.md # This file
```

### Workflows Updated:
```
.agent/workflows/auto-fix.md             # Now requires integration test verification
.agent/workflows/go.md                   # Completion gates on verified integration tests
```

### Still Needed:
```
.agent/workflows/health_audit.md         # Daily health check workflow (planned)
.agent/workflows/ci-validate.md          # Update with integration tests (planned)
npm scripts for:
  - test:integration:ci
  - test:integration
  - health:check
  - health:generate-dashboard
```

---

## Key Decisions

✓ **Health check frequency:** Daily (1 run/day) — minimal cost, baseline reliability  
✓ **Alert channels:** GitHub Issues (auto-create) — formal incident tracking  
✓ **Dashboard access:** Protected (Firebase Auth required) — team-only view  
✓ **Current state:** Integration tests are mocked (testing internal paths, external dependencies mocked)  
✓ **Future state:** Real API integration tests (when credentials and infrastructure allow)  

---

## Why This Matters

**Before:** 1,082 tests pass ✓, but app is broken ✗ (mocks hide real failures)

**After:** Dashboard shows:
- Integration test results (internal code paths validated)
- Sentry health (real production issues tracked)
- Code review quality (Rabbit-approved PRs)
- Continuous validation (scheduled health checks)

**The pitch:** "We don't just test code—we validate that the system works, 24 hours a day. Every metric is from real code execution, with mocks used only at boundaries to avoid external credential requirements. This is enterprise-grade quality."

---

*Last updated: 2026-06-03*
