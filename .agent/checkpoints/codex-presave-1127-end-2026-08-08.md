# ISSUE-1127 Durable Pre-Save Closeout — 2026-08-08

## Objective

Replace the fabricated pre-save share surface with a persisted, hosted, consent-aware campaign and fan-lead path. Firebase billing is an acknowledged external deployment blocker and is excluded from code-completion acceptance by founder direction.

## Delivered state

- The builder exposes no URL, QR, Copy, or Share control until `createPreSaveCampaign` returns a persisted Firestore campaign ID.
- The canonical public URL is `https://app.indii.music/presave/{campaignId}` and bypasses both authentication and mobile Controller routing.
- The public callable returns a campaign projection without owner identity, lead count, or fan records.
- Fan contact fields and explicit consent are validated before a transactional `leads/{leadId}` write.
- Repeated lead IDs overwrite deterministically and increment `leadCount` only once.
- A deterministic `presave` conversion-outbox write is awaited before DSP redirect success.
- Firestore Rules permit owner reads and deny every client campaign/lead mutation.
- App Check protects all callables; Arcjet protects anonymous public reads and submissions, with submissions failing closed.

## Verification evidence

- Focused Vitest: 6 files, 42 tests passed.
- Firestore emulator: 1 file, 190 tests passed.
- Repository TypeScript: passed across shared, main, renderer, Firebase, SDK, admin, and Firebase tests.
- Repository lint and security guards: 0 errors; the established unrelated warning baseline remains.
- Repository Vitest: exit 0.
- Studio production build: exit 0.
- Firebase build: exit 0.
- Dependency drift: clean.
- Hidden-bug detector: baseline 126, final 126.
- Flowchart validator: all diagrams passed after repairing a pre-existing invalid Evolas diagram encountered by the validator.

## Workspace ownership

The admin-dashboard DDEXTracker, GoogleHub, and NexusMonitor source/test changes predated this objective and remain uncommitted and untouched. They must not be included in the ISSUE-1127 commit.
