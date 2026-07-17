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

- [ ] **[Secrets / Git Hygiene] — PARTIAL**: The OAuth client JSON is removed from the current tree and ignored, but its live-shaped secret remains reachable in git history. Revoke/rotate it in GCP and coordinate a history purge. Full evidence is in canonical ledger SEC-001.

- [x] **[Stripe Webhook — Licensing Payout] — FIXED 2026-07-16**: Transfer idempotency, deterministic license/ledger IDs, atomic receipt writes, transfer lineage, and fail-closed event claiming are implemented and covered. See PAY-001 in the canonical ledger.

### High

- [x] **[Firestore Rules — licenses read leak] — FIXED**: Reads are owner-scoped; live-emulator tests deny anonymous and cross-user reads.

- [x] **[Firestore Rules — licenses update/delete via guest branch] — FIXED**: No guest write branch remains; ownership is immutable and emulator-tested.

### Medium

- [x] **[Stripe Webhook — payment_status not verified] — FIXED**: Paid-status gates and asynchronous success/failure routing are present.

- [x] **[Firestore Rules — shared collections writable by any user] — FIXED 2026-07-16**: Client writes are denied; validated authenticated callables write through Admin SDK, and cache reads are owner-scoped. All 133 emulator rule cases pass.

- [x] **[Config — hardcoded Firebase key fallback] — FIXED**: Both paths now require environment-provided Firebase identifiers and fail fast.

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
