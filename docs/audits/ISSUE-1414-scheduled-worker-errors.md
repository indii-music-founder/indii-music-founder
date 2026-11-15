# ISSUE-1414 scheduled worker error survey

Source inspected on 2026-11-14, based on origin/main at the start of this branch.

The allegation that the remaining scheduled workers silently swallow top-level errors does not reproduce in the current source. This closes the source survey, without claiming deployed scheduler health or testing real provider outages.

| Previously unsurveyed worker | Current failure behavior |
| --- | --- |
| `packages/firebase/src/daemons/retention-daemon.ts` | Initial placements query logs and rethrows. Chunked updates and final commit are awaited without a suppressing outer catch. Per-placement HTTP exceptions are logged and recorded as verification failures; processing continues intentionally. |
| `packages/firebase/src/orchestration/pulseTick.ts` | Stale-plan query and batch commit are awaited without any catch. Rejections propagate to the scheduler. |
| `packages/firebase/src/functions/video/cleanupVideoSessions.ts` | Scheduled callback awaits `cleanupExpiredVideoSessionsAt`. Listing, claiming, object cleanup, dependency checks, and completion failures propagate. GCS cleanup suppresses only missing-object 404 responses; other failures rethrow. |
| `packages/firebase/src/functions/agent/agentLoopCron.ts` | Discovery errors propagate. Admission waits for every concurrent outcome and throws `AggregateError` on failed writes. Callback logs and rethrows. Existing-document collisions are intentionally idempotent successes. |
| `packages/firebase/src/functions/billing/enforceOperationCost.ts` | Scheduled callback awaits all three reconciliation functions through `Promise.all`. Initial queries are outside per-record catches, so query failures reject the invocation. Per-record reconciliation exceptions log warnings with operation ID; unchanged records remain eligible on later scheduled passes. Malformed records log errors and fail closed financially. |

No runtime changes are justified by this allegation. Other behavior, including retention policy, heartbeat semantics, financial reconciliation policy, and production observability, is outside this narrow survey.

Local structural verification: 68 existing tests passed across `agentLoopCron.test.ts` (13), `cleanupVideoSessions.test.ts` (5), and `enforceOperationCost.test.ts` (50). These suites do not supply live-service acceptance or fault-injection proof for every worker. Retention and pulse conclusions above come from inspected control flow, not test coverage.

Jev `jev-1.14.0` reviewed the complete retention, pulse, agent-loop, and video-cleanup sources. Its advisory score for silent top-level suppression was 0.12. Billing reconciliation was inspected directly. The judgment supports triage; the explicit await/catch boundaries are the evidence for disposition.

CI monitoring belongs to the team under the founder's current instruction. No remote CI outcome is asserted here.
