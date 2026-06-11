# Full Sidebar Menu Gauntlet Execution Report

- **Date:** 2026-06-05 11:33:30
- **Total Duration:** 51.77 minutes
- **Summary:** 22 / 27 passed (81.5%)

## Status Grid

| # | Category | Target Name | Key | Status | Duration |
|---|----------|-------------|-----|--------|----------|
| 1 | MANAGER | Brand Manager | `brand` | ✅ PASS | 112.0s |
| 2 | MANAGER | Road Manager | `road` | ✅ PASS | 53.2s |
| 3 | MANAGER | Campaign Manager | `campaign` | ✅ PASS | 41.0s |
| 4 | MANAGER | Booking Agent | `agent` | ❌ FAIL | 198.6s |
| 5 | MANAGER | Publicist | `publicist` | ✅ PASS | 42.3s |
| 6 | MANAGER | Creative Director | `creative` | ❌ FAIL | 380.2s |
| 7 | DEPARTMENT | Marketing & PR | `marketing` | ✅ PASS | 169.0s |
| 8 | DEPARTMENT | Social Media Department | `social` | ✅ PASS | 31.8s |
| 9 | DEPARTMENT | Legal Department | `legal` | ❌ FAIL | 258.4s |
| 10 | DEPARTMENT | Publishing Department | `publishing` | ✅ PASS | 151.7s |
| 11 | DEPARTMENT | Finance Department | `finance` | ✅ PASS | 254.8s |
| 12 | DEPARTMENT | Distribution Department | `distribution` | ✅ PASS | 205.2s |
| 13 | DEPARTMENT | Licensing Department | `licensing` | ✅ PASS | 77.1s |
| 14 | DEPARTMENT | Art & Merch Dept | `merch` | ✅ PASS | 51.6s |
| 15 | DEPARTMENT | Registration Center | `registration` | ✅ PASS | 42.8s |
| 16 | DEPARTMENT | Security Agent | `security` | ✅ PASS | 42.3s |
| 17 | TOOL | Workflow Builder | `workflow` | ✅ PASS | 53.8s |
| 18 | TOOL | Audio Analyzer | `audio-analyzer` | ✅ PASS | 120.6s |
| 19 | TOOL | Knowledge Base | `knowledge` | ✅ PASS | 56.6s |
| 20 | TOOL | Memory Agent | `memory` | ✅ PASS | 60.9s |
| 21 | TOOL | Command Center | `observability` | ✅ PASS | 48.1s |
| 22 | TOOL | Settings | `settings` | ✅ PASS | 43.2s |
| 23 | TOOL | Mobile Remote | `mobile-remote` | ✅ PASS | 75.9s |
| 24 | PROJECT | HQ Dashboard | `dashboard` | ✅ PASS | 126.3s |
| 25 | PROJECT | Boardroom HQ | `boardroom` | ❌ FAIL | 221.7s |
| 26 | PROJECT | Founders Checkout | `founders` | ✅ PASS | 83.9s |
| 27 | PROJECT | Onboarding | `onboarding` | ❌ FAIL | 103.8s |

## Detail Failures

### ❌ MANAGER: Booking Agent (`agent`)

**Duration:** 198.58s

