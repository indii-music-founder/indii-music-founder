# ISSUE-1601 — Rights-session broker resource lifetime

## Scope and observed source behavior

The October 28 finding was recorded in the original workspace's unpublished V3
ledger. Inspection of baseline `24a108f0b` confirmed that the broker only removed
its pair and two listeners after an explicit worker `ended` message. Disconnects
could retain them. Worker navigation packets were forwarded without validation.

The proposed URL/title schema in that finding does not match the implementation:
the worker sends `navigationGeneration` and `viewportVersion`, and the renderer
uses those counters to fence input. This change validates the actual contract.

## Implementation

- Local subscriptions have an absolute expiry and an idempotent cleanup scope.
  Removing a pair precedes socket closure; all cleanup callbacks run even when
  another callback fails. Cleanup failures are logged.
- The last socket disconnect releases both listeners. Disconnecting one socket
  preserves its peer; a stale close event cannot detach a replacement socket.
- Terminal/deleted session snapshots, subscription errors, lost leadership and
  process shutdown release resources. Partially installed listeners are cleaned
  up if setup fails; connections closed during authorization cannot create pairs.
- `termination_pending` retains the worker transport long enough to receive a
  shutdown acknowledgment, subject to the existing absolute session deadline.
  A reconnecting worker is protected from an older disconnect transaction.
- A strict shared schema accepts only the actual navigation type and bounded
  integer fence counters. Extra properties and malformed counters are rejected.

No data model, Firestore rules, entitlement, filing-completion criterion, or
capacity-release proof was changed. Local cleanup does not assert that a filing
was submitted or that a remote browser stopped. Expiry may close the transport
before a worker receipt arrives; existing execution reconciliation remains
responsible for authoritative shutdown/capacity evidence.

## Verification and outstanding acceptance

Focused local verification:

```bash
npx vitest run packages/rights-session-broker/src/sessionResources.test.ts packages/shared/src/rights/browserNavigation.test.ts packages/shared/src/rights/sessionLifecycle.test.ts --maxWorkers=2
npm run typecheck -w @indii/rights-session-broker
```

The 21 focused assertions exercise literal local resource bookkeeping, protocol
validation, and existing lifecycle policy. They do not mock a database, account,
external service response, or authenticated customer journey. The broker test
project is included in the root Vitest workspace and runs in CI.

Before production acceptance, deploy only with explicit authority, then use a
genuine hosted session to verify one-sided reconnect, both-sided disconnect,
timeout, shutdown acknowledgment, and retained external-outcome/capacity proof.
Check that listeners/pairs return to baseline without losing a replacement
worker. Record the actual environment, account provenance, displayed plan,
deployed revision and observed results. None of those live checks occurred in
this implementation; this document is not closure evidence.
