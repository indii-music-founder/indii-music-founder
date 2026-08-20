# NEXT AGENT — FULL SESSION HANDOFF (2026-08-20, ~13:30 UTC)

You are taking over the **indii-music-founder** repo. This document tells you exactly what the previous agent did, what is proven live, what remains, where to look, and what to be careful about. **Read `.agent/HANDOFF_STATE.md` and `.agent/test_ledger/OPEN_ISSUES_V3.md` first** — they carry the same history in the repo. Also read `CLAUDE.md`, `.agent/workflows/branch-safety.md` (direct-to-main is mandatory), and `.agent/REAL_USER_AUTHENTICITY.md` before any code, push, or live testing.

---

## 1. THE FOUNDER'S STANDING RULES (binding, memorized)

1. **NEVER GUESS. Prove everything.** Every claim must be backed by actual state: logs, REST responses, storage metadata, deployed source archives, emulator runs. If you can't prove it, say so. The founder tests in their own browser and reports issues via chat — treat each report as a live repro.
2. **"Keep perfecting, keep documenting."** The founder wants a perfection sweep mindset: hunt for defect classes, fix with proof, record everything in the ledger.
3. **Do not babysit CI.** Push, then keep producing work while the deploy runs. Only check CI when it settles.
4. **The founder's browser is the decisive test surface** for UI. Watch `generateimagev3`/`generatecontentstream`/`enforceoperationcost` logs for their activity and react.

---

## 2. WHAT THE PREVIOUS AGENT SHIPPED (all on main, all CI-verified)

Recent commit history (newest first):

| SHA | What | CI |
|---|---|---|
| `b981c7d68` | **OTHER AGENT's** async-hardening sweep (races, leaks, auth gates, billing idempotency) — not mine | in_progress |
| `6a9ccc8ec` | docs: ISSUE-1393 close | — |
| `2179e43a9` | fix: lazy Firestore handles in daemon + webhook dispatcher | **#300 GREEN** |
| `8513fc6cd` | fix: wire retention daemon + webhook dispatcher, placements index | #299 RED (fixed by above) |
| `322345d2c` | docs: ISSUE-1392/1158 close | — |
| `ad5084ab0` | fix: TTS routed through generateContent (ISSUE-1392) | **#298 GREEN** |
| `3e1f88233` | fix: hosting header ordering (ISSUE-1391) | **#297 GREEN** |
| `97c91c010` | fix: editor DOM crash guard, rename, Send to Canvas, shell cache (ISSUE-1391) | **#296 GREEN** |
| `452368b42` | fix: chat_tokens metering (ISSUE-1383) | **#295 GREEN** |
| `5b8a3fdb9` | fix: editor exit + session-aware save errors + fail-loud deploys (ISSUE-1390) | **#294 GREEN** |

### Live-verified fixes (production-real, with evidence):

1. **ISSUE-1390 — "Failed to create file/folder" + editor nav gap.**
   - Rules proven INNOCENT via emulator repro (`packages/firebase/src/test/security/paint-save-repro.rules.test.ts`, wired into `test:rules`): the exact painting-save write ALLOWS for verified users, DENIES only for anonymous. The failure was client session state.
   - `FileSystemService.describeFileSystemError()` now gives session-aware messages (guest → sign in; permission-denied → session expired; network → retry).
   - `creativeHistorySlice` skips doomed file-node writes for guest/demo sessions.
   - **Deploy integrity fix:** `firebase deploy --force` exits 0 even when individual function updates fail (HTTP 429 quota). `deploy.yml` now tees the log, retries 429s twice with 90s backoff, and exits 1 on any `failed to (update|create) function`.

2. **ISSUE-1383 — chat_tokens meter stuck at 0.** Root cause: nothing ever wrote `chat_tokens` to the `usage` ledger; `user_usage_stats` has no writer. `generateContentStream` now reads cumulative `usageMetadata.totalTokenCount` (max-seen) and calls `recordUsage(uid,'chat_tokens',n)` after SETTLED. **Live proof: 6+ usage records with the founder's UID.**

