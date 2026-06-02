# API & Creative-Pipeline Audit — Findings

> **Read me first.** This file is the output of a **find-only** audit pass (`/hunter` + `/better`
> run in find-only mode). The audit agent **never modifies code**. A separate fixing agent consumes
> this file and applies fixes. Mirror of the `OPEN_ISSUES.md` handoff contract.
>
> **Generated:** 2026-06-02 · **Branch:** `main` · **Scope:** image/video generation +
> marketing escalation, plus the full API / env / security surface.

## Goal this audit protects

Guarantee that the platform can (1) generate images, (2) generate videos, and (3) **escalate**
those assets downstream into marketing (campaigns → posts → social/distribution) — "the key hearts
of marketing" — and that every API behind this is solid, secure, and provisioned in **every**
environment (local `.env`, GitHub Actions, Firebase Functions runtime) with no name typos.

## Legend

- **Verified?** `CONFIRMED` = checked directly with grep/git this session · `RECON` = surfaced by
  read-only exploration with file:line; fixing agent should reconfirm before editing.
- **Severity:** 🔴 P0 (blocks goal / breaks prod) · 🟡 P1 (security/correctness) · 🟢 P2 (hardening).
- **Status:** ⏳ AWAITING (fix agent has not started) · 🔧 IN PROGRESS · ✅ FIXED (+ commit).

## Two corrections to prevent wasted effort

1. **No secret leak in git.** An earlier recon pass claimed real secrets were "committed to version
   control." **False.** `.env` is gitignored (`.gitignore:43-45`), untracked
   (`git ls-files --error-unmatch .env` → no match), and historical commits touching `.env` held
   **zero** real-secret patterns. Real secret *values* live only in the local gitignored `.env` —
   normal dev hygiene. **Do not chase a git-history scrub.**
2. **Grep artifacts are not typos.** `VITE_FIREBASE_E`, `VITE_A`, `VITE_E`, `VITE_MEM` are
   truncations of real keys (`VITE_FIREBASE_E2E_MOCK`, `VITE_A0_*`, `VITE_E2E`, `VITE_MEM0_API_KEY`)
   from a `[A-Z_]+` pattern stopping at digits. **Not** misconfigured keys.

This doc never reproduces secret *values*; "rotate X" refers to a key by name only.

---

## 🔴 P0 — Blocks the goal or breaks production

### F1: `isOwnerWrite()` is undefined in Firestore rules
- **Status:** ⏳ AWAITING
- **Severity:** 🔴 P0
- **Verified?:** CONFIRMED
- **Module:** Firebase / Security Rules
- **Found:** 2026-06-02 by audit
- **Evidence / Root Cause:** `isOwnerWrite(...)` is referenced **25×** in `firestore.rules` but is
  **never defined**. The only defined helpers are `isAuthenticated, isEmailAuthenticated, isAdmin,
  isGuest, isOwner, isPublicProfile, isOrgMember, isOrgOwner, isValidString, isAnonymous,
  isVerifiedUser`. (`grep -c isOwnerWrite` = 25; `grep "function isOwnerWrite"` = 0.) An undefined
  function reference is a **compile error** for Firestore rules — meaning either deploys are
  silently failing (a *stale* ruleset is live and drifting from the repo) or writes across ~25
  user-scoped collections are denied.
- **Files:** `packages/firebase/firestore.rules`
- **Fix Direction:** Replace `isOwnerWrite(userId)` with `isOwner(userId)` (or define
  `isOwnerWrite` intentionally if it was meant to differ from `isOwner`). Then validate with
  `firebase deploy --only firestore:rules --dry-run` (or `firebase_validate_security_rules`) and
  confirm the live ruleset matches the repo.
- **Acceptance:** rules compile clean; deploy succeeds; live ruleset == repo.

### F2: Server-side Gemini key (`GEMINI_API_KEY`) not provisioned in CI/deploy
- **Status:** ⏳ AWAITING
- **Severity:** 🔴 P0
- **Verified?:** CONFIRMED
- **Module:** Firebase Functions / AI generation
- **Found:** 2026-06-02 by audit
- **Evidence / Root Cause:** Functions read `process.env.GEMINI_API_KEY` and
  `process.env.GOOGLE_GENAI_API_KEY` and declare `defineSecret('GEMINI_API_KEY')`, but
  `GEMINI_API_KEY` appears in **neither** `.github/workflows/deploy.yml`, the local `.env`, nor
  `.env.example`. Local `.env` only has `VITE_API_KEY` (a frontend build var). There is also
  dual-name ambiguity (`GEMINI_API_KEY` vs `GOOGLE_GENAI_API_KEY`) and a parallel Vertex path
  (`VITE_USE_VERTEX`, `VERTEX_LOCATION`) — unclear which is authoritative in prod.
