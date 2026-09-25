# Phase 14 — Workflow prediction

## Delivery unit

The shared `predictNextWorkflows` evaluator produces advisory next-workflow
suggestions from the signed-in user's own persisted `WorkflowExecution`
records, scoped to a valid canonical artist ID. New executions carry that
optional artist context from the existing profile/ArtistContext into the
existing workflow record. `WorkflowStateService.getNextWorkflowPrediction` reads through the
existing user-scoped workflow collection; the existing sidebar's
`NextBestActionCard` displays the history-based suggestion separately from
Jev's current-context recommendation and only navigates to the Workflow
module when the user chooses “Review in Workflows.”

## Evidence and safeguards

- The signed-in user's scoped query and matching canonical `artistEntityId`
  are both required. Legacy/unscoped workflow records remain readable but
  cannot ground artist predictions; there is no backfill or guessed mapping
  from account, project, or external ID to an artist.
- The latest record must be completed, and every step must be `STEP_COMPLETE`
  with a completion timestamp between execution creation and update. Failed,
  cancelled, skipped, awaiting-human, incomplete, and malformed histories do
  not become successful evidence.
- A transition is counted only between adjacent completed records when the
  prior record completed before the next was created. A suggested successor
  needs at least two independently observed transitions from the same prior
  workflow. Results are deterministic and bounded to five candidates and
  5,000 records; over-limit input fails closed.
- The report says it is current-artist-context-only and advisory; execution is always
  unauthorized. The evaluator does not inspect workflow prompts/results,
  mutate records, create events, infer legal/rights/business facts, or launch
  workflows.
- No training, cross-user aggregation, prediction persistence, backfill migration,
  feature flag, or change to existing workflow execution semantics is added.

This is history grounded in persisted application completion state, not
independent validation that a business outcome was achieved. Predictions are
patterns, not verified facts or instructions.

## Rollback

Remove the additive shared evaluator/export, the read-only method on the
existing `WorkflowStateService`, the optional sidebar rendering, focused
tests, and this document. Existing user-scoped workflow records and all
execution behavior remain unchanged.
