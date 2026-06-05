# Full Sidebar Menu Gauntlet Execution Report

- **Date:** 2026-06-05 09:53:30
- **Total Duration:** 57.16 minutes
- **Summary:** 16 / 26 passed (61.5%)

## Status Grid

| # | Category | Target Name | Key | Status | Duration |
|---|----------|-------------|-----|--------|----------|
| 1 | MANAGER | Brand Manager | `brand` | ✅ PASS | 111.2s |
| 2 | MANAGER | Road Manager | `road` | ❌ FAIL | 52.9s |
| 3 | MANAGER | Campaign Manager | `campaign` | ✅ PASS | 51.6s |
| 4 | MANAGER | Booking Agent | `agent` | ❌ FAIL | 234.3s |
| 5 | MANAGER | Publicist | `publicist` | ✅ PASS | 47.3s |
| 6 | MANAGER | Creative Director | `creative` | ❌ FAIL | 387.8s |
| 7 | DEPARTMENT | Marketing & PR | `marketing` | ❌ FAIL | 215.6s |
| 8 | DEPARTMENT | Social Media Department | `social` | ✅ PASS | 33.1s |
| 9 | DEPARTMENT | Legal Department | `legal` | ❌ FAIL | 269.7s |
| 10 | DEPARTMENT | Publishing Department | `publishing` | ❌ FAIL | 176.3s |
| 11 | DEPARTMENT | Finance Department | `finance` | ❌ FAIL | 284.4s |
| 12 | DEPARTMENT | Distribution Department | `distribution` | ❌ FAIL | 302.8s |
| 13 | DEPARTMENT | Licensing Department | `licensing` | ❌ FAIL | 108.8s |
| 14 | DEPARTMENT | Art & Merch Dept | `merch` | ✅ PASS | 65.1s |
| 15 | DEPARTMENT | Registration Center | `registration` | ✅ PASS | 41.8s |
| 16 | DEPARTMENT | Security Agent | `security` | ✅ PASS | 50.1s |
| 17 | TOOL | Workflow Builder | `workflow` | ✅ PASS | 78.2s |
| 18 | TOOL | Audio Analyzer | `audio-analyzer` | ✅ PASS | 148.1s |
| 19 | TOOL | Knowledge Base | `knowledge` | ✅ PASS | 56.2s |
| 20 | TOOL | Memory Agent | `memory` | ✅ PASS | 58.2s |
| 21 | TOOL | Command Center | `observability` | ✅ PASS | 44.5s |
| 22 | TOOL | Settings | `settings` | ✅ PASS | 40.7s |
| 23 | PROJECT | HQ Dashboard | `dashboard` | ✅ PASS | 99.3s |
| 24 | PROJECT | Boardroom HQ | `boardroom` | ❌ FAIL | 147.7s |
| 25 | PROJECT | Founders Checkout | `founders` | ✅ PASS | 47.6s |
| 26 | PROJECT | Onboarding | `onboarding` | ✅ PASS | 276.3s |

## Detail Failures

### ❌ MANAGER: Road Manager (`road`)

**Duration:** 52.94s

**Execution Output:**
```text

      60 |         const emptyState = page.getByRole('heading', { name: /No Reports Found/i });
      61 |
    > 62 |         await expect(chart.or(emptyState)).toBeVisible({ timeout: 20_000 });
         |                                            ^
      63 |     });
      64 | });
      65 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/finance-workflow.spec.ts:62:44

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/error-context.md

  1 failed
    [chromium] › e2e/finance-workflow.spec.ts:57:5 › Finance Module › EarningsDashboard summary is visible on initial load 
  2 skipped
  2 passed (52.1s)

[34m[1m============================================================[0m
[34m[1m TESTING MANAGER: ROAD MANAGER[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/road-manager.spec.ts e2e/finance-workflow.spec.ts

[34m[1m============================================================[0m
[34m[1m MANAGER TEST RESULTS SUMMARY: ROAD MANAGER[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Manager Testing Failed![0m

```

### ❌ MANAGER: Booking Agent (`agent`)

**Duration:** 234.33s

