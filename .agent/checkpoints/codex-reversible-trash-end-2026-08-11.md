# Codex Checkpoint — Reversible Trash System Closeout

**Date:** 2026-08-11

**Branch:** `main`

**Objective:** Give AI agents a user-directed, reversible place for files,
documents, images, and supported app records while reserving permanent deletion
for a freshly reauthenticated human user.

## Ledger selection

`.agent/artifacts/task.md` describes unrelated July issue-backlog work and is
stale for this objective. Completion is measured against the user's Trash
request, the reviewed Antigravity walkthrough, the Trash implementation, and
the acceptance evidence below.

## Delivery history

- `93788828b` — introduced shared Trash contracts, adapters, agent tools,
  Electron quarantine IPC, Cloud Functions, UI, rules, indexes, and tests. This
  commit also contains unrelated Vertex maintenance from the originating agent.
- `0fdc69f91` — aligned the FileSystemService regression test with TrashService.
- `0f6e92e60` — enforced reversible agent deletion boundaries, ownership,
  manifest atomicity and compensation, rule denial, purge validation, and
  focused security coverage.
- Current closeout change — moves permanent-purge callables behind TrashService,
  validates requests and backend receipts, removes Trash UI lint debt, and adds
  the definitive architecture flowchart. Git history supplies its final SHA.

## Acceptance matrix

| Requirement | Evidence | Status |
|---|---|---|
| Agents can put supported items in Trash | `TrashTools.ts` exposes executable `move_to_trash`; `TrashService.ts` routes validated targets to five resource adapters. | PASS |
| Agent moves are reversible and attributable | Manifests record user/agent provenance and restore data; `restore_from_trash` is executable; local manifest failure compensates by restoring the payload. | PASS |
| Agents cannot permanently delete | `AgentTrashSecurity.test.ts` rejects purge, empty-trash, hard-delete, and permanent-delete declarations, risk entries, and executors. | PASS |
| Cloud purge is human-controlled | Files Dashboard requires typed `DELETE`, supported-provider reauthentication, and a refreshed ID token; callables require App Check, fresh auth time, a single-use exact-set intent, ownership, Trash state, legal-hold, and path checks. | PASS |
| Local purge is human-controlled | Electron main process performs approved-root and symlink checks and always presents a native confirmation dialog before removing `.indii-trash/{trashId}`. | PASS |
| Browser cannot bypass the backend | Firestore denies client deletion of Trash manifests and purge intents; Storage denies client write/delete access to the Trash quarantine and general user-storage deletion. | PASS |
| Purge transport is validated and decoupled from UI | Shared Zod schemas validate canonical unique IDs and both callable response shapes; `FileDashboard.tsx` no longer imports Firebase Functions. | PASS |
| Architecture is documented | `docs/flowcharts/reversible-trash-system.md` maps agent, UI, service, local IPC, Cloud Function, data, and policy boundaries. | PASS |
| Hunter scan is clean for confirmed findings | Raw organization-access debug output now uses the governed logger and the E2E user has a narrow, null-checked contract; security, secret, placeholder, API-integrity, listener, timing, finance, locale, and identity scans found no other confirmed new defect. | PASS |

## Closing evidence captured before the full gauntlet

```text
$ npm run check:dep-drift
✅ Dependency version drift check: clean — all declared ranges match installed versions.

$ npx vitest run <five Trash-focused suites>
Test Files  5 passed (5)
Tests       26 passed (26)

$ npx eslint <five closeout files>
exit 0; no output

$ npm run lint
0 errors; 153 standing warnings outside the bounded closeout files

$ npx vitest run packages/renderer/src/services/security/OrganizationAccessService.test.ts
Test Files  1 passed (1)
Tests       2 passed (2)

$ npx firebase emulators:exec <isolated Firestore and Storage ports> <rules suite>
Test Files  4 passed (4)
Tests       257 passed (257)

$ npm run build:studio
✓ built in 26.55s

$ node scripts/validate-flowcharts.js
Analyzing: reversible-trash-system.md...
   ✅ Sanity check passed.
✅ All flowcharts are fully compliant with indii visual quality standards.

$ npm run detect:bugs
RISK SCORE: 123
```

The reconstructed pre-Trash baseline at `0facb4e6b` was also 123. The initial
Trash UI raised it to 125 by importing Firebase Functions directly; the
closeout service-boundary refactor returned it to 123. No new detector category
was discovered, so neither `GENERATION_FAILURES.md` nor `ERROR_LEDGER.md`
requires a new pattern entry.

## Anti-hallucination audit

The required `MOCK`, `TODO`, and `stub` scan found only test doubles in the
Trash unit suite, unrelated merchandise-rule names, and the repository's
existing explicit E2E Firebase mock branch in `StorageService.ts`. No mock,
stub, or TODO is present in the Trash production path used as acceptance
evidence. Unit tests remain structural evidence; production behavior is not
claimed from mocked state.

## Final gate

Run the repository's complete `/ci-validate` gauntlet, commit this bounded
closeout on current `main`, push with `git push origin HEAD:main`, and require
the GitHub Actions run for that exact SHA to be green. The final task report,
not this pre-commit checkpoint, records the resulting SHA and run URL.