- **Files:** `packages/firebase/src/functions/creative/gateway.ts`, AI libs in
  `packages/firebase/src/lib/`, `.github/workflows/deploy.yml`
- **Why it matters:** this is the key that powers **server-side image/video/audio generation**. If
  it isn't set in the deployed runtime, generation works locally but dies in prod.
- **Fix Direction:** Confirm `GEMINI_API_KEY`/`GOOGLE_GENAI_API_KEY` is in **Firebase Secret
  Manager** for the functions runtime (`firebase functions:secrets:get`), OR confirm Vertex/ADC is
  the intended prod path and remove the dead API-key reads. Pick **one** path and document it.
- **Acceptance:** generation succeeds against the deployed functions; only one key path remains.

### F3: `GEMINI_OMNI_FLASH_MODEL` unset → omni-remix generation always throws
- **Status:** ⏳ AWAITING
- **Severity:** 🔴 P0
- **Verified?:** CONFIRMED
- **Module:** Firebase Functions / Creative (video escalation)
- **Found:** 2026-06-02 by audit
- **Evidence / Root Cause:** `gateway.ts:55` →
  `const OMNI_FLASH_MODEL_ID = process.env.GEMINI_OMNI_FLASH_MODEL || process.env.VITE_GEMINI_OMNI_FLASH_MODEL || ''`
  and `gateway.ts:206` throws "Set GEMINI_OMNI_FLASH_MODEL …" when empty. The var exists **nowhere**
  in `.env`, `.env.example`, or any workflow → `generateOmniRemixV3` is dead in every environment.
- **Files:** `packages/firebase/src/functions/creative/gateway.ts:55,206`
- **Fix Direction:** Set the model id in the functions runtime once available, OR gate the
  feature/UI off until configured so it fails loudly/intentionally rather than mid-flow.
- **Acceptance:** omni-remix either generates, or is cleanly gated with an honest "coming soon"
  empty state (no thrown error mid-flow).

### F4: Campaign images stored as base64 data-URIs → escalation breaks
- **Status:** ⏳ AWAITING
- **Severity:** 🔴 P0
- **Verified?:** RECON
- **Module:** Renderer / Marketing
- **Found:** 2026-06-02 by audit
- **Evidence / Root Cause:** `CampaignIntelligenceService.ts:264-265` writes
  `data:image/png;base64,...` directly into the campaign Firestore doc. Two failure modes on the
  escalation path: (1) **Firestore 1 MB doc limit** — a few large images blow it, the write fails,
  the campaign silently doesn't persist; (2) **external APIs can't consume `data:` URIs** — social
  / distribution upload fails when the campaign escalates.
- **Files:** `packages/renderer/src/services/marketing/CampaignIntelligenceService.ts:264-265`;
  consumers `packages/renderer/src/modules/marketing/components/CampaignDetail.tsx`
- **Fix Direction:** Store campaign images in Cloud Storage (reuse `CreativeStorageService`
  `creative/{userId}/…` convention) and persist a `gs://`/HTTPS URL — never inline base64. Validate
  the URL is fetchable before a post is marked ready to escalate.
- **Acceptance:** campaign docs stay well under 1 MB; escalated posts carry a fetchable URL.

### F5: Frontend Gemini key referenced under names that aren't defined
- **Status:** ⏳ AWAITING
- **Severity:** 🔴 P0
- **Verified?:** CONFIRMED
- **Module:** Renderer / config
- **Found:** 2026-06-02 by audit
- **Evidence / Root Cause:** renderer reads `import.meta.env.VITE_API_KEY`, `VITE_GEMINI_API_KEY`,
  **and** `VITE_GOOGLE_API_KEY` in different places, but only `VITE_API_KEY` exists in
  `.env`/`.env.example`. The other two resolve to `undefined` — any client path reading them
  silently loses the key. This is the "typo across every place that needs the env" concern.
- **Files:** `packages/renderer/src/` (multiple `import.meta.env` call sites)
- **Fix Direction:** Pick one canonical name, alias/refactor the others to it, document it in
  `.env.example`.