3. **ISSUE-1391 — removeChild DOM crash, naming, asset flow, cache.**
   - Crash: fabric 7.4 re-parents the React-owned `<canvas>` into its own wrapper; the canvas lifecycle ran in `useEffect` (cleanup AFTER React removes DOM). Fixed with `useLayoutEffect` + idempotent `initialize()` + crash-proof `dispose()` in `CanvasOperationsService`. Tests: `CanvasOperationsService.lifecycle.test.ts`.
   - Names: editor header is **"Creative Canvas"** again (git-proven prior name). Copy in `DirectGenerationTab` updated.
   - **Send to Canvas** button in `CanvasActionRail` (rail + Escape close the editor; `handleSendToCanvas` in `useCreativeCanvas` saves, stages with natural dimensions via exported `readNaturalDimensions`, switches view).
   - **Hosting cache:** live `/` served `max-age=3600` (the `index.html` no-cache rule only matches the literal path). Now app + landing catch-all rules emit `no-cache, no-store, must-revalidate`; **rule ORDER matters** — catch-all must be FIRST, specific rules after it win (3e1f88233). Verified live: `/` no-cache, `/assets/*.js` immutable, png immutable.

4. **ISSUE-1392 + ISSUE-1158 — TTS + full audio E2E.** `generateAudioV3` called `interactions.create`, which the TTS model rejects (`400 Unsupported model interaction: gemini-3.1-flash-tts-preview`). Fixed: `models.generateContent` with string `speechConfig` (→ `voiceConfig.prebuiltVoiceConfig.voiceName`) + `responseModalities:['AUDIO']`; `extractAudioPcm` handles both response shapes. **Live probe proof:** 200, valid mono 24kHz 16-bit WAV (428,204 bytes) in storage, `audio_assets` doc owner-scoped, idempotent replay returns the same receipt, failed-job replay returns 409 with actionable message. This closed ISSUE-1158's residual acceptance.

5. **ISSUE-1393 — dead code + missing index.** `retentionDaemon` (onSchedule 72h) was never exported from index.ts (never deployed); its `placements` query needed a composite index that didn't exist (proven: `FAILED_PRECONDITION: The query requires an index`). The webhook dispatcher (`sendWebhookOnEvent`, `processWebhookQueue`, `createWebhook`) had 29 passing tests but was never exported. Fixed: wired all four into index.ts, added `placements (status ASC, placedAt ASC)` to `firestore.indexes.json`, lazy `getDb()` (see §5 concern), fail-loud query error handling. **Live: all 4 functions deployed; index READY; query OK.**

---

## 3. CURRENT PRODUCTION STATE (verified 13:30 UTC)

- `generateImageV3` rev **00305-cer** (per-API fix live since 00302-xed; founder confirmed variations work)
- `generateAudioV3` rev **00292-nem** (TTS fix live)
- `generateContentStream` rev **00067-jas** (chat_tokens metering live)
- `generateVideoV3` rev **00302-sow** (video pipeline proven end-to-end earlier; job `SUjgH7P8GLPBT1YEQpkn`)
- Deployed: `processWebhookQueue`, `sendWebhookOnEvent`, `createWebhook`, `retentionDaemon`
- Hosting cache: `/` → `no-cache`; `/assets/*.js|css` → immutable 1y; png → immutable 30d; landing same
- CI #294–#300: all green except #299 (fixed by 2179e43a9). `b981c7d68` (other agent) in progress.

---

## 4. WHAT REMAINS (in rough priority)

### In-authority code/verification work:
1. **"Create Video" guided-chat widget 400** — observed once during network flakiness; recheck on repro. Dashboard/chat → video generation path.
2. **Perfection sweep continuation.** Previous agent's parallel audit agents returned zero findings (too shallow — they read files but never ran queries). The real defects came from: (a) live REST `runQuery` probes against the actual database to find missing composite indexes, (b) dead-export sweeps vs index.ts, (c) module-top-level init scans. **Method lesson: audits must execute the code's real queries, not just read it.** Firestore serves multi-equality and equality+array-contains WITHOUT composites (single-field merge) — only range+equality and cross-field orderBy need composites.
3. **Latent landmines found but not fixed** (all in unimported/dead modules — harmless now, dangerous if wired): bare `getFirestore()` at module top level in `publishing/iswc.ts`, `orchestration/fsm/machine.ts`, `stripe/escrow.ts`. Also orphaned callables never exported: `triggerUnifiedDistribution`, `getSocialConnectionStatus`, `handleEscrowWebhook` (documented, deliberately NOT wired — no renderer call sites).
4. **`getUsageStats` projects query** `where(userId, archived==false)` — verified OK live via REST (single-field merge), no action needed, but it sits in the settings page path.

