# Full Sidebar Menu Gauntlet Execution Report

- **Date:** 2026-06-05 12:34:58
- **Total Duration:** 41.74 minutes
- **Summary:** 26 / 27 passed (96.3%)

## Status Grid

| # | Category | Target Name | Key | Status | Duration |
|---|----------|-------------|-----|--------|----------|
| 1 | MANAGER | Brand Manager | `brand` | ✅ PASS | 114.5s |
| 2 | MANAGER | Road Manager | `road` | ✅ PASS | 45.4s |
| 3 | MANAGER | Campaign Manager | `campaign` | ✅ PASS | 38.3s |
| 4 | MANAGER | Booking Agent | `agent` | ✅ PASS | 97.9s |
| 5 | MANAGER | Publicist | `publicist` | ✅ PASS | 31.9s |
| 6 | MANAGER | Creative Director | `creative` | ❌ FAIL | 327.8s |
| 7 | DEPARTMENT | Marketing & PR | `marketing` | ✅ PASS | 143.8s |
| 8 | DEPARTMENT | Social Media Department | `social` | ✅ PASS | 28.4s |
| 9 | DEPARTMENT | Legal Department | `legal` | ✅ PASS | 100.5s |
| 10 | DEPARTMENT | Publishing Department | `publishing` | ✅ PASS | 98.9s |
| 11 | DEPARTMENT | Finance Department | `finance` | ✅ PASS | 202.8s |
| 12 | DEPARTMENT | Distribution Department | `distribution` | ✅ PASS | 168.5s |
| 13 | DEPARTMENT | Licensing Department | `licensing` | ✅ PASS | 58.6s |
| 14 | DEPARTMENT | Art & Merch Dept | `merch` | ✅ PASS | 38.4s |
| 15 | DEPARTMENT | Registration Center | `registration` | ✅ PASS | 24.1s |
| 16 | DEPARTMENT | Security Agent | `security` | ✅ PASS | 38.3s |
| 17 | TOOL | Workflow Builder | `workflow` | ✅ PASS | 61.6s |
| 18 | TOOL | Audio Analyzer | `audio-analyzer` | ✅ PASS | 92.3s |
| 19 | TOOL | Knowledge Base | `knowledge` | ✅ PASS | 40.0s |
| 20 | TOOL | Memory Agent | `memory` | ✅ PASS | 49.5s |
| 21 | TOOL | Command Center | `observability` | ✅ PASS | 42.7s |
| 22 | TOOL | Settings | `settings` | ✅ PASS | 33.2s |
| 23 | TOOL | Mobile Remote | `mobile-remote` | ✅ PASS | 64.1s |
| 24 | PROJECT | HQ Dashboard | `dashboard` | ✅ PASS | 96.2s |
| 25 | PROJECT | Boardroom HQ | `boardroom` | ✅ PASS | 124.0s |
| 26 | PROJECT | Founders Checkout | `founders` | ✅ PASS | 55.2s |
| 27 | PROJECT | Onboarding | `onboarding` | ✅ PASS | 287.8s |

## Detail Failures

### ❌ MANAGER: Creative Director (`creative`)

**Duration:** 327.81s

**Execution Output:**
```text

      85 |         // Click Add Person in CharacterLibrary
      86 |         const addPersonBtn = page.locator('button:has-text("Add Person")');
    > 87 |         await expect(addPersonBtn).toBeVisible({ timeout: 10_000 });
         |                                    ^
      88 |         await addPersonBtn.click();
      89 |
      90 |         // Wait for the modal to open
        at /Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/e2e/creative-character.spec.ts:87:36

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
  33 passed (5.5m)

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

