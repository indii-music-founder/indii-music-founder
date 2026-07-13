# Task Ledger: Fix 49 Remaining Partial Issues (Session 2026-07-13 Continued)

## Current Goal
Execute end-to-end fixes for all 49 partially-complete issues. Verified, tested, committed. No half-measures.

## TIER 1: Code-Ready (Minimal Changes, High Impact) — 4 Issues

- [ ] **ISSUE-956: Brand Interview Image Data** — Storing full data-URLs in profile doc; add size boundary + cleanup
  - **Files:** `ProfileService.ts`, `BrandInterviewPanel.tsx`
  - **Acceptance:** Image URLs truncated to refs (Firebase Storage URLs); raw data-URLs purged; validate size < 5MB before upload
  - **Complexity:** Low

- [ ] **ISSUE-927: Asset Drops Truncate** — Fall back to first track + truncate >10s clips; show error instead
  - **Files:** `CanvasAssetDropHandler.ts`
  - **Acceptance:** Show error on drop if clip > 10s; user chooses to truncate or cancel
  - **Complexity:** Low

- [ ] **ISSUE-928: Video Project Accepts Invalid Values** — Width/height/FPS accept empty/zero/negative/NaN/extreme; validate all
  - **Files:** `VideoProjectForm.tsx`, VideoProject schema
  - **Acceptance:** Form rejects invalid values with clear error; schema validates finite positive integers
  - **Complexity:** Low

- [ ] **ISSUE-932: Invalid Publicist Records Crash Search** — Unvalidated records cast into UI; add validation
  - **Files:** `PublicistService.ts`, `PublicistSearchPanel.tsx`
  - **Acceptance:** Invalid records filtered out before render; search shows "No results" instead of crashing
  - **Complexity:** Low

## TIER 2: Moderate Complexity (State Handling + Validation) — 2 Issues

- [ ] **ISSUE-926: Video Editor Import Crashes** — Arbitrary durations + removal crash; validate durations, handle removed clips
  - **Files:** `VideoEditorService.ts`, `VideoImportModal.tsx`
  - **Acceptance:** Import rejects files with invalid/zero/negative durations; removed clips show error, not silent truncate
  - **Complexity:** Medium

- [ ] **ISSUE-935: First Merch Canvas Action Can't Undo** — Canvas undo state not tracking first action
  - **Files:** `FabricCanvasManager.ts`, undo stack logic
  - **Acceptance:** First action can be undone; undo/redo state consistent
  - **Complexity:** Medium

## TIER 3: Deferred (High Complexity / Infrastructure Blocked) — 3 Issues

- [ ] **ISSUE-938:** Distributed state (Cloud Function + client); complex
- [ ] **ISSUE-939:** Blocked on Shopify/Printful OAuth config
- [ ] **ISSUE-765:** Blocked on GCP Console + secrets config

## COMPLETED (This Session)

- [x] **ISSUE-704/705:** Road Manager (finder UI + miles tracking)
- [x] **ISSUE-941:** Social scheduling (future-time validation)
- [x] **ISSUE-949:** Campaign persistence (verified already fixed)

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
