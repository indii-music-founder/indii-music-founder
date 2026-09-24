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

API routes may prepare a request while a domain-specific checkpoint is
outstanding, but the plan remains `AWAITING_HUMAN`; a caller must not treat
that plan as authority to submit, sign, pay, attest, or confirm ownership.
Every plan includes `executionAuthorized: false`. Phase 9 advisory actions are
consumed through `planConnectedIntelligenceAction`, which validates the
upstream schema and canonical subject, preserves the action ID, forces a
`HUMAN_REVIEW` checkpoint, and selects `GUIDED_MANUAL` regardless of available
API, OAuth, browser, or desktop capabilities. The complete source action is
retained in the plan for human-facing consumers, and Phase 9's 300-character
action-ID bound is preserved end-to-end.

## Boundaries and integration status

- The input is a canonical subject entity ID, not an ISRC, ISWC, UPC, platform
  ID, or other external identifier.
- Route capabilities are supplied by a trusted caller after it verifies the
  actual user/session and connected provider. The shared planner itself grants
  no capability or permission.
- AI judgments may help interpret ambiguous action intent upstream, but must
  not choose or override the route, AOP permissions, legal/rights truth, or
  human checkpoints.
- The Phase 9 action contract is now consumed by the shared planner adapter.
  It is not yet wired into Registration Center: its current catalog adapter
  exposes legacy track IDs rather than canonical music entity IDs. Do not
  infer canonical identity from those IDs; integration waits for an explicit,
  validated mapping and an independently authorized human action.
- The existing `BrowserAgentService.executeTask` boundary now checks the
  authenticated user's AOP permission centrally, covering Registration Center
  and music-portal callers. This guard does not enable the currently
  unconfigured browser executor.
- No browser, desktop, API, or OAuth automation is enabled by this change.
  Existing executors remain the only execution systems. Rollback is to remove
  this unused shared contract; no data migration or persisted state is added.
