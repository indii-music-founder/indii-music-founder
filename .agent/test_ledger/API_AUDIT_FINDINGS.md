# API & Creative-Pipeline Audit Findings

> **Note to Fixing Agent**: 
> **Correction logged:** an Explore agent claimed real secrets were "committed to version control." That is false — `.env` is gitignored, untracked, and historical commits contained zero real-secret patterns. Real secret values live only in the local, gitignored `.env`.
> **Noise discarded:** grep artifacts like `VITE_FIREBASE_E`, `VITE_A`, `VITE_E`, `VITE_MEM` are truncations of real keys caused by a regex pattern stopping at digits. They are not typos.

## P0 — Blocks the goal or breaks production

### F1: `isOwnerWrite()` is undefined in Firestore rules
- **Status:** ⏳ AWAITING
- **Severity:** 🔴
- **Module:** Firebase Rules
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** defined functions include `isOwner`, but not `isOwnerWrite`. It is referenced 25× in rules. This causes a compile error, either breaking deploys or denying all writes across ~25 collections.
- **Files:** packages/firebase/firestore.rules
- **Fix Direction:** replace `isOwnerWrite(userId)` with `isOwner(userId)` (or define it), then validate with `firebase_validate_security_rules` / `firebase deploy --only firestore:rules --dry-run`.
- **Verified?:** CONFIRMED

### F2: Server-side Gemini key parity: `GEMINI_API_KEY` not provisioned in CI/deploy
- **Status:** ⏳ AWAITING
- **Severity:** 🔴
- **Module:** Firebase Functions
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `GEMINI_API_KEY` appears in neither `.github/workflows/deploy.yml`, the local `.env`, nor `.env.example`. The local `.env` only has `VITE_API_KEY`. There is ambiguity with `GOOGLE_GENAI_API_KEY` and Vertex paths.
- **Files:** packages/firebase/src/functions/creative/gateway.ts, etc.
- **Fix Direction:** confirm `GEMINI_API_KEY` (and/or `GOOGLE_GENAI_API_KEY`) is set in Firebase Secret Manager, OR confirm Vertex/ADC mode is intended. Pick one path, document it, and remove the other.
- **Verified?:** CONFIRMED

### F3: `GEMINI_OMNI_FLASH_MODEL` unset → omni-remix generation always throws
- **Status:** ⏳ AWAITING
- **Severity:** 🔴
- **Module:** Firebase Functions (Creative)
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** The var exists nowhere in `.env`, `.env.example`, or any workflow. Defaulting to empty string causes `generateOmniRemixV3` to always throw.
- **Files:** packages/firebase/src/functions/creative/gateway.ts
- **Fix Direction:** set the model id in the functions runtime once Google exposes it, OR gate the feature/UI off until configured so it fails loudly and intentionally.
- **Verified?:** CONFIRMED

### F4: Campaign images stored as base64 data-URIs → escalation breaks
- **Status:** ⏳ AWAITING
- **Severity:** 🔴
- **Module:** Renderer (Marketing)
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** Writes `data:image/png;base64,...` into the campaign Firestore doc. Breaks 1 MB doc limit and cannot be uploaded to external APIs (socials).
- **Files:** packages/renderer/src/services/marketing/CampaignIntelligenceService.ts
- **Fix Direction:** store campaign images in Cloud Storage (reuse `creative/{userId}/…` path) and persist a `gs://`/HTTPS URL, never inline base64.
- **Verified?:** RECON

### F5: Frontend Gemini key referenced under names that aren't defined
- **Status:** ⏳ AWAITING
- **Severity:** 🔴
- **Module:** Renderer
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** renderer reads `import.meta.env.VITE_API_KEY`, `VITE_GEMINI_API_KEY`, and `VITE_GOOGLE_API_KEY`, but only `VITE_API_KEY` exists in `.env`/`.env.example`.
- **Files:** various in packages/renderer
- **Fix Direction:** pick one canonical name, alias or refactor the others to it, and document it in `.env.example`.
- **Verified?:** CONFIRMED

## P1 — Security / correctness

### F6: `GenAI.generateImage()` called directly client-side
- **Status:** ⏳ AWAITING
- **Severity:** 🟡
- **Module:** Renderer (Marketing)
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** bypasses `generateImageV3` and calls SDK directly.
- **Files:** packages/renderer/src/services/marketing/CampaignIntelligenceService.ts
- **Fix Direction:** route campaign image gen through the same `generateImageV3` callable used by `ImageGenerationService`.
- **Verified?:** RECON

### F7: `GITHUB_TOKEN` name mismatch across layers
- **Status:** ⏳ AWAITING
- **Severity:** 🟡
- **Module:** Firebase Functions
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** mismatch between `GITHUB_TOKEN`, `GITHUB_TOKEN_FOUNDERS`, `GITHUB_AUTH_TOKEN`, and `GITHUB_PERSONAL_ACCESS_TOKEN`.
- **Files:** bug reporter functions
- **Fix Direction:** standardize on `GITHUB_TOKEN`, fix local `.env` + Secret Manager, delete stray names.
- **Verified?:** CONFIRMED

