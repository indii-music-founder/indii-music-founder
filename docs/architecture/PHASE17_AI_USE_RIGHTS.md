# Phase 17 — AI-use rights remain scoped and un-authorized by default

The existing canonical `RightsGrant` contract now supports the explicit
`AI_USE` right with a structured scope: generative/non-generative modality,
purpose, covered material, named-model or canonical-provider scope, commercial
use, sublicensing, territories, dates, parties, provenance, and evidence. The
scope is part of the existing grant model and flows through the existing
`RightsIntelligenceService`; it is not a separate platform-flag registry.

The deterministic rights evaluator adds an independent AI-use review
projection. No record means `UNKNOWN`, not permission and not proof that use is
prohibited. Declared, inferred, imported, disputed, expired, or undocumented
assertions remain review-required. Documented evidence yields
`EVIDENCE_BACKED_REQUIRES_HUMAN_REVIEW`, never `AUTHORIZED` or `CLEARED`; every result
has `executionAuthorized: false`. AI-use gaps do not silently alter unrelated
release/Content ID readiness, and the AI-use scope does not change any claim,
grant, evidence, or provenance in place.

Backward compatibility: legacy rights grants need no `aiUseScope`; legacy
rights-intelligence reports parse with AI-use fields defaulted to `UNKNOWN`.
No database migration or production switch is included. Legal interpretation,
provider-specific consent requirements, storage/retention policy, and execution
of an AI use remain explicit human/system gates outside this deterministic
review model.
