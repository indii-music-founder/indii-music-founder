# Phase 13 — Advanced Catalog Intelligence

This first deterministic Phase 13 slice adds a read-only audit over an
explicitly supplied canonical catalog snapshot. It reports normalized active
identifier collisions, repeated active identifier rows on one entity, and
identifier/relationship references that fail to resolve inside a caller-declared
complete snapshot.

## Integrity boundaries

- `entityId` fields remain indii canonical IDs. ISRC, ISWC, UPC/EAN, platform,
  proprietary, and catalog values are never promoted to entity identity.
- Standard-number formatting normalization is limited to case and display
  separators for ISRC, ISWC, UPC, EAN, ICPN, IPI, and ISNI. Other identifier
  values remain exact unless a verified family-specific rule is added.
  Platform IDs, catalog numbers, and proprietary values remain exact and
  case-sensitive; namespace remains part of the comparison key.
- `HISTORICAL`, `DISPUTED`, and `UNKNOWN` statuses are not treated as active
  assignments. Mixed-status reuse is emitted only as a review finding because
  identifier records currently have no assignment validity interval. No
  reassignment or entity merge is suggested.
- Missing references are reported only when the caller declares a complete
  snapshot. Partial or unknown snapshots explicitly mark dangling-reference
  analysis as unassessed.
- Each report includes bounded provenance/evidence references and the source
  record IDs. Raw identifier values are not copied into findings.
- Findings are diagnostics. The evaluator never mutates canonical records,
  resolves contributor identities, asserts ownership, or applies import facts.

## Explicit remaining Phase 13 scope

The report names, but does not infer, missing registration requirements,
contributor identity inconsistencies, ownership gaps, disconnected
videos/assets, missing collection paths, or multi-work claim patterns. Those
checks need caller-declared registration, rights, territory/time, identity,
media-link, collection, and claim scope before absence or inconsistency can be
asserted safely. This module deliberately reuses the existing canonical entity,
identifier, relationship, and provenance contracts rather than creating a
parallel catalog model.

The contract is pure and suitable for future read-only surfaces. It adds no
Firestore persistence, background scan, user-facing alert, rights action, or
production feature enablement.