### F8: Stripe webhook proceeds when idempotency check fails
- **Status:** ⏳ AWAITING
- **Severity:** 🟡
- **Module:** Firebase Functions (Stripe)
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** catches idempotency error and continues.
- **Files:** packages/firebase/src/stripe/webhookHandler.ts
- **Fix Direction:** on idempotency-check failure, return non-2xx so Stripe retries.
- **Verified?:** RECON

### F9: Video job can hang / orphan; integrity check not enforced
- **Status:** ⏳ AWAITING
- **Severity:** 🟡
- **Module:** Creative
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** 9-min poll cap in gateway; HEAD existence check logs warning but returns URL; if snapshot never fires, UI hangs.
- **Files:** packages/firebase/src/functions/creative/gateway.ts, packages/renderer/src/services/video/VideoGenerationService.ts
- **Fix Direction:** mark job `failed` on poll timeout, reject HEAD failure, add error path for job subscription errors.
- **Verified?:** RECON

### F10: Cloud-Function `fetch` calls without timeout/AbortSignal
- **Status:** ⏳ AWAITING
- **Severity:** 🟡
- **Module:** Firebase Functions
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** external `fetch` without timeout can tie up function to 9-min ceiling.
- **Files:** packages/firebase/src/lib/touring.ts, video_generation_direct.ts, audio.ts
- **Fix Direction:** wrap external `fetch` in an `AbortController` timeout helper.
- **Verified?:** RECON

### F11: Streaming endpoint uses `Access-Control-Allow-Origin: *`
- **Status:** ⏳ AWAITING
- **Severity:** 🟡
- **Module:** Firebase Functions (Streaming)
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `Access-Control-Allow-Origin: *` used.
- **Files:** packages/firebase/src/streaming/agentStream.ts
- **Fix Direction:** restrict to known origins unless fully relying on Bearer + App Check.
- **Verified?:** RECON

## P2 — Hardening / hygiene

### F12: Generation prompts have no max length
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Creative
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `GenerateImageSchema`/`GenerateVideoSchema` use `z.string().min(1)` with no cap.
- **Files:** packages/firebase/src/functions/creative/gateway.ts
- **Fix Direction:** Add a sane `.max()`.
- **Verified?:** RECON

### F13: Audio model not on the approved list
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Creative
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `generateAudioV3` hardcodes `'gemini-3-pro-preview'`.
- **Files:** packages/firebase/src/functions/creative/gateway.ts
- **Fix Direction:** validate against `APPROVED_MODELS`.
- **Verified?:** RECON

### F14: Rate limiting via Firestore transactions
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Firebase Functions
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `lib/rateLimit.ts` bills per check.
- **Files:** lib/rateLimit.ts
- **Fix Direction:** consider an in-memory first layer.
- **Verified?:** RECON

### F15: `.env.example` drift (both directions)
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Config
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** local-only keys missing from template, template-only keys absent locally.
- **Files:** .env.example
- **Fix Direction:** Reconcile so `.env.example` is the true contract.
- **Verified?:** CONFIRMED

### F16: Stripe product/price env not provisioned in CI
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Billing
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** missing from `deploy.yml`/`.env`.
- **Files:** various
- **Fix Direction:** Confirm they're in Secret Manager.
- **Verified?:** CONFIRMED

### F17: `VITE_HFA_API_KEY`/`VITE_HFA_ACCOUNT_ID` absent from local `.env`
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Config
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** referenced by functions but absent.
- **Files:** local .env
- **Fix Direction:** provision in local `.env`.
- **Verified?:** CONFIRMED

### F18: Admin god-mode has no immutable audit trail
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Firebase Functions (Admin)
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `setGodMode.ts` only logs to console.
- **Files:** functions/admin/setGodMode.ts
- **Fix Direction:** add an `audit_logs` write.
- **Verified?:** RECON

### F19: Generated-asset ownership not re-validated on reference
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Creative
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `gateway.ts` accepts `gs://` by format only.
- **Files:** packages/firebase/src/functions/creative/gateway.ts
- **Fix Direction:** confirm URI belongs to caller's folder.
- **Verified?:** RECON

### F20: Dead `isGuest()` branches
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Firebase Rules
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** `isGuest()` always returns `false`.
- **Files:** firestore.rules
- **Fix Direction:** prune dead branches.
- **Verified?:** RECON

### F21: Secret hygiene (informational)
- **Status:** ⏳ AWAITING
- **Severity:** 🟢
- **Module:** Security
- **Found:** 2026-06-02 by audit
- **Evidence/Root Cause:** Real secret values in local `.env`.
- **Files:** .env
- **Fix Direction:** verify prod uses Secret Manager, rotate any exposed tokens.
- **Verified?:** CONFIRMED
