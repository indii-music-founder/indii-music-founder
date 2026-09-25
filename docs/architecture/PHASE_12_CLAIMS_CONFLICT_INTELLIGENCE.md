# Phase 12 — Claims and conflict intelligence

## First delivery unit: canonical claims inbox projection

`projectClaimsInbox` builds a deterministic, platform-neutral read model from
canonical `RightsClaim` records and Phase 11 `claim.received` /
`claim.status_changed` events. The existing `RightsIntelligenceService` exposes
that projection to rights workflows. `evaluateConnectedIntelligence` consumes
claim events with the canonical claim snapshot and emits the existing
human-gated `REVIEW_RIGHTS` advisory for Phase 10; a missing claim emits a
resolve-the-canonical-subject action. A withdrawn claim still requires human
closure review.

The projection preserves each claim, its provenance/evidence references, and
matching event envelopes. All claims remain review-required, including claims
marked withdrawn: a status field alone cannot close a response workflow.
Distinct identified claimants with
the same target and claim type are flagged only when their territory and date
scopes may overlap. Empty scope fields mean “possibly overlapping,” not a
confirmed scope match. The output calls these *potential* conflicts because
co-ownership can be legitimate. It never rewrites a claim, resolves ownership,
creates a rights grant, authorizes a response, or submits anything externally.

This unit is a pure read model. It does not add a second claims store, persist
events, poll platforms, or activate event delivery. Evidence is surfaced as
provided; presence, hashes, and event provenance are not legal verification.
The conflict list is bounded at 5,000 pairs and reports truncation explicitly;
per-claim potential-conflict presence is still evaluated for the bounded
maximum of 2,000 claims.

## Downstream consumer and validation

The existing `RightsIntelligenceService` can produce the inbox projection
from canonical claims/events, and Connected Intelligence routes received and
changed claim events into the Phase 10 guided-manual plan. Withdrawals remain
human-review-required until an explicit closure workflow exists. Tests cover
event-to-claim correlation, assertion and provenance preservation, explicit
disputes, missing evidence/claimants, withdrawals, disjoint scopes,
potential overlaps, duplicate identity rejection, and bounded conflict output.
A later persistence/UI/response
workflow must retain human checkpoints and may not treat this projection as
proof of ownership.

## Rollback

The delivery adds an exported schema/evaluator and a method on the existing
rights service; it changes no stored records, migrations, event dispatch,
provider connections, or production flags. Rollback consists of reverting the
additive export, projection, service method, tests, and this document. Existing
canonical `RightsClaim` records remain valid and unchanged.
