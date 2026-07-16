# Open Issues

The canonical open-issues ledger lives at:

- `.agent/test_ledger/OPEN_ISSUES.md`

**Last updated:** 2026-06-23

Do not add regular issue entries to this root file. Add product, CI, flowchart,
beta-launch, verification, and follow-up issues to the detailed ledger in
`.agent/test_ledger/OPEN_ISSUES.md`.

This file exists only as a discoverable pointer for agents and humans looking
for the issue tracker from the repository root.

---

## Production Readiness Audit — 2026-07-15

Findings from a read-only, end-to-end production audit (security, payments, auth,
Electron, Firestore rules). Ordered roughly by severity. No code was modified.

### Blocking / Critical

- [ ] **[Secrets / Git Hygiene]**: A live Google OAuth client secret is committed to the repo root at `client_secret_148015878263-pfcoueoik0p1cn744vdn2m1u1gjl119m.apps.googleusercontent.com.json`. It is git-tracked (`git ls-files` confirms) and the JSON contains a real `client_secret` value (a True Secret per `docs/API_CREDENTIALS_POLICY.md` §3.1). This must be revoked/rotated in GCP and purged from git history — it is exposed to anyone with repo access and to all forks/clones.

- [ ] **[Stripe Webhook — Licensing Payout]**: `handleLicensingCheckoutCompleted` in `packages/firebase/src/stripe/webhookHandler.ts:89` calls `stripe.transfers.create(...)` with **no idempotency key**, then writes to Firestore in two non-transactional `add()` calls (`licenses` at :103 and `users/{userId}/ledger` at :116). If the transfer succeeds but a subsequent Firestore write throws, the handler throws, the delivery is marked `failed`, and Stripe retries. On retry the delivery is explicitly re-processed (the idempotency guard at :554 treats `failed` as retryable), so `stripe.transfers.create` runs **again → duplicate real payout to the connected account**. Pass a Stripe idempotency key derived from `session.id`, and/or record the transfer id before creating it.

### High

- [ ] **[Firestore Rules — licenses read leak]**: `packages/firebase/firestore.rules:1431` grants `allow read: if isVerifiedUser() || isGuest();` on the top-level `/licenses/{licenseId}` collection with **no owner scoping**. Any authenticated (non-anonymous) user can read every other user's license records (sync deals, amounts, track titles, Stripe session ids written by the webhook at webhookHandler.ts:103). Scope reads to `resource.data.userId == request.auth.uid` like every other owner-scoped collection in this file.

- [ ] **[Firestore Rules — licenses update/delete via guest branch]**: Same block, `packages/firebase/firestore.rules:1433-1434`: `allow update: ... || isGuest();` and `allow delete: ... || isGuest();`. These currently fail closed only because `isGuest()` is hardcoded to `false` (line 25-27). This is a latent footgun — if `isGuest()` is ever re-enabled, any guest could update/delete arbitrary licenses. The trailing `|| isGuest()` on write rules should be removed, not left load-bearing on a stubbed helper.

### Medium

- [ ] **[Stripe Webhook — payment_status not verified]**: `handleMarketplacePurchaseCompleted` (`webhookHandler.ts:179`) and `handleMicroTransactionCheckoutCompleted` (`webhookHandler.ts:35`) fulfill on `checkout.session.completed` without checking `session.payment_status === 'paid'`. For asynchronous payment methods (ACH/bank debit, etc.) `checkout.session.completed` fires while the payment is still `unpaid`/processing, and settlement can later fail. Marketplace grants the sale + revenue record and micro-transactions grant credits before funds are confirmed. Gate fulfillment on `payment_status === 'paid'` and additionally handle `checkout.session.async_payment_succeeded` / `async_payment_failed`. (Note: `handleFounderSeatCheckoutCompleted` at :143 correctly checks `amount_total`; apply the same rigor here.)

- [ ] **[Firestore Rules — shared collections writable by any user]**: `/ai_context_cache/{hash}` (`firestore.rules:829`) and `/instrument_usage_stats/{instrumentId}` (`firestore.rules:734`) both allow `read, write: if isAuthenticated()` with no per-user scoping. Any authenticated user can overwrite another user's cached Vertex context (cache poisoning that then feeds AI responses) or clobber global instrument stats. If cross-session reuse is intentional, writes should be server-only (Admin SDK) or validated, not open client writes.

- [ ] **[Config — hardcoded Firebase key fallback]**: `packages/admin-dashboard/src/firebase.ts:16` hardcodes an `AIzaSy...` API key as the fallback when `VITE_FIREBASE_API_KEY` is unset (`?? 'AIzaSy...'`), and `scripts/verify-backend-apis.ts:12` does the same. Firebase API keys are identifiers, not secrets (policy §3.1), so this is not a credential leak — but the hardcoded fallback defeats the env-isolation requirement (policy §3.2.4): a misconfigured environment silently talks to the baked-in project instead of failing fast. Prefer failing when the env var is absent.

### Notes / Verified-OK (not issues)

- Electron `BrowserWindow` config is sound: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webviewTag: false`, and a hard production assertion on `webSecurity` (`packages/main/src/main.ts:156-175`).
- The `net:fetch-url` / `net:fetch-url-base64` IPC handlers guard against SSRF (`validateSafeUrlAsync`, `redirect: 'error'`, sender validation) with dedicated tests (`packages/main/src/handlers/network.ts`).
- The Stripe webhook has a correct signature check and an atomic transaction-based idempotency guard for the general path (`webhookHandler.ts:527`, :543).

---

## Cross-Reference

All 7 findings above are **also logged** to the canonical ledger at `.agent/test_ledger/OPEN_ISSUES.md` under the 2026-07-15 session header. Both documents are authoritative; when fixing, reference whichever is most convenient. Cross-links make them equally discoverable.

### Creative Suite / Agent gaps (2026-07-16) — canonical-ledger only

These are detailed build specs; they live in `.agent/test_ledger/OPEN_ISSUES.md` (2026-07-16 session), not mirrored in full here:

- **ISSUE-1054** — Creative Director has no tool to retrieve stored assets from Firebase; confabulates "checking the database." Full build spec (reuse existing `StorageTools`, render thumbnails, register on the agent, prompt honesty fix).
- **ISSUE-1055** — Uploaded photo has no confirmed/discoverable destination; upload handler ignores the persistence-success boolean and navigates away, so failed saves look successful.
- **ISSUE-1056** — Adjacent/systemic: audit retrieval-tool coverage across all 20+ department agents (same shape as 1054).
- **ISSUE-1057** — Architecture: formalize per-agent scoped data access + cross-domain requests via the existing `consult_specialist` (A2A) channel.