**Execution Output:**
```text
         |                                                        ^
      39 |     });
      40 |
      41 |     test('agent module loads without crashing on desktop viewport', async ({ authedPage: page }) => {
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/agent-flows.spec.ts:38:56

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/agent-flows-Agent-Dashboar-3cd46-outing-to-appropriate-agent-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/agent-flows-Agent-Dashboar-3cd46-outing-to-appropriate-agent-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/agent-flows-Agent-Dashboar-3cd46-outing-to-appropriate-agent-chromium/error-context.md

  6 failed
    [chromium] › e2e/agent-flows.spec.ts:41:5 › Agent Dashboard › agent module loads without crashing on desktop viewport 
    [chromium] › e2e/agent-flows.spec.ts:49:5 › Agent Dashboard › agent dashboard tab navigation works and shows distinct content 
    [chromium] › e2e/agent-flows.spec.ts:78:5 › Agent Dashboard › scout tab shows map or venue interface 
    [chromium] › e2e/agent-flows.spec.ts:95:5 › Agent Dashboard › campaigns and inbox tabs show stub or content (regression guard) 
    [chromium] › e2e/agent-flows.spec.ts:109:5 › Agent Dashboard › agent responds to user messages with streaming response 
    [chromium] › e2e/agent-flows.spec.ts:152:5 › Agent Dashboard › agent specializes tasks by routing to appropriate agent 
  7 passed (3.3m)

[34m[1m============================================================[0m
[34m[1m TESTING MANAGER: BOOKING AGENT[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/agent-flows.spec.ts e2e/boardroom-swarm.spec.ts e2e/road-manager.spec.ts

[34m[1m============================================================[0m
[34m[1m MANAGER TEST RESULTS SUMMARY: BOOKING AGENT[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Manager Testing Failed![0m

```

### ❌ MANAGER: Creative Director (`creative`)

**Duration:** 380.20s

**Execution Output:**
```text

      81 |         // Click Add Person in CharacterLibrary
      82 |         const addPersonBtn = page.locator('button:has-text("Add Person")');
    > 83 |         await expect(addPersonBtn).toBeVisible({ timeout: 10_000 });
         |                                    ^
      84 |         await addPersonBtn.click();
      85 |
      86 |         // Wait for the modal to open
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/creative-character.spec.ts:83:36

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/creative-character-Creativ-beac4-m-Character-Library-gallery-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/creative-character-Creativ-beac4-m-Character-Library-gallery-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/creative-character-Creativ-beac4-m-Character-Library-gallery-chromium/error-context.md

  1 failed
    [chromium] › e2e/creative-character.spec.ts:69:5 › Creative Studio - Character Library › should allow selecting a generated image from Character Library gallery 
  2 skipped
  33 passed (6.3m)

[34m[1m============================================================[0m
[34m[1m TESTING MANAGER: CREATIVE DIRECTOR[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/creative.spec.ts e2e/creative-studio.spec.ts e2e/creative-persistence.spec.ts e2e/creative-prompt-builder.spec.ts e2e/creative-character.spec.ts e2e/brand.spec.ts e2e/distribution-workflow.spec.ts e2e/marketing.spec.ts

[34m[1m============================================================[0m
[34m[1m MANAGER TEST RESULTS SUMMARY: CREATIVE DIRECTOR[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Manager Testing Failed![0m

```

### ❌ DEPARTMENT: Legal Department (`legal`)

**Duration:** 258.38s

**Execution Output:**
```text
[BROWSER ERROR] Failed to load resource: net::ERR_FAILED
[BROWSER ERROR] Failed to load resource: net::ERR_FAILED
[BROWSER ERROR] Failed to load resource: net::ERR_FAILED
[BROWSER ERROR] Failed to load resource: net::ERR_FAILED
[BROWSER ERROR] Failed to load resource: net::ERR_FAILED
[E2E] Intercepted Installations API: https://firebaseinstallations.googleapis.com/v1/projects/indii-music-founder/installations
[E2E] CATCH-ALL intercepted (googleapis): POST https://firebaseremoteconfig.googleapis.com/v1/projects/indii-music-founder/namespaces/fireperf:fetch?key=AIzaSyDHL8PVxgVYbHtLF95KQtdRfitf3d7zEKc
[BROWSER ERROR] Failed to load resource: net::ERR_FAILED
[E2E] CATCH-ALL intercepted (googleapis): POST https://firebaselogging-pa.googleapis.com/v1/firelog/legacy/log?key=AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw
[BROWSER ERROR] Failed to load resource: net::ERR_FAILED
  ✓  17 [chromium] › e2e/publishing.spec.ts:32:5 › Publishing Module › publishing module renders content (8.5s)


  1) [chromium] › e2e/publishing.spec.ts:26:5 › Publishing Module › navigates to publishing module without crash 

    [31mTearing down "context" exceeded the test timeout of 60000ms.[39m

    Error: browserContext.close: Target page, context or browser has been closed

    Error Context: test-results/publishing-Publishing-Modu-a5cfd-ishing-module-without-crash-chromium/error-context.md

  1 failed
    [chromium] › e2e/publishing.spec.ts:26:5 › Publishing Module › navigates to publishing module without crash 
  16 passed (4.3m)

[34m[1m============================================================[0m
[34m[1m TESTING DEPARTMENT: LEGAL DEPARTMENT[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/legal.spec.ts e2e/publishing.spec.ts e2e/finance-workflow.spec.ts e2e/distribution-workflow.spec.ts

[34m[1m============================================================[0m
[34m[1m DEPARTMENT TEST RESULTS SUMMARY: LEGAL DEPARTMENT[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Department Testing Failed![0m

```

