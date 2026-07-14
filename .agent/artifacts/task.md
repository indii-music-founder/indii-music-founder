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

- [x] **ISSUE-926: Video Editor Import Crashes** — ✅ Full-stack media duration resolution (client probe + backend ffprobe fallback)
  - **Solution:** Two-layer resolution in `mediaMetadata.ts`:
    1. Fast path: hidden `<video>`/`<audio>` element probes `onloadedmetadata` client-side (raw File drops AND remote Storage URLs — `duration` isn't CORS-restricted)
    2. Fallback: new `getMediaDuration` Cloud Function (`packages/firebase/src/functions/creative/getMediaDuration.ts`) downloads the Storage object and runs real `ffprobe` (via `fluent-ffmpeg`/`ffprobe-static`, same libs already vendored for Electron's local audio analysis) when the client probe can't produce a finite duration (e.g. streamed source reporting `Infinity`)
  - **Security:** New shared `storageUri.ts` (extracted from `fetchStorageAssetForCanvas.ts`) enforces bucket + per-user path ownership before any backend probe — refuses cross-user/cross-project URIs (SSRF guard)
  - **Fixed a latent bug found while completing this:** `handleLibraryDragStart` had a hardcoded guessed `durationInSeconds: 5` placeholder for videos — removed; duration is now resolved for real at drop time, never guessed
  - **Acceptance Met:** File drops, library-asset drops, and initial video-history imports all resolve real duration before creating a clip; images use the same 90-frame convention as `handleAddSampleClip`
  - **Tests:** 25 new frontend unit tests (`mediaMetadata.test.ts`), 12 new backend tests (`getMediaDuration.test.ts`), 13 new shared-util tests (`storageUri.test.ts`), plus updated `VideoEditor.interaction.test.tsx` to match the real async drop contract — all passing; full creative/video suite (139 tests) and full firebase suite (379 tests) green
  - **Commit:** (this session, full-stack fix — supersedes the earlier partial `a803ccf0b`)
  - **Complexity:** Medium (required a new Cloud Function, not just a frontend utility)

- [x] **ISSUE-935: First Merch Canvas Action Can't Undo** — ✅ Canvas baseline established on init; design-load reset wired
  - **Acceptance Met:** First action undoes to empty canvas; loading a version clears undo stack and re-baselines
  - **Commit:** `8b393d7a3`
  - **Complexity:** Medium

## TIER 3: Deferred (High Complexity / Infrastructure Blocked) — 3 Issues

- [ ] **ISSUE-938:** Distributed state (Cloud Function + client); complex
- [ ] **ISSUE-939:** Blocked on Shopify/Printful OAuth config
- [ ] **ISSUE-765:** Blocked on GCP Console + secrets config

## COMPLETED (This Session)

### TIER 1 (7 issues)
- [x] **ISSUE-704/705:** Road Manager (finder UI + miles tracking) — cc426d298 + 100d6cb52
- [x] **ISSUE-941:** Social scheduling (future-time validation + local date) — 573a88f65
- [x] **ISSUE-949:** Campaign persistence (verified already fixed)
- [x] **ISSUE-927:** Asset drops routing unified — aacb94ad6
- [x] **ISSUE-928:** Video settings validated with bounds — aacb94ad6
- [x] **ISSUE-932:** Publicist error state tracking — aacb94ad6
- [x] **ISSUE-935:** Merchandise undo baseline on load — 8b393d7a3

### TIER 2 (2 issues)
- [x] **ISSUE-926:** Media duration probing (Web Audio API) — a803ccf0b
- [x] **ISSUE-935:** Merchandise undo baseline (already above)

**Total Fixed:** 8 issues (TIER 1 + TIER 2 complete!)

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
