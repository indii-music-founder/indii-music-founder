# Task Ledger: Fix 49 Remaining Partial Issues (Session 2026-07-13 Continued)

## Current Goal
Execute end-to-end fixes for all 49 partially-complete issues. Verified, tested, committed. No half-measures.

## TIER 1: Code-Ready (Minimal Changes, High Impact) — 4 Issues

- [x] **ISSUE-956: Brand Interview Image Data** — ✅ Core fixes verified (5MB gate, 20-asset count limit, MIME preservation, object-storage externalization)
  - **Remaining:** Pixel-dimension validation (optional enhancement) + legacy base64 backfill (deferred)
  - **Complexity:** Low

- [x] **ISSUE-927: Asset Drops Truncate** — ✅ Payload unified with `{ type: 'asset', asset }` shape; TimelineTrack routes to correct track
  - **Acceptance Met:** Drop handlers route to target track; duration auto-expand prevents >10s truncation
  - **Commit:** `aacb94ad6` (bundled with 928/932)
  - **Complexity:** Low

- [x] **ISSUE-928: Video Project Accepts Invalid Values** — ✅ Client-side validation with inline error feedback (64-8192/1-120 bounds)
  - **Acceptance Met:** Form rejects invalid values with clear bounds messages; store-level bounds also enforced
  - **Commit:** `aacb94ad6` (bundled with 927/932)
  - **Complexity:** Low

- [x] **ISSUE-932: Invalid Publicist Records Crash Search** — ✅ Subscriptions quarantine invalid records; error state separate from empty
  - **Acceptance Met:** Corrupt records skipped; network failures show error state (not empty dashboard)
  - **Commit:** `aacb94ad6` (bundled with 927/928)
  - **Complexity:** Low

## TIER 2: Moderate Complexity (State Handling + Validation) — 2 Issues

- [ ] **ISSUE-926: Video Editor Import Crashes** — Arbitrary durations + removal crash; validate durations, handle removed clips
  - **Files:** `VideoEditorService.ts`, `VideoImportModal.tsx`
  - **Acceptance:** Import rejects files with invalid/zero/negative durations; removed clips show error, not silent truncate
  - **Complexity:** Medium

- [x] **ISSUE-935: First Merch Canvas Action Can't Undo** — ✅ Canvas baseline established on init; design-load reset wired
  - **Acceptance Met:** First action undoes to empty canvas; loading a version clears undo stack and re-baselines
  - **Commit:** `8b393d7a3`
  - **Complexity:** Medium

## TIER 3: Deferred (High Complexity / Infrastructure Blocked) — 3 Issues

- [ ] **ISSUE-938:** Distributed state (Cloud Function + client); complex
- [ ] **ISSUE-939:** Blocked on Shopify/Printful OAuth config
- [ ] **ISSUE-765:** Blocked on GCP Console + secrets config

## COMPLETED (This Session)

- [x] **ISSUE-704/705:** Road Manager (finder UI + miles tracking) — commit cc426d298 + 100d6cb52
- [x] **ISSUE-941:** Social scheduling (future-time validation + local date) — commit 573a88f65
- [x] **ISSUE-949:** Campaign persistence (verified already fixed)
- [x] **ISSUE-927:** Asset drops routing unified — commit aacb94ad6
- [x] **ISSUE-928:** Video settings validated with bounds — commit aacb94ad6
- [x] **ISSUE-932:** Publicist error state tracking — commit aacb94ad6
- [x] **ISSUE-935:** Merchandise undo baseline on load — commit 8b393d7a3

**Total Fixed:** 7 issues (TIER 1 complete)

## Execution Protocol (per /middle workflow)

1. Pick ONE task from TIER 1 (lowest complexity first)
2. Implement end-to-end: read code → find root cause → write fix → test → verify in browser → commit
3. Proof of verification: paste test output, screenshot, or DOM state
4. Mark `[x]` when complete with full acceptance criteria met
5. Commit message: `fix(module): ISSUE-###: description` (criteria met)
6. Recurse until TIER 1-2 done or blocker hit

## Non-Goals
- Do not mark issues fixed without meeting all acceptance criteria
- Do not use placeholders or incomplete solutions
- Do not add to permanent covenant files without proof