### ❌ PROJECT: Boardroom HQ (`boardroom`)

**Duration:** 221.68s

**Execution Output:**
```text
    Error: [2mexpect([22m[31mreceived[39m[2m).[22mnot[2m.[22mtoContain[2m([22m[32mexpected[39m[2m) // indexOf[22m

    Expected value: not [32m"publicist"[39m
    Received array:     [31m["generalist", [7m"publicist"[27m, "brand", "music"][39m

      656 |         expect(finalSeated).not.toContain('video');
      657 |         expect(finalSeated).not.toContain('social');
    > 658 |         expect(finalSeated).not.toContain('publicist');
          |                                 ^
      659 |         expect(finalSeated).not.toContain('brand');
      660 |         expect(finalSeated).not.toContain('music');
      661 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/boardroom-real-user-scenario.spec.ts:658:33

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/boardroom-real-user-scenar-069c1-namic-seating-and-unseating-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/boardroom-real-user-scenar-069c1-namic-seating-and-unseating-chromium/error-context.md

  1 failed
    [chromium] › e2e/boardroom-real-user-scenario.spec.ts:5:5 › Boardroom Real User Multi-Turn Scenario › should execute a realistic multi-turn conversation with dynamic seating and unseating 
  6 skipped
  10 passed (3.7m)

[34m[1m============================================================[0m
[34m[1m TESTING PROJECT: BOARDROOM HQ[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/boardroom-swarm.spec.ts e2e/boardroom-real-user-scenario.spec.ts e2e/chat-interaction.spec.ts e2e/workflow.spec.ts e2e/creative-studio.spec.ts e2e/marketing.spec.ts

[34m[1m============================================================[0m
[34m[1m PROJECT TEST RESULTS SUMMARY: BOARDROOM HQ[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Project Testing Failed![0m

```

### ❌ PROJECT: Onboarding (`onboarding`)

**Duration:** 103.77s

**Execution Output:**
```text
    Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

    Expected: [32m"Model 909"[39m
    Received: [31m""[39m

      798 |
      799 |             console.log(`[Techno E2E] Verified artist profile bio for ${currentPersona.displayName}:`, finalProfile.bio);
    > 800 |             expect(finalProfile.displayName).toBe(currentPersona.displayName);
          |                                              ^
      801 |             expect(finalProfile.careerStage).toBe("Building momentum");
      802 |             expect(finalProfile.goals).toContain("Touring");
      803 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/detroit-techno-onboarding.spec.ts:800:46

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/detroit-techno-onboarding--9bb49-troit-Techno-Artist-Journey-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/detroit-techno-onboarding--9bb49-troit-Techno-Artist-Journey-chromium/error-context.md

  1 failed
    [chromium] › e2e/detroit-techno-onboarding.spec.ts:106:5 › Detroit Techno Onboarding & Studio Flow Stress Test › Scenario: Full Detroit Techno Artist Journey 
  1 skipped
  6 passed (1.7m)

[34m[1m============================================================[0m
[34m[1m TESTING PROJECT: ONBOARDING[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/detroit-techno-onboarding.spec.ts e2e/navigation.spec.ts

[34m[1m============================================================[0m
[34m[1m PROJECT TEST RESULTS SUMMARY: ONBOARDING[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Project Testing Failed![0m

```

