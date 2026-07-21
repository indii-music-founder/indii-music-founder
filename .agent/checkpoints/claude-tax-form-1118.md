# Checkpoint: Claude (Tax Form Collection — ISSUE-1118, Phase 1 + Phase 2)
**Date:** 2026-07-21
**Branch:** main
**Commit:** d23e4fe76 (superseded on main by concurrent c1dbee987/34a98f2a5 — unrelated video work, no conflict)

## Final State
- Real implementation. No mocks, no stubs in the critical path.
- Phase 1 (artist-side upload/email/delete) and Phase 2 (collaborator self-serve single-use token link) both shipped in one session per founder directive (public-release-grade required).
- 44 new tests, all passing against current `main` HEAD (re-verified post-close, not just at commit time).
- Code is on `main`, pushed. **Not yet deployed** — was blocked mid-session by an unrelated concurrent-agent function (`finalizeVideoSessionUpload`, invalid 3600s timeout on a 540s-max storage trigger); that agent fixed and pushed their own timeout correction (`c1dbee987`), and a fresh CI deploy run was in progress at session close.

## Completed Tasks
- Storage rules: `tax_docs/{userId}/{collaboratorId}/{fileName}` — owner-only, PDF/PNG/JPEG, ≤20MB, no update, deletable anytime (founder decision: retention is the taxpayer's duty, not the software's).
- Firestore rules: `users/{userId}/tax_collaborators/{id}` (owner-scoped) and `taxFormRequests/{token}` (server-only, `allow read, write: if false`).
- `TaxFormService.ts` — real Storage/Firestore CRUD, real Resend email, artist-controlled delete.
- `TaxFormCollection.tsx` — rewired to the real service, live Firestore subscription, honest status machine, no fake success anywhere.
- `AddTaxCollaboratorDialog.tsx` — new react-call multi-field dialog (house rule: no `window.prompt`).
- `requestTaxFormUpload.ts` (onCall) + `submitTaxForm.ts` (onRequest, unauthenticated, IP rate-limited) — single-use 64-hex token, 7-day expiry, atomic transaction consume.
- `TaxFormUploadPage.tsx` — public standalone page at `/tax-form-upload?token=...`.
- `App.tsx` — added `isTaxFormUploadPage`, a new pre-auth route branch (mirrors `publicLegalPage`) — **real architectural finding:** `STANDALONE_MODULES` does NOT bypass the login gate, only hides chrome for already-authenticated users. Documented in ERROR_LEDGER for future public-page builds.
- Ledger (`OPEN_ISSUES_V2.md`): ISSUE-1118 marked FIXED with full acceptance-criteria evidence; ISSUE-1119 (v1.64.6 GitHub Release promotion to Latest) also marked FIXED this session.
- `docs/flowcharts/tax-form-collection-phase1.md` — architecture doc covering both phases, updated with Phase 2's mermaid diagram and the auth-bypass finding.
- `ERROR_LEDGER.md` — two new entries: (1) `STANDALONE_MODULES` doesn't bypass login, (2) Firebase CLI's global `pkg`-compiled binary crashes on space-containing paths during function analysis — use `./node_modules/.bin/firebase` instead.

## Next Steps For Future Agents / Founder
1. **Verify the CI deploy went green** (run was in progress at close: `gh run list --repo indii-music-founder/indii-music-founder --branch main`). If it failed on something NEW (not the already-fixed video timeout), investigate that specific failure — don't assume it's Tax Form Collection's fault without checking the log.
2. **One live end-to-end pass recommended before real tax season:** add collaborator → upload → refresh → download → request → collaborator opens link → submits. No live browser verification was possible this session (no Firebase credentials configured in the sandbox's `.env`).
3. Phase 2's `requestTaxFormUpload` uses `enforceAppCheck: false` + `validateAppCheckV2` (soft, Electron-aware) rather than `sendEmail`'s hard `enforceAppCheck: true` — intentional, to avoid the known ISSUE-677 desktop App Check blocker family. If ISSUE-677 gets fully resolved, revisit whether this can be tightened.
4. If a future feature needs another public/unauthenticated page, follow the `isTaxFormUploadPage`/`publicLegalPage` pattern in `App.tsx` directly — do not reach for `STANDALONE_MODULES` alone.
