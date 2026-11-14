# Agent loop checkpoint ownership — 2026-11-13

## Problem and resulting behavior

A browser-local running set cannot coordinate two tabs/devices. Resume also trusted
its local execution cache, and all durable checkpoint saves were unconditional.
Two clients could therefore both proceed from an older READY checkpoint.

Every checkpoint save now uses a Firestore transaction comparing the exact
expected `checkpointRevision`. Creation requires a missing document and starts at
revision 1. Existing legacy documents without a revision can advance once from 0.
A deleted document cannot be silently recreated by a stale writer. Transaction
retries keep the original expected revision rather than claiming newer state.

Resume requires a server read before deciding what to do (no offline cache fallback), validates the embedded
execution identity and checkpoint shape, and refuses a claimed/ambiguous dispatch.
Each action remains behind a required checkpoint save; the loser of a concurrent
claim never dispatches. Recorded action output remains eligible for evaluation
without repeating the action. Unknown outcomes still require reconciliation.

Database rules require the next consecutive safe-integer revision and the document
identity, in addition to the existing authenticated owner check. This rejects stale
unconditional writes from an older client as well as races between new clients.

## Compatibility and release

The change uses the existing STANDARD/native `(default)` database in
`indii-music-founder` (edition/access confirmed read-only). No production documents
were changed. The rule and client changes must be released together: after the new
rules are active, an older client cannot write an unversioned or stale checkpoint;
it stops before action dispatch rather than bypassing ownership. An interrupted
old DISPATCHING checkpoint still requires reconciliation. Do not reset its phase
to READY merely to make it resumable.

The scheduler's existing incomplete IDLE records are not made runnable by this
change. Scheduled-loop intake still needs valid definition, budget and action
checkpoint initialization, and remains a separate requirement.

## Verification

- 266 structural tests across 22 service/orchestration/governance files passed.
  Includes independent service instances racing for a revision, stale-cache
  resume, malformed checkpoint identities/phases, deleted records, legacy claims
  and transaction retries.
- All 370 tests in the Firestore security rules suite passed against an isolated
  STANDARD Firestore emulator on port 8189 using a demo project. Concurrent SDK
  transactions prove one claim succeeds and one is rejected; owner/cross-user,
  initial revision, skipped revision, stale write and legacy transitions are covered.
- These are structural/emulator results, not genuine-user production acceptance.
- Full repository typechecking, changed-file lint, test-quality scanning and diff checks passed. Remote status is recorded in the delivery report.

## Rules audit

```json
{
  "score": 4,
  "summary": "The scoped revision/identity and owner guards pass the emulator suite. Full execution payload validation is still outside this change.",
  "findings": [{
    "check": "Storage abuse and payload shape",
    "severity": "minor",
    "issue": "Existing owner-writable loop history, definition and checkpoint payloads do not yet have comprehensive server-side shape/size limits.",
    "recommendation": "Add bounded execution schema and transition validation in the broader durable-execution work. Ownership derives from authenticated UID and path, never a submitted owner field."
  }]
}
```

## Remaining recovery requirements

This is not an exactly-once external-effect claim. Adapter-level idempotency keys,
durable side-effect receipts, reconciliation of ambiguous outcomes, mandatory
execution audit evidence, and acceptance through the deployed genuine-user path
remain open in the original primitives review. A bounded Jev check selected this
partial-completion interpretation; it did not certify source code or runtime behavior.
