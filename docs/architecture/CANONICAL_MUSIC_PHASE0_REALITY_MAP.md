# Phase 0 Repository Reality Map — Canonical Music Foundation

Branch: `feat/canonical-music-foundation`
Repository: `indii-music-founder/indii-music-founder`
Baseline: `main`
Status: additive audit/foundation work only; no production feature enablement.

## Governing rule

This work follows the approved DDEX / canonical music / Connected Intelligence roadmap. Existing systems are extended where possible. No parallel replacement system should be introduced without evidence that the existing implementation cannot safely evolve.

## Confirmed systems to KEEP and EXTEND

### DDEX / publishing
- `packages/shared/src/distribution/ddexBuilder.ts`
- `packages/shared/src/distribution/types/*`
- `packages/renderer/src/modules/publishing/hooks/useDDEXRelease.ts`

The release flow already preserves useful production behavior: content-addressed master audio, measured technical metadata, release asset validation, immutable cover handling, retry-safe packaging state, and DDEX-oriented release records.

Current DDEX serialization is directly coupled to ERN 4.3 shapes and a fixed ERN namespace. This should be adapted behind a version-aware standards layer rather than discarded.

### Onboarding / artist context
- `packages/renderer/src/modules/onboarding/*`
- existing career profile, goals, adaptive multiple choice, uploaded-context handling, and agent seating

The existing onboarding system already supports adaptive conversation and can become the source of durable artist/business context. Do not create a second onboarding flow.

### Registration / collection
- `packages/renderer/src/modules/registration/*`

Existing adapters include ASCAP, BMI, SESAC, The MLC, SoundExchange, and Library of Congress flows. Registration already has persistent status, manual-fallback semantics, desktop requirements, and an autonomous rail designed to pre-fill known information and ask only for gaps.

### Computer-control permission
- `packages/shared/src/schemas/artistOperatingProfile.ts`

The Artist Operating Profile already provides fail-closed opt-in for autonomous computer control and destructive tools. Reuse this as the permission boundary for future execution workflows.

### Founder entitlements
- `packages/renderer/src/hooks/useIsFounderTier.ts`

Founder detection exists today. It should later be replaced/extended by a capability/entitlement matrix rather than used as the long-term domain model.

## Confirmed areas to ADAPT

### Existing GoldenMetadata
`packages/renderer/src/services/metadata/types.ts` currently stores ISRC/ISWC and rights-oriented fields directly on a track/release metadata object.

This is compatible with current UI and delivery behavior but is not sufficient as the permanent canonical identity layer.

Migration approach:
1. keep existing metadata operational;
2. introduce shared canonical contracts;
3. map legacy/current records into canonical entities;
4. move consumers incrementally;
5. preserve legacy fields until downstream consumers no longer depend on them.

### DDEX allowed values
Current shared DDEX types contain hard-coded unions for use types, contributor roles, release types, etc.

These remain valid compatibility types for the current ERN implementation, but future DDEX work should source version-sensitive values from a standards registry, including AVS 012 and deprecation/replacement metadata.

## MISSING foundation confirmed by audit

- shared canonical music entity contracts;
- external identifier objects separate from internal identity;
- common provenance/evidence model;
- first-class relationship assertions;
- version-aware DDEX standards registry;
- ECM-C / ECM-MW / ECM-ISRC contracts;
- canonical compatibility mappers;
- event-driven Connected Intelligence layer.

## First implementation checkpoint

Phase 1 begins additively in `@indii/shared` with:
- canonical entity schemas;
- identifier schemas;
- provenance/evidence schemas;
- tests demonstrating that external identifiers do not define canonical identity.

No Firestore migration, UI change, entitlement change, or production enablement belongs in this checkpoint.

## Production safety

This branch must remain non-production until:
- shared typecheck/tests pass;
- compatibility strategy is validated;
- no existing release/registration flow changes behavior;
- later relationship/DDEX contracts have regression fixtures;
- feature gates exist before any user-facing integration.
