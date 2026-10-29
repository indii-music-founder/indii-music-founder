# ISSUE-1593: sample-clearance track ownership — 2026-10-29

Status: PARTIAL. This repairs the source-confirmed track-read authorization gap; other MCP findings remain open.

## Source authority and repair

The Admin SDK previously read `tracks/{trackId}` with no track-owner check. Optional release ownership did not authorize the selected track. The artist library actually uses `users/{uid}/tracks/{masterFingerprint}` (`TrackLibraryService.ts`), and Firestore rules restrict the legacy top-level track path by `userId`.

The tool now reads the caller-scoped path first. Its path confers ownership, but a conflicting explicit `userId` is rejected. If absent, the legacy record is accepted only with exact `userId === actorUid`; no admin flag, release ID, caller-supplied owner, or `ownerUid` alias bypasses that policy. Missing and foreign records produce identical `PERMISSION_DENIED` code/message and no declaration data. Track IDs reject path separators, empty/dot segments, NUL and excess length before database access. Optional release ownership is still checked independently; this does not assert release/track membership.

No collection, document model, security rule, index, grant or production database was changed. The Firebase Firestore skill was consulted for the existing query paths; no instance provisioning or data-model setup occurred.

## Validation and limits

The six old declaration tests imported the handler with fabricated decoded-token context and mocked Firestore records, including ownerless top-level tracks. Their declaration expectations have been retained in pure analysis tests, with the old missing-track case replaced by a fail-closed legacy-owner policy assertion. The invalid-ID test now checks the same pure parser used before lookup. Three additional tests cover exact legacy ownership, scoped-path ownership/conflicts, and non-array declarations. No new auth, service, database, account or entitlement mocks were added.

Nine pure tests pass. They prove validation, ownership decisions and metadata interpretation, not the actual Admin SDK routing, authenticated transport, or deployed two-user isolation. The declaration algorithm was extracted without changing its metadata-only/fingerprint-unavailable verdicts. No real account was created, plan observed, customer data read or provider operation performed for this repair.

Genuine authorized owner/foreign-track calls remain required before live acceptance. The other ISSUE-1593 findings (tool registry, Blender routing, campaign owner field, gateway principal/rate limit and production endpoint selection) are separate pending work. The issue remains partial.
