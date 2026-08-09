# Codex Checkpoint — Short-Viewport and Evidence-Boundary Hunter Pass

**Date:** 2026-08-08

**Branch:** `main`

**Objective:** Re-run the full application hunt from a shorter-phone, first-time-user, account-transition, and evidence-authority perspective. Fix every confirmed non-billing defect discovered in the pass without representing unavailable Firebase Hosting deployment as application success.

## Fixed finding groups

- **ISSUE-1341 — Compact-height reachability:** Corrected device-specific visibility, statically compiled responsive grids, short-viewport login/modal scrolling, mobile drawer focus containment, and touch-visible chat actions.
- **ISSUE-1342 — Workspace durability:** Firestore/auth failures now propagate; per-user hydration must succeed before writes; account changes reset authority; pending writes and retries fail closed.
- **ISSUE-1343 — Analytics attribution:** Owner releases replace listener history as the catalogue; channel/account totals are never allocated to tracks; adjacent engagement fields are not renamed into saves, completion, history, or growth.
- **ISSUE-1344 — Financial/health evidence:** Removed fixed market-share attribution and unprobed health; period comparisons use matching source populations; account-switch failures clear previous-user data.
- **ISSUE-1345 — Visa authority:** Static planning no longer claims current legal requirements, processing time, approval, or tour readiness.
- **ISSUE-1346 — Operation completion:** File selection is not upload, a Wiki write is not RAG indexing, and an artifact draft is not a live purchase page.

## Validation evidence

```text
$ node scripts/verify-api-system-integrity.js
API System Integrity Check Passed

$ npm run typecheck
All workspace and Firebase test TypeScript projects passed

$ npm run lint
0 errors; 152 standing warnings

$ npx vitest run <18 affected suites>
18 files passed; 70 tests passed

$ npm run build:studio
Production Studio build passed

$ npm run ci
Preflight, API integrity, typecheck, flowcharts, and all four test shards passed

$ git diff --check
clean
```

## Browser evidence boundary

A visible local Chromium run at 667×375 preserved `/login`, `/privacy`, `/terms`, and `/tax-form-upload`; the sign-up submit control remained scrollable and fully inside the viewport; no console error was observed. This is structural local UI evidence only, not a production or live-user acceptance claim.

## External condition

The previously acknowledged Firebase Hosting storage/quota condition still prevents a fresh staging upload and real production acceptance. The deployment workflow fails closed on that provider condition. This pass did not bypass it, substitute stale deployment state, or treat billing/quota failure as application success.
