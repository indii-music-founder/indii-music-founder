# Test Audit Report: indii-music-founder

**Date:** 2026-06-03  
**Reason:** App broken after account separation (Google Cloud $1000 spike → new account)  
**Status:** 1,082 tests exist but most are mocked; integration tests missing

---

## Executive Summary

The test suite is **well-structured but isolated**. Tests verify error handling and configuration (what happens when things fail), but don't exercise real integrations (what happens when they work).

**Root cause of app breakage:**
- Account separation severed backend connectivity
- Environment partially configured (Firebase project, API key set)
- Tests don't catch this because they mock everything
- Real failures (credentials, billing, missing models) are invisible to test suite

---

## Critical Test Gaps

### 1. **Gateway Tests (Image/Video Generation)** 
**File:** `packages/firebase/src/functions/creative/gateway.test.ts`

**Current state:**
- ✅ Tests error mapping (model unavailable → failed-precondition)
- ✅ Tests error mapping (safety filter → invalid-argument)  
- ✅ Tests function config (memory: 1GiB, timeout: 120s)
- ❌ Does NOT test actual image generation
- ❌ Does NOT test actual video generation
- ❌ Does NOT call real Google GenAI API
- ❌ Does NOT validate Firebase storage writes

**Lines of code:** 282  
**Mock statements:** 23  
**Real function calls:** 0

**What's mocked:**
```
✓ GoogleGenAI (entire library)
✓ firebase-functions/v2/https.onCall (wraps real function)
✓ firebase-admin (firestore, storage)
✓ API secrets (geminiApiKey)
```

**Why this is a problem:**
When `onCall` is mocked, the real function body never executes. The test can't detect:
- Missing API key (gets 'test-gemini-key' from mock)
- Billing depleted (doesn't call real API)
- Model not available (doesn't call real API)
- Firebase can't write (mocks succeed)

---

### 2. **API Router Tests**
**File:** `packages/firebase/src/functions/api/__tests__/router.test.ts`

**Current state:**
- ✅ Tests that mock request/response objects exist
- ✅ Tests HTTP headers (authorization, content-type)
- ❌ Does NOT test actual route handlers
- ❌ Does NOT test authentication against real Firebase
- ❌ Does NOT test real database queries

**Expected issue:** API errors caught only if handler crashes; logic errors go undetected.

---

### 3. **Swarm/Agent Tests**
**Files:**
- `packages/renderer/src/services/agent/components/__tests__/AgentExecutor.swarm.test.ts`
- `packages/renderer/src/services/agent/__tests__/AgentOrchestrator.test.ts`

**Current state:**
- ✅ Tests swarmId propagation between root/child agents
- ❌ Does NOT test real agent tool execution
- ❌ Does NOT test multi-agent orchestration against real tools
- ❌ Does NOT test agent routing/delegation

**Expected issue:** Swarm coordination may fail silently; tests don't catch it.

---

## Environment Configuration Status

**Firebase Setup:**
```
✓ VITE_FIREBASE_PROJECT_ID=indii-music-founder
✓ VITE_FUNCTIONS_URL=https://us-central1-indii-music-founder.cloudfunctions.net
✗ VITE_FIREBASE_API_KEY configured but untested
✗ Firebase Firestore rules untested
```

**Google AI Setup:**
```
✓ VITE_API_KEY=AIzaSyD... (set)
? Credits/billing status unknown (likely depleted based on gateway.ts error handling updates)
? Model availability in new account unknown
```

---

## Action Plan (Priority Order)

### Phase 1: Validate Environment
- [ ] Verify Google API key is active in new account
- [ ] Check API quota/billing status (likely depleted given recent error handling)
- [ ] Verify Firebase project credentials are correct
- [ ] Test Firebase Firestore connectivity
- [ ] Test Firebase Storage connectivity

### Phase 2: Integration Tests
- [ ] Create `gateway.integration.test.ts` (real Google GenAI calls)
  - Test actual image generation
  - Test actual video generation  
  - Test error handling against real API
- [ ] Create `router.integration.test.ts` (real Firebase Auth)
  - Test authentication flow
  - Test API response format
- [ ] Create `swarm.integration.test.ts` (real agent execution)
  - Test multi-agent delegation
  - Test tool invocation

### Phase 3: Unit Test Updates
- [ ] Update gateway.test.ts to test happy paths
- [ ] Update router.test.ts to verify real route handlers
- [ ] Update agent tests to verify orchestration logic

---

## Test Suite Statistics

| Metric | Count |
|--------|-------|
| Total tests | 1,082 |
| Mock-heavy tests (don't call real code) | ~800+ |
| Integration tests | ~10 |
| Tests in gateway.test.ts | 6 |
| Tests that call real generateImageV3 | 0 |
| Tests that call real generateVideoV3 | 0 |

---

## Identified Issues in Code Changes

**gateway.ts recent updates detect:**
- Prepayment credits depleted → suggests new account has no billing setup
- API key unavailable → suggesting credentials issue
- Model not found → suggesting model not configured in new project
- Internal server errors → suggesting quota/billing issues

These errors in the UPDATED error handling suggest the developer has been debugging real failures, but tests still don't catch them because they're mocked.

---

## Recommendations

1. **Immediate:** Check Google Cloud Console for the new account
   - Verify API key is valid and has permissions
   - Check billing/credit status (likely cause of failures)
   - Verify models are enabled (image, video, Omni)

2. **Short-term:** Create integration test harness
   - Use same credentials as app
   - Test against real Google GenAI API
   - Test against real Firebase project
   - Run daily to catch credential/billing issues early

3. **Medium-term:** Split test suite
   - Unit tests (mocked) for error handling logic ✓ (keep as-is)
   - Integration tests (real APIs) for functionality
   - CI runs both; integration tests require valid credentials

4. **Long-term:** Add pre-deployment validation
   - Verify Google API key is valid
   - Verify Firebase project is accessible
   - Verify model availability before deployment
