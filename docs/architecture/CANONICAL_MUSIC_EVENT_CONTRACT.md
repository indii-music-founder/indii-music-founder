# Canonical Music Domain Event Contract

Phase 8 introduces `music-domain-event.v1` as a portable, versioned event
envelope for connecting observations and lifecycle changes to indii's internal
canonical music entities.

## Boundaries

- `eventId` is indii's event identity. ISRC, ISWC, UPC/EAN, platform IDs, and
  other external identifiers remain values or evidence; they never replace a
  canonical entity reference.
- `subject` and `relatedEntities` reference canonical entity IDs and kinds.
- `claim.received` events use a `rights_claim` entity as their subject, while
  `registration.confirmed` events use a `registration` entity as their
  subject; the affected work, recording, or party is referenced separately.
- `occurredAt` records when the source says the event happened;
  `recordedAt` records when indii observed it. Late-arriving events therefore
  do not rewrite their occurrence time.
- `provenance` is mandatory. An event with `DETECTED` or `INFERRED` provenance
  does not become a verified business fact merely because it is represented by
  this schema. Rights, ownership, registration, and legal decisions continue
  to require their existing evidence and human checkpoints.
- `details` is bounded, shallow context for routing and display, not a place to
  smuggle unproven authoritative facts.
- Conversion/marketing events retain their existing separate
  `conversion-event.v1` contract.

## Initial event vocabulary

The registry covers recording upload, release planning/live status, video
readiness for TikTok and YouTube, planned performances, detected satellite
plays, received claims, confirmed registrations, and catalog migration start
and completion. A producer may emit only an event supported by evidence and
must preserve the source's confidence and provenance.

## Deliberate non-scope

This change adds no persistence, event dispatcher, automatic projection,
consumer, scheduler, or production feature flag. Those integrations must be
introduced separately with idempotency, authorization, retention, replay,
failure handling, and rollback designed for their actual storage and workflow
boundaries. The existing analytics `EventBusService` is not replaced.