- **Acceptance:** exactly one Gemini-key env name in the renderer; it resolves to a real value.

---

## 🟡 P1 — Security / correctness

### F6: `GenAI.generateImage()` called directly client-side (no Cloud Function auth gate)
- **Status:** ⏳ AWAITING · **Severity:** 🟡 P1 · **Verified?:** RECON · **Module:** Renderer / Marketing
- **Evidence:** `CampaignIntelligenceService.ts:278,298` bypass `generateImageV3` and call the SDK
  directly — no function-level auth/rate-limit/cost control, relies on implicit SDK session,
  inconsistent with the hardened path used by `ImageGenerationService`.
- **Fix Direction:** Route campaign image gen through the same `generateImageV3` callable.

### F7: `GITHUB_TOKEN` name mismatch across layers
- **Status:** ⏳ AWAITING · **Severity:** 🟡 P1 · **Verified?:** CONFIRMED · **Module:** Functions / Bug reporting
- **Evidence:** functions read `process.env.GITHUB_TOKEN` / `GITHUB_TOKEN_FOUNDERS` (and
  `defineSecret('GITHUB_TOKEN')`); `.env.example` documents `GITHUB_TOKEN`; local `.env` defines
  `GITHUB_AUTH_TOKEN` + `GITHUB_PERSONAL_ACCESS_TOKEN`. Names don't line up → `reportBugFn` can't
  find a token under the expected name and silently fails to file issues.
- **Fix Direction:** Standardize on `GITHUB_TOKEN`; fix local `.env` + Secret Manager; remove strays.

### F8: Stripe webhook proceeds when idempotency check fails
- **Status:** ⏳ AWAITING · **Severity:** 🟡 P1 · **Verified?:** RECON · **Module:** Functions / Stripe
- **Evidence:** `stripe/webhookHandler.ts:345-348` catches the idempotency error and continues. If
  Firestore is briefly unavailable the same event can process twice (double subscription / credit).
- **Fix Direction:** On idempotency-check failure, return non-2xx so Stripe retries.

### F9: Video job can hang / orphan; integrity check not enforced
- **Status:** ⏳ AWAITING · **Severity:** 🟡 P1 · **Verified?:** RECON · **Module:** Creative / Video
- **Evidence:** `gateway.ts:363-383` (9-min poll cap; job can stay `processing` on timeout while
  Google may still finish → orphan); `VideoGenerationService.ts:438-450` (HEAD existence check logs
  a warning but still returns the URL → UI gets a dead asset); `VideoGenerationService.ts:380-412`
  (if the Firestore `onSnapshot` never fires, the UI hangs to the 10-min timeout with no fallback).
- **Fix Direction:** Mark job `failed` with a retry hint on poll timeout; reject on HEAD failure
  instead of returning a dead URL; add an error path if the job subscription errors.

### F10: Cloud-Function `fetch` calls without timeout/AbortSignal
- **Status:** ⏳ AWAITING · **Severity:** 🟡 P1 · **Verified?:** RECON · **Module:** Functions / lib
- **Evidence:** `lib/touring.ts:31`, `lib/video_generation_direct.ts:31,305`, `lib/audio.ts:88,95`
  and other `lib/` callers issue `fetch` with no timeout → a hung upstream ties a function up to its
  9-min ceiling.
- **Fix Direction:** Wrap external `fetch` in an `AbortController` timeout helper; apply repo-wide.

### F11: Streaming endpoint uses `Access-Control-Allow-Origin: *`
- **Status:** ⏳ AWAITING · **Severity:** 🟡 P1 · **Verified?:** RECON · **Module:** Functions / Streaming
- **Evidence:** `streaming/agentStream.ts:60` sets `*`.
- **Fix Direction:** Restrict to the known-origin allow-list used by other endpoints unless fully
  relying on Bearer + App Check.

---

## 🟢 P2 — Hardening / hygiene

### F12: Generation prompts have no max length
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** RECON
- `GenerateImageSchema`/`GenerateVideoSchema` use `z.string().min(1)` with no cap
  (`gateway.ts:~94,141`). Add a sane `.max()` to avoid token-budget rejections.

### F13: Audio model not on the approved list
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** RECON
- `generateAudioV3` hardcodes `'gemini-3-pro-preview'` (`gateway.ts:~733`), not validated against
  `APPROVED_MODELS` in `core/config/intelligence-models.ts`.

