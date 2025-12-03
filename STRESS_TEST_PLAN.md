# indiiOS Stress Testing Plan

**Objective:** Validate the stability, performance, and scalability of the multi-tenant architecture and AI agent system under load.

## 1. Frontend Stress Testing (Client-Side)

**Tools:** Playwright, Chrome DevTools Performance Monitor.

### A. Rendering Performance

* **Scenario:** Rapidly scrolling the Landing Page with maximum "Liquid Orbs" density.
* **Metric:** Maintain 60fps (or 30fps on low-end mobile).
* **Test:**
    1. Load Landing Page.
    2. Scroll from top to bottom in < 2 seconds.
    3. Measure FPS drop and memory usage (Heap Snapshot).
    4. **Fail Condition:** FPS < 30 or Memory Leak > 50MB growth per scroll cycle.

### B. Asset Loading

* **Scenario:** Loading the "Creative Studio" gallery with 100+ high-res images.
* **Metric:** Time to Interactive (TTI) < 1.5s.
* **Test:**
    1. Seed Firestore with 100 dummy image records.
    2. Navigate to Creative Studio.
    3. Measure time until the first 20 images are visible.
    4. **Fail Condition:** TTI > 3s or UI freeze during hydration.

### C. Agent Interaction

* **Scenario:** Sending 10 rapid messages to the Agent while it is streaming a response.
* **Metric:** UI responsiveness and correct message ordering.
* **Test:**
    1. Open Agent Window.
    2. Send a complex prompt (triggering High Thinking).
    3. Immediately send 5 more short messages.
    4. **Fail Condition:** UI crash, duplicate messages, or lost context.

## 2. Backend Stress Testing (Server-Side)

**Tools:** k6 (Load Testing), Firebase Emulator Suite.

### A. Multi-Tenancy Isolation

* **Scenario:** Concurrent access to different Organizations.
* **Metric:** Zero data leakage.
* **Test:**
    1. Create User A (Org A) and User B (Org B).
    2. Simulate concurrent requests to `getProjects` for both users.
    3. **Fail Condition:** User A receives any data belonging to Org B.

### B. Firestore Write Limits

* **Scenario:** "Batch Edit" tool updating 50 images simultaneously.
* **Metric:** Successful writes without hitting rate limits.
* **Test:**
    1. Trigger `batch_edit_images` with 50 target IDs.
    2. Monitor Firestore write operations.
    3. **Fail Condition:** "Resource Exhausted" errors or partial updates.

### C. Agent Service Concurrency

* **Scenario:** 50 concurrent users requesting AI generation.
* **Metric:** Average Latency and Error Rate.
* **Test:**
    1. Use k6 to simulate 50 users hitting the `generateContent` endpoint.
    2. **Fail Condition:** Error rate > 1% or Latency > 10s (excluding model generation time).

## 3. Integration Testing (End-to-End)

**Tools:** Playwright.

### A. The "New User" Flow

1. Land on Homepage -> Click "Launch Studio".
2. Sign Up (Anonymous/Auth).
3. Create Organization "Test Corp".
4. Create Project "Alpha".
5. Generate 1 Image.
6. Switch Organization -> Verify empty state.
7. Switch back -> Verify Image exists.

### B. The "Agent Handover" Flow

1. Ask Generalist Agent: "Draft a contract for this image."
2. Verify handover to `LegalAgent`.
3. Verify `LegalAgent` output is stored in history.

## 4. Execution Strategy

1. **Phase 1 (Local):** Run Playwright E2E tests against `localhost:5173` and Emulator.
2. **Phase 2 (Dev):** Run k6 load tests against the Development environment (limited scale).
3. **Phase 3 (Prod):** "Game Day" - Scheduled for [Date TBD].
    * **Pre-requisite:** Verify Firebase Quotas (Cloud Functions invocations, Firestore writes).
    * **Action:** Execute k6 script with reduced VUs (start with 10) against production URL.

## 5. Action Items

* [x] Set up Playwright configuration.
* [x] Create seed scripts for Firestore data (Implemented in E2E test).
* [x] Write k6 script for Agent Service load testing.