### Founder-gated (need founder's credentials/decision — document, don't fix):
- **ISSUE-1372:** `STRIPE_SECRET_KEY` = "MOCK_KEY_DO_NOT_USE", no `STRIPE_PRICE_*` env → checkout disabled.
- **ISSUE-1373:** 30/39 mock/placeholder secrets. REAL today: Arcjet, Gemini, Maps, GitHub, MCP, Printful, RESEND_FROM_EMAIL.
- **ISSUE-1374:** Founder seat #1 never committed (`GITHUB_TOKEN_FOUNDERS` is MOCK).
- Meta/App Review (1173), desktop signing (1163/992), ISRC/GS1/PRO/ISWC/MLC/SoundExchange/Copyright (1121).

---

## 5. TIPS, POINTERS, CONCERNS

**Tooling / access (proven working):**
- GCP: `GOOGLE_APPLICATION_CREDENTIALS="/Volumes/X SSD 2025/Users/narrowchannel/Downloads/indii-music-founder-firebase-adminsdk-fbsvc-fdb05ae45c.json"` for gcloud/logging/Firestore REST. `gcloud auth print-access-token` + curl for REST (runQuery, storage metadata, index listing via `gcloud firestore indexes composite list`).
- **Live probe harness (reusable):** `/tmp/probe-day2-audio-fix.cjs` — Playwright persistent profile `/tmp/pw-indii-probe` (founder's REAL session), App Check debug token from `/tmp/appcheck-debug-token.txt`, mints ID token from the profile's IndexedDB refresh token via `securetoken.googleapis.com`, reads App Check token from `firebase-app-check-database`, then calls callables directly via REST. This is the least fragile live-proof path.
- Deployed-source verification: `gcloud functions describe <fn> --format=json` → `buildConfig.source.storageSource` (bucket `gcf-v2-sources-148015878263-us-central1`, object, generation) → download zip → grep `lib/...js` for fix markers.
- Emulator for rules: `firebase emulators:exec --only firestore --project indii-os-rules-test "cd packages/firebase && npm run test:rules"` from repo root (firebase.json emulators live in ROOT firebase.json).

**Concerns / watch-outs:**
1. **Do NOT push while another CI run is in flight** (concurrency cancels it). The other agent is ACTIVE in this workspace — check `git status` and `git log origin/main` before any commit/push. **Preserve their dirty files** (currently ~99: landing-page redesign, `.perf-*.mjs`, stripe/brand work staged). Never `git add -A` blindly — a mixed commit already almost happened this session.
2. **The concurrent agent also edits `packages/firebase/src/index.ts` and gateway files.** Before touching shared files, `git fetch origin` + check `git log --oneline origin/main -3`. Expect conflicts on `index.ts` exports.
3. **Founder session fragility:** their browser intermittently hits session-restore failures, App Check throttling, network flakiness. "Failed to create X" errors are often session state, not rules. The session-aware error messages now say which.
4. **Region truth:** 195+ functions, all `us-central1`. `functionsWest1` is a pure alias — never "fix" west1 imports.
5. **`firestore.indexes.json` is the single source of truth** — CI `--force` DELETES any live index not listed. Any new composite query MUST be added there. Check queries via live REST probes (admin queries enforce indexes too).
6. **The import-crash class:** bare `getFirestore()` from `firebase-admin/firestore` at module top level throws at import in test envs; `admin.firestore()` namespace form does not. Any newly-wired module must use lazy `getDb()` (see 2179e43a9).
7. **Log queries:** function logs sometimes return empty textPayloads with the standard filter; use `gcloud logging read 'textPayload:"..."'` (e.g. `[Gateway Debug]`) to find the real error.
8. **Pre-commit gates are slow** (~60s+); pushes can time out — verify with `git rev-list --left-right --count origin/main...HEAD` after pushing, and re-push if 0/1.
9. **Commit message rule:** conventional commits (`fix(scope): ...`). Multi-line bodies with em-dashes broke the husky parser once — keep it simple.

**Ledger:** append to `.agent/test_ledger/OPEN_ISSUES_V3.md` only with verified facts. `.agent/HANDOFF_STATE.md` is the running handoff (currently dirty, uncommitted by design).

---

## 6. FIRST ACTIONS FOR THE NEXT AGENT

1. `git fetch origin` → confirm current main head (`b981c7d68` + whatever landed since).
2. Check CI status of the current head; if red, fix only the logged root cause.
3. Grep the founder's activity: `gcloud logging read` for `generateImageV3`/`generateContentStream` in the last hours — any new founder reports in chat override this document.
4. Pick the next unit: "Create Video" widget recheck, or continue the perfection sweep using live probes (missing indexes, dead exports, top-level-init landmines).
5. Before ANY push: read `.agent/workflows/branch-safety.md` + check for the other agent's in-flight work.
