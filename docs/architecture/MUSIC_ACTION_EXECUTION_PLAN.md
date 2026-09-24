# Music Action Execution Plan

## Purpose

Phase 10 adds a deterministic, provider-neutral plan contract for selecting an
execution route for an already-evaluated canonical music action. It does not
create a second executor or dispatch work itself.

## Route priority

`planMusicActionExecution` selects the first verified available route in this
order: official API, OAuth/API workflow, browser automation, desktop control,
then guided manual. Browser and desktop routes are never selected while a human
checkpoint is outstanding. Both browser and desktop control additionally
require explicit, current Artist Operating Profile authorization. Missing
capability information fails closed to guided manual.

API routes may prepare a request while a checkpoint is outstanding, but the
plan remains `AWAITING_HUMAN`; a caller must not treat that plan as authority to
submit, sign, pay, attest, or confirm ownership.

## Boundaries and integration status

- The input is a canonical subject entity ID, not an ISRC, ISWC, UPC, platform
  ID, or other external identifier.
- Route capabilities are supplied by a trusted caller after it verifies the
  actual user/session and connected provider. The shared planner itself grants
  no capability or permission.
- AI judgments may help interpret ambiguous action intent upstream, but must
  not choose or override the route, AOP permissions, legal/rights truth, or
  human checkpoints.
- This contract is not yet wired into Registration Center. Its current catalog
  adapter exposes legacy track IDs rather than canonical music entity IDs; a
  later adapter must resolve canonical identity and consume Connected
  Intelligence actions before integration is safe.
- No browser, desktop, API, or OAuth automation is enabled by this change.
  Existing executors remain the only execution systems. Rollback is to remove
  this unused shared contract; no data migration or persisted state is added.
