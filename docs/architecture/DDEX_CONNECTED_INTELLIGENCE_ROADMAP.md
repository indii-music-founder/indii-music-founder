# DDEX + Canonical Music + Connected Intelligence Roadmap

This document is the governing implementation sequence for the canonical music architecture work.

## Non-negotiable rules

1. Extend existing working systems before creating replacements.
2. indii owns the canonical domain model; DDEX and external platforms are adapters.
3. External identifiers (ISRC, ISWC, UPC/EAN, IPI, ISNI, DPID, GRID, platform IDs) never define canonical database identity.
4. Detected/inferred information never silently becomes authoritative rights or registration truth.
5. Preserve provenance and evidence for material business facts.
6. Prefer deterministic code for validation, rights rules, DDEX serialization, entitlements, workflow state, and security.
7. AI may interpret/explain/classify ambiguity but cannot invent ownership, clearance, or legal attestations.
8. Reuse existing onboarding, registration, distribution, creative/video, remote execution, and agent systems.
9. Browser/computer execution remains fail-closed and uses existing Artist Operating Profile permission gates.
10. No new architecture is enabled broadly in production before regression, authorization, migration, and failure-path gates pass.
11. Every phase must make another part of indii smarter; isolated feature completion is not enough.
12. Any required roadmap deviation must be documented before implementation rather than silently introduced.

## Dependency chain

```
Canonical identity
  -> Relationships + DDEX
  -> Artist context
  -> Song intake
  -> Existing catalog
  -> Rights intelligence
  -> Video/UGC identity
  -> Events
  -> Connected Intelligence
  -> Execution
  -> Monitoring
  -> Claims/conflicts
  -> Catalog intelligence
  -> Prediction
  -> Cross-department intelligence
  -> Advanced interoperability
  -> AI-use rights
  -> Local/off-grid intelligence
  -> Full Founding Owner system
```

## Phase 0 — Repository reality map

Audit current domain/storage shapes, DDEX, onboarding, registration, distribution, creative/video, agents, execution, security, and entitlements.

Output: KEEP / EXTEND / ADAPT / DEPRECATE LATER / MISSING map.

No production enablement.

## Phase 1 — Canonical music identity

Introduce shared canonical contracts for:
- Person
- Artist
- Organization
- MusicalWork
- SoundRecording
- VideoResource
- Release
- Asset
- external Identifier
- Provenance
- Evidence

Existing Firestore and renderer shapes remain operational through compatibility mapping.

## Phase 2 — Relationships + DDEX foundation

Add first-class relationship assertions and version-aware DDEX infrastructure.

Implement:
- DDEX standards registry
- AVS 012
- ECM-C
- ECM-MW
- ECM-ISRC
- adapter boundaries around existing ERN flow

Do not use DDEX XML/JSON structures as the canonical database schema.

## Phase 3 — Artist context intelligence

Extend existing onboarding, not replace it.

Persist durable context:
- roles
- experience/career context
- goals
- territory/business structure
- PRO/CMO and collection relationships
- distributor relationships
- existing catalog status

Onboarding informs future workflows but does not force catalog migration.

## Phase 4 — Intelligent song intake

A finished-song upload triggers:
- technical analysis
- hashes/fingerprints
- embedded metadata
- identifier discovery
- existing catalog comparison
- duplicate detection
- progressive questions only for unknown/authoritative facts
- canonical entity updates with provenance

## Phase 5 — Existing catalog intelligence

Support import/recovery/cleanup/migration/re-release/monitoring of previously released music.

Never interpret "take it back" as one hard-coded operation.

## Phase 6 — Rights intelligence

Model:
- master ownership
- composition ownership
- contributors
- publishing
- territories
- samples
- covers/interpolations
- licenses
- agreements
- evidence

Add a provider-neutral AudioMatchEngine.

Detection is not clearance.

## Phase 7 — Video + UGC identity

Connect recordings to:
- official videos
- lyric/performance/live videos
- visualizers
- source masters
- TikTok/Reels/Shorts/Stories/teasers

Preserve explicit relationship semantics such as full recording, excerpt, alternate mix, live recording, instrumental, stem, reference-only, or no music embedded.

## Phase 8 — Event system

Create entity-referenced events such as:
- recording.uploaded
- release.planned
- release.live
- video.ready_for_tiktok
- video.ready_for_youtube
- performance.planned
- satellite_play.detected
- claim.received
- registration.confirmed
- catalog.migration.started/completed

## Phase 9 — Connected Intelligence v1

Evaluate:
Event + Artist Context + Music Identity + Relationships + Rights + Registrations + Territory + Platform.

Start with a small set of deterministic, high-confidence rules.

The engine must surface both missing actions and "already complete / no action required" results.

## Phase 10 — Execution engine

Use one execution priority:
1. official API
2. OAuth/API workflow
3. browser automation
4. desktop/computer control
5. guided manual fallback

Reuse existing Registration Center first.

Stop at human checkpoints for MFA, legal attestations, signatures, payments, binding choices, ownership confirmations, and terms acceptance.

## Phase 11 — Continuous monitoring

Feed external changes back into:
Event -> Connected Intelligence -> Action -> Execution -> Verified canonical knowledge.

Monitor delivery, registrations, claims, usage, catalog state, platform connections, and identity conflicts.

## Phase 12 — Claims + conflict intelligence

Create platform-neutral claims/conflict records and a unified Claims Inbox.

Claims are assertions/events, not automatic proof of ownership.

Use existing evidence, hashes, registrations, licenses, splits, and delivery history to prepare response workflows.

## Phase 13 — Advanced catalog intelligence

Analyze whole catalogs for:
- duplicate identifiers
- missing registrations
- inconsistent contributor identities
- ownership gaps
- disconnected videos/assets
- missing collection paths
- multi-work claim patterns

## Phase 14 — Workflow prediction

Use the artist's own verified historical behavior to suggest likely next workflows.

Prediction may suggest; it may not convert guesses into authoritative business facts.

## Phase 15 — Cross-department intelligence

One business event may update/re-evaluate Distribution, Publishing, Rights, Finance, Marketing, Analytics, Creative, and Video.

Users manage objectives rather than departmental silos.

## Phase 16 — Advanced DDEX / interoperability

Add later DDEX standards and ECM parts as adapters over the mature canonical model, including future Part 4 only once its published specification is available.

## Phase 17 — AI-use rights

Support rights/permissions for generative and non-generative AI training uses as first-class rights/use data rather than platform-specific flags.

## Phase 18 — Local/off-grid intelligence

Progressively move suitable analysis, fingerprinting, metadata extraction, document analysis, local reasoning, video analysis, and workflow execution onto local/open components behind provider-neutral interfaces.

## Phase 19 — Full Founding Owner system

Founding Owner exposes the complete production-ready capability set. Lower tiers alter capacity, automation depth, included usage, and advanced workflow access without creating weaker canonical truth.

## Gate applied to every phase

A phase is not complete unless:
- architecture contracts are respected;
- authoritative vs inferred truth remains distinguishable;
- tests pass;
- security boundaries pass;
- legacy compatibility is preserved;
- relevant events/state updates are connected downstream;
- rollback/feature-gate behavior exists where required;
- documentation is current.

## Current checkpoint

Active branch: `feat/canonical-music-foundation`

Current work is limited to Phase 0 and Phase 1 identity contracts. Phase 2 must not begin until the Phase 1 checkpoint is validated.
