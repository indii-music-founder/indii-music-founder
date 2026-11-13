# Scheduled loop admission — 2026-11-13

## Reproduced defects

The old scheduler created IDLE executions at iteration 0 without a definition
snapshot, action checkpoint or saved token allowance, so the recovery service
could not safely resume them. It deduplicated by loop ID across tenants, preferred
a payload-selected owner over the user path, emitted ownerless root executions,
and generated a new random execution on each delivery. Discovery failures silently
fell back to root-only definitions. Eleven new regressions failed before repair.

## Resulting behavior

- Query all `SCHEDULE` definitions with the existing collection-group trigger index;
  the group query includes legacy root definitions. Discovery failure propagates.
- Validate source paths and owners. Scoped paths are authoritative; conflicting
  `userId` values are rejected. Root definitions require an explicit valid owner.
- Require a nonempty goal and criteria, valid iteration settings and the supported
  LLM evaluator. Unsupported deterministic evaluation is not queued.
- Create a stable execution ID from the full definition path and original scheduled
  occurrence. Native Firestore create-only writes preserve existing results/state
  on sequential or concurrent redelivery. Twenty writes run concurrently at most;
  a batch waits for all results before returning a partial failure for retry.
- Queue IDLE at iteration 1 with the exact definition snapshot, READY checkpoint,
  zero token spend, initial revision, source path and occurrence time. Canonical
  schema parsing preserves the scheduled provenance fields.
- Enable three bounded retries. Use UTC quarter-hour unix-cron syntax rather than
  the previous human-readable format: the latter omits the stable original-time
  header needed for retry deduplication. The SDK trigger metadata is tested.

Cloud Scheduler documents the original timestamp behavior and unix-cron
requirement in its [job schedule reference](https://docs.cloud.google.com/scheduler/docs/configuring/cron-job-schedules)
and [deduplication guidance](https://docs.cloud.google.com/scheduler/docs/configuring/deduplicate-job-requests).

## Verification

- 60 tests across seven Firebase agent-function files passed, including 13
  scheduler unit regressions for initialization, tenant collisions, spoofed owners,
  legacy roots, duplicate/concurrent delivery, malformed definitions, discovery and
  write failure, partial retry, and delayed original-time delivery.
- Three isolated STANDARD Firestore emulator tests passed with the actual Admin SDK:
  native create-only concurrency, independent tenants and owned root definitions,
  retained completed results, distinct subsequent occurrences, invalid owners and
  real trigger metadata. Synthetic emulator data is structural evidence only.
- Full repository typecheck passed. Firebase source/test checking was repeated after
  the final trigger change. Changed-file lint, function deployment guards, test-quality
  scan, diff checks and flowchart validation passed.
- The actual packed shared artifact exports/loads the canonical loop schema using
  installed dependencies. The deployment workflow includes that built tarball;
  workspace-only symlinks are not a deployment package.
- Production data was not written and the function was not deployed.

## Scope and remaining work

This repairs queue admission, not autonomous scheduled action execution. No active
queue-to-agent worker is asserted: the repository currently exposes recovery
service APIs without a production consumer that drains this queue. Existing
incomplete/random-ID rows are not retrospectively rewritten or deleted because
current definitions cannot prove their original intent.

Deploy with the checkpoint-ownership client/rule changes when enabling recovery.
Production index readiness, real scheduler invocation, queue draining, genuine-user
acceptance, external-effect receipts and reconciliation remain required before
claiming a working autonomous scheduled-loop capability. The full primitives goal
remains open.