**Execution Output:**
```text
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
  2 skipped
  5 passed (3.9m)

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

**Duration:** 387.82s

**Execution Output:**
```text
      114 |         // Wait for passed badge (successful QC in mock mode)
      115 |         const passedBadge = page.locator('[data-testid="qc-passed-badge"]');
    > 116 |         await expect(passedBadge).toBeVisible({ timeout: 20_000 });
          |                                   ^
      117 |     });
      118 | });
      119 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/distribution-workflow.spec.ts:116:35

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/distribution-workflow-Dist-e3fb2-lysis-workflow-in-Brain-tab-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/distribution-workflow-Dist-e3fb2-lysis-workflow-in-Brain-tab-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/distribution-workflow-Dist-e3fb2-lysis-workflow-in-Brain-tab-chromium/error-context.md

  2 failed
    [chromium] › e2e/creative-character.spec.ts:69:5 › Creative Studio - Character Library › should allow selecting a generated image from Character Library gallery 
    [chromium] › e2e/distribution-workflow.spec.ts:104:5 › Distribution Module › QC analysis workflow in Brain tab 
  4 skipped
  30 passed (6.5m)

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

### ❌ DEPARTMENT: Marketing & PR (`marketing`)

**Duration:** 215.61s

**Execution Output:**
```text
      60 |         const emptyState = page.getByRole('heading', { name: /No Reports Found/i });
      61 |
    > 62 |         await expect(chart.or(emptyState)).toBeVisible({ timeout: 20_000 });
         |                                            ^
      63 |     });
      64 | });
      65 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/finance-workflow.spec.ts:62:44

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/error-context.md

  2 failed
    [chromium] › e2e/distribution-workflow.spec.ts:104:5 › Distribution Module › QC analysis workflow in Brain tab 
    [chromium] › e2e/finance-workflow.spec.ts:57:5 › Finance Module › EarningsDashboard summary is visible on initial load 
  4 skipped
  14 passed (3.6m)

[34m[1m============================================================[0m
[34m[1m TESTING DEPARTMENT: MARKETING & PR[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/marketing.spec.ts e2e/creative-studio.spec.ts e2e/finance-workflow.spec.ts e2e/distribution-workflow.spec.ts e2e/social.spec.ts

[34m[1m============================================================[0m
[34m[1m DEPARTMENT TEST RESULTS SUMMARY: MARKETING & PR[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Department Testing Failed![0m

```

### ❌ DEPARTMENT: Legal Department (`legal`)

**Duration:** 269.75s

**Execution Output:**
```text

      60 |         const emptyState = page.getByRole('heading', { name: /No Reports Found/i });
      61 |
    > 62 |         await expect(chart.or(emptyState)).toBeVisible({ timeout: 20_000 });
         |                                            ^
      63 |     });
      64 | });
      65 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/finance-workflow.spec.ts:62:44

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/error-context.md

  2 failed
    [chromium] › e2e/distribution-workflow.spec.ts:104:5 › Distribution Module › QC analysis workflow in Brain tab 
    [chromium] › e2e/finance-workflow.spec.ts:57:5 › Finance Module › EarningsDashboard summary is visible on initial load 
  15 passed (4.5m)

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

### ❌ DEPARTMENT: Publishing Department (`publishing`)

**Duration:** 176.32s

**Execution Output:**
```text


      114 |         // Wait for passed badge (successful QC in mock mode)
      115 |         const passedBadge = page.locator('[data-testid="qc-passed-badge"]');
    > 116 |         await expect(passedBadge).toBeVisible({ timeout: 20_000 });
          |                                   ^
      117 |     });
      118 | });
      119 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/distribution-workflow.spec.ts:116:35

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/distribution-workflow-Dist-e3fb2-lysis-workflow-in-Brain-tab-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/distribution-workflow-Dist-e3fb2-lysis-workflow-in-Brain-tab-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/distribution-workflow-Dist-e3fb2-lysis-workflow-in-Brain-tab-chromium/error-context.md

  1 failed
    [chromium] › e2e/distribution-workflow.spec.ts:104:5 › Distribution Module › QC analysis workflow in Brain tab 
  13 passed (2.9m)

