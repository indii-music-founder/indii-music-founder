# Codex Checkpoint — App Truthfulness and Durability Remediation

**Date:** 2026-08-08

**Branch:** `main`

**Objective:** Diagnose and repair every confirmed non-billing defect discussed or discovered in the session. Firebase Hosting quota remains an acknowledged external condition and is not represented as an application success.

## Delivery history

- `61448f10a` — preserve public and authentication routes on phone viewports
- `c31634ad7` — publish durable pre-save campaigns and persist consented fan leads
- `5af14fe91` — make limited drops, release paths, DDEX authority, runtime dependencies, and organization access truthful
- `106b11b3e` — fail closed when a staging preview cannot be created and reached
- `6420654e3` — replace fabricated admin metrics and false-empty operational state
- Current consolidation wave — ISSUE-1319 through ISSUE-1338 in `.agent/test_ledger/OPEN_ISSUES_V3.md`, plus strict Firestore/Storage coverage and regression tests. The commit SHA is intentionally supplied by Git history rather than pre-written into this checkpoint.

## Acceptance matrix

| Area | Acceptance evidence | Result |
|---|---|---|
| Mobile route precedence | Phone-class routing preserves legal, tax upload, login/signup, and OAuth callback paths while explicit Controller and authenticated app paths keep their intended behavior. | Fixed |
| Pre-save publication and fan leads | Share controls unlock only after backend persistence; consented leads and conversion outbox records are awaited before redirect. | Fixed |
| Limited drops and canonical release paths | Drops save as `setup_required` drafts with real IDs; tools use top-level collections; lookup failures no longer masquerade as no match. | Fixed |
| DDEX readiness | Metadata alone remains `metadata_only`; verified sender/recipient authority is required for `package_ready`. | Fixed |
| Dependency graph | Import declarations and version drift are clean; production and complete audits both report zero vulnerabilities. | Fixed |
| Security Center access control | Server-backed organization roles, strict shared contracts, append-only audit records, direct-render enforcement, and navigation filtering replace the pending static panel. | Fixed |
| Staging deployment truth | A URL is exposed only after a current successful upload and HTTP 200 probe; deployment failure blocks staging E2E and production. | Fixed |
| Authentication and session edit planning | Landing development auth uses real Firebase and fails closed; the edit planner analyzes the authorized recording and validates model timing instead of returning canned cuts. | Fixed |
| Agent/workflow completion truth | Orchestration and graph status derive from step/node outcomes; Maestro preserves exact prompts; campaign packages no longer claim deployment. | Fixed |
| Analytics and automation | Forecasts require history, heuristics disclose low confidence, cached data is labeled stale, and weak signals cannot mutate provider campaigns. | Fixed |
| Capture, OCR, investor, token-gate, EPK, and Web3 | Simulated scanning/authentication/publication/deployment was removed. Unbuilt capabilities are explicitly unavailable; local exports and drafts are labeled accurately; wallet state is provider-verified. | Fixed |
| Notes, label deals, and offline persistence | Owner-scoped schemas/rules persist real state. Non-replayable queues and fake sync indicators were removed; failed writes stay visible instead of being silently dropped. | Fixed |
| Licensing authority | Checkout requires a server-owned accepted agreement; fulfillment verifies immutable terms, rights, payer, payout consent, and paid amount before activation. | Fixed |
| Screenwriter handoff and PWA share target | Typed scene data reaches actual storyboard slots; manifest, worker, IndexedDB, and Conductor draft fields agree and transfer real files before cleanup. | Fixed |
| Listener and async lifecycle | Audio, video, retry, RUM, messaging, and lazy initialization paths clean up deterministically across success, failure, timeout, abort, and early unsubscribe. | Fixed |
| Firestore and Storage policy | FCM tokens, smart-contract drafts, notes, media, PRO, and label-deal paths are owner-bound, schema-restricted, and fail closed in the emulator. | Fixed |

## Closing evidence

```text
$ npm run check:dep-integrity
Dependency integrity check: clean

$ npm run check:dep-drift
Dependency version drift check: clean

$ node scripts/verify-api-system-integrity.js
API System Integrity Check Passed

$ npm audit --omit=dev --json
0 total vulnerabilities

$ npm audit --json
0 total vulnerabilities

$ npm run test:api
24 passed

$ npm run health:check
7 passed; 33 skipped by existing integration conditions

$ firebase emulators:exec --only firestore,storage ... npm run test:rules
4 files passed; 239 tests passed

$ npm run lint
0 errors; 158 standing warnings

$ npm run typecheck
All workspace and Firebase test TypeScript projects passed

$ npm run build:studio
$ npm run build:firebase
$ npm run build:landing
$ npm run build:mcp
All production builds passed

$ npm run ci
Shard 1: 1,529 passed; 14 skipped
Shard 2: 1,376 passed; 20 skipped
Shard 3: 1,607 passed; 16 skipped
Shard 4: 1,616 passed; 2 skipped
6,128 passed total; 52 skipped by existing conditions
All CI checks passed successfully

$ git diff --check
clean
```

The hidden-pattern detector remains at the recorded risk-score baseline of 126; this wave did not increase it. No simulated state, mocked authentication, or fabricated provider response is used as live-user acceptance evidence.

## Remaining external action

Firebase Hosting storage quota must be resolved before a fresh staging upload, staging E2E, production deployment, and genuine live-user acceptance can run. The workflow fails closed while that external condition remains, so no production-live claim is made here.