### F14: Rate limiting via Firestore transactions (cost-amplification target)
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** RECON
- `lib/rateLimit.ts` bills per check via `runTransaction`. Consider an in-memory first layer with
  Firestore as distributed fallback.

### F15: `.env.example` drift (both directions)
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** CONFIRMED
- Local-only keys missing from the template (e.g. `VITE_MEM0_API_KEY`, `VITE_NGROK_AUTHTOKEN`,
  `VITE_RAG_PROXY_URL`, `VITE_INTELLIGENCE_MOCK_MODE`, `RESEND_API_KEY`, `PANDADOC_*`,
  `PRINTFUL_API_KEY`, `STRIPE_*`, `META_*`, `TIKTOK_*`); template-only keys absent locally (e.g.
  `VITE_ACRCLOUD_*`, `VITE_HFA_*`, `VITE_FOUNDER_MODE`, `VITE_GITHUB_REPO`, `VITE_REMOTION_GCP_*`,
  `INFLUENCER_BOUNTY_BASE_URL`, `AUTH_HANDOFF_REDEEM_URL`). Reconcile so `.env.example` is the true
  contract for new machines / CI.

### F16: Stripe product/price env not provisioned in CI
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** CONFIRMED
- Functions read `STRIPE_PRODUCT_PRO`, `STRIPE_PRODUCT_STUDIO`, `STRIPE_PRICE_CREDIT_PACK`,
  `STRIPE_PLATFORM_ACCOUNT_ID` at runtime; none appear in `deploy.yml`/`.env`. Confirm they're in
  Secret Manager or subscription/billing tiering breaks in prod.

### F17: `VITE_HFA_API_KEY` / `VITE_HFA_ACCOUNT_ID` referenced by functions but absent locally
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** CONFIRMED
- Functions reference `process.env.VITE_HFA_*`; absent from local `.env` → mechanical-licensing
  (HFA) path no-ops until provisioned.

### F18: Admin god-mode has no immutable audit trail
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** RECON
- `functions/admin/setGodMode.ts` only `logger.info()`s. Add an `audit_logs` write
  (action, target uid, performedBy, serverTimestamp).

### F19: Generated-asset ownership not re-validated on reference
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** RECON
- `creative/gateway.ts` accepts `gs://` reference URIs by format only (`z.string().startsWith('gs://')`).
  Validate the URI belongs to the caller's own `creative/{uid}/` folder to prevent cross-user refs.

### F20: Dead `isGuest()` branches in Firestore rules
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** RECON
- `isGuest()` always returns `false` but ~50 rules still branch on it. Prune for clarity.

### F21: Secret hygiene (informational — no code change)
- **Status:** ⏳ AWAITING · **Severity:** 🟢 P2 · **Verified?:** CONFIRMED
- Real secret values sit in the local gitignored `.env` (correct). Ops checklist: verify prod uses
  Secret Manager (not these), and rotate any token that may have been exposed in logs/screenshots
  (notably the GitHub PAT). No source edit required.

---

## How to verify these are real (before fixing)

1. **F1:** `firebase deploy --only firestore:rules --dry-run` → expect a compile error on `isOwnerWrite`.
2. **F2 / F16 / F17:** `firebase functions:secrets:get` (or GCP Secret Manager) → see whether
   `GEMINI_API_KEY`, `STRIPE_PRODUCT_*`, `HFA_*` are provisioned in prod (missing vs out-of-band).
3. **F3:** code-confirmed — `OMNI_FLASH_MODEL_ID` defaults to `''` then throws; no env source exists.
4. **F4 / F5 / F6:** generate a campaign with images; inspect persisted Firestore doc size + the
   resolved env values at build.
5. **Regression gate after fixes:** creative E2E specs in `/e2e/` + `npm run typecheck && npm test -- --run`.

---

## GitHub issues filed for the P0s

| Finding | Issue |
| --- | --- |
| F1 | [#128](https://github.com/indii-music-founder/indii-music-founder/issues/128) |
| F2 | [#129](https://github.com/indii-music-founder/indii-music-founder/issues/129) |
| F3 | [#130](https://github.com/indii-music-founder/indii-music-founder/issues/130) |
| F4 | [#131](https://github.com/indii-music-founder/indii-music-founder/issues/131) |
| F5 | [#132](https://github.com/indii-music-founder/indii-music-founder/issues/132) |
