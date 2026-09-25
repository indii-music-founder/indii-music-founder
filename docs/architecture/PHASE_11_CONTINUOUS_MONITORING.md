# Phase 11 — Continuous Monitoring event and delivery contract

Phase 11 extends the canonical `music-domain-event.v1` vocabulary with change
observations for deliveries, registrations, claims, reported usage, platform
connections, catalog state, and detected identity conflicts. The subject and
related entity references remain indii canonical IDs; external IDs and source
record keys belong in evidence or bounded event context.

## Truth and privacy boundaries

- An event is an observation, not proof. Its required provenance and evidence
  must retain the source's actual state. Detection never becomes a human
  confirmation, rights clearance, or identity merge by being queued or
  delivered.
- `occurredAt` and `recordedAt` remain distinct. Delayed monitoring updates do
  not rewrite source chronology.
- Producers should include only the minimum redacted state needed to route or
  explain a change. Do not place provider response bodies, credentials,
  customer documents, or unnecessary personal data in event details.
- Consumers must treat event payloads as immutable for a given internal
  `eventId`. Reusing an event ID for a different payload is a producer error
  and a persistence adapter must reject the conflict rather than overwrite.

## Delivery semantics

`music-event-delivery.v1` binds one immutable music event to one stable internal
consumer name. The consumer-specific `deliveryId` is also the idempotency key
and remains unchanged through all retries. The pure transition function
enforces:

1. `PENDING` can be claimed once into a time-bounded `IN_FLIGHT` lease.
2. A transient failure schedules an explicit future retry while attempts
   remain; retry timing/backoff is supplied by the server-side scheduler, not
   guessed by this shared contract.
3. Permanent failures, exhausted attempts, and exhausted expired leases enter
   `DEAD_LETTER` with a bounded reason code, never a raw provider error body.
4. A completed acknowledgement is idempotent for its lease. Expired or
   superseded leases cannot acknowledge or fail the current delivery. Each
   attempt uses a fresh server-generated lease ID; IDs are retained in the
   bounded attempt history so a stale token cannot be reused later.
5. Lease recovery is **at-least-once**, not exactly-once. Consumers must
   deduplicate side effects using `idempotencyKey`, and must not perform
   non-idempotent or authority-bearing work merely because delivery succeeded.

The event delivery contract does not replace the existing analytics
`EventBusService` or the existing signed webhook dispatcher. A later adapter
must reuse the appropriate server-side authentication, authorization, secret
handling, retry, retention, replay, and audit controls for its integration.

Phase 9 re-evaluation accepts the monitored event types only when exactly one
canonical release is identified across the event subject and related-entity
list. Events with no release reference or multiple release references remain
`NOT_EVALUATED`; consumers do not guess which release changed. Resulting Phase
9 advisories remain human-review-only when converted to Phase 10 plans.

## Deliberate non-scope

This change adds portable schemas and a deterministic delivery state machine
only. It does not add Firestore writes/rules, polling, provider webhooks,
scheduling, a dispatcher, automatic Connected Intelligence execution, or a
production feature flag. Phase 9 remains fail-closed for event types without a
specific readiness rule; Phase 10 remains a non-dispatching plan with human
checkpoints. Phase 12 can build claims/conflict records on this stable payload
and per-consumer delivery contract without creating a competing event format.