[34m[1m============================================================[0m
[34m[1m TESTING DEPARTMENT: PUBLISHING DEPARTMENT[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/publishing.spec.ts e2e/legal.spec.ts e2e/distribution-workflow.spec.ts

[34m[1m============================================================[0m
[34m[1m DEPARTMENT TEST RESULTS SUMMARY: PUBLISHING DEPARTMENT[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Department Testing Failed![0m

```

### ❌ DEPARTMENT: Finance Department (`finance`)

**Duration:** 284.41s

**Execution Output:**
```text
      60 |         const emptyState = page.getByRole('heading', { name: /No Reports Found/i });
      61 |
    > 62 |         await expect(chart.or(emptyState)).toBeVisible({ timeout: 20_000 });
         |                                            ^
      63 |     });
      64 | });
      65 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/finance-workflow.spec.ts:62:44

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/error-context.md

  2 failed
    [chromium] › e2e/distribution-workflow.spec.ts:104:5 › Distribution Module › QC analysis workflow in Brain tab 
    [chromium] › e2e/finance-workflow.spec.ts:57:5 › Finance Module › EarningsDashboard summary is visible on initial load 
  24 passed (4.7m)

[34m[1m============================================================[0m
[34m[1m TESTING DEPARTMENT: FINANCE DEPARTMENT[0m
[34m[1m============================================================[0m
[33mWarning: Path exists but contains no unit/integration test files: packages/renderer/src/modules/royalty[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/finance-workflow.spec.ts e2e/payment.spec.ts e2e/marketing.spec.ts e2e/distribution-workflow.spec.ts e2e/legal.spec.ts

[34m[1m============================================================[0m
[34m[1m DEPARTMENT TEST RESULTS SUMMARY: FINANCE DEPARTMENT[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Department Testing Failed![0m

```

### ❌ DEPARTMENT: Distribution Department (`distribution`)

**Duration:** 302.83s

**Execution Output:**
```text

      60 |         const emptyState = page.getByRole('heading', { name: /No Reports Found/i });
      61 |
    > 62 |         await expect(chart.or(emptyState)).toBeVisible({ timeout: 20_000 });
         |                                            ^
      63 |     });
      64 | });
      65 |
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/finance-workflow.spec.ts:62:44

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/error-context.md

  2 failed
    [chromium] › e2e/distribution-workflow.spec.ts:104:5 › Distribution Module › QC analysis workflow in Brain tab 
    [chromium] › e2e/finance-workflow.spec.ts:57:5 › Finance Module › EarningsDashboard summary is visible on initial load 
  19 passed (5.0m)

[34m[1m============================================================[0m
[34m[1m TESTING DEPARTMENT: DISTRIBUTION DEPARTMENT[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/distribution-workflow.spec.ts e2e/hardened-distribution.spec.ts e2e/finance-workflow.spec.ts e2e/publishing.spec.ts e2e/legal.spec.ts

[34m[1m============================================================[0m
[34m[1m DEPARTMENT TEST RESULTS SUMMARY: DISTRIBUTION DEPARTMENT[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Department Testing Failed![0m

```

### ❌ DEPARTMENT: Licensing Department (`licensing`)

**Duration:** 108.82s

**Execution Output:**
```text


      60 |
      61 |         const chart = page.locator('[data-testid="earnings-chart"]');
    > 62 |         // Match the heading in the tabpanel (No Reports Found) or the actual chart
         |                                            ^
      63 |         const emptyState = page.getByRole('heading', { name: /No Reports Found/i });
      64 |
      65 |         await expect(chart.or(emptyState)).toBeVisible({ timeout: 20_000 });
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/finance-workflow.spec.ts:62:44

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/finance-workflow-Finance-M-0dbb3--is-visible-on-initial-load-chromium/error-context.md

  1 failed
    [chromium] › e2e/finance-workflow.spec.ts:57:5 › Finance Module › EarningsDashboard summary is visible on initial load 
  7 passed (1.8m)

[34m[1m============================================================[0m
[34m[1m TESTING DEPARTMENT: LICENSING DEPARTMENT[0m
[34m[1m============================================================[0m

[36m[1m--- Running E2E & Connected Feature Tests ---[0m

[36m[1mExecuting command:[0m npx playwright test e2e/licensing.spec.ts e2e/legal.spec.ts e2e/finance-workflow.spec.ts

[34m[1m============================================================[0m
[34m[1m DEPARTMENT TEST RESULTS SUMMARY: LICENSING DEPARTMENT[0m
[34m[1m============================================================[0m
E2E Tests:  [31mFAIL[0m

[31m[1m❌ Scoped Department Testing Failed![0m

```

### ❌ PROJECT: Boardroom HQ (`boardroom`)

**Duration:** 147.71s

**Execution Output:**
```text

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

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/boardroom-real-user-scenar-069c1-namic-seating-and-unseating-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/boardroom-real-user-scenar-069c1-namic-seating-and-unseating-chromium/error-context.md

  1 failed
    [chromium] › e2e/boardroom-real-user-scenario.spec.ts:5:5 › Boardroom Real User Multi-Turn Scenario › should execute a realistic multi-turn conversation with dynamic seating and unseating 
  6 skipped
  10 passed (2.4m)

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

