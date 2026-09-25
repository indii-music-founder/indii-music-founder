# Canonical Roadmap Engineering Status: Phases 12–19

Verified 2026-09-25 18:09 UTC. This ledger distinguishes code/tests from
phase acceptance; an open PR or green CI alone does not complete a phase.

## Delivery lane

- Repository: `indii-music-founder/indii-music-founder` only.
- Current `main`: `90c8907d936ea49bd96e03ec7ad6b5dae6b8f348`.
- User authorized updates to the existing phase branches. PRs are not merged
  by this work; production, external transmissions, paid actions, and legal
  attestations remain out of scope.
- Exact remote PR heads/checks must be read from GitHub at delivery time; this
  file is not a substitute for those live values.

## Phase gates

| Phase | Evidence and current state | Remaining acceptance work |
| --- | --- | --- |
| 12 — Claims + Conflict Intelligence | PR #305 is merged; deterministic conflict projection is review-only. | No durable canonical claim intake/review state or dedicated Claims Inbox consumer is established by that slice. Rights findings do not authorize enforcement or clearance. |
| 13 — Advanced Catalog Intelligence | PR #304 has a deterministic identifier/relationship evaluator. Its branch is being updated with owner-scoped canonical persistence, protected read projection, and Registration Center consumption. Legacy records remain separate and unconfirmed. | The prior store path was invalid Firestore structure; it is corrected here. Namespaced internal IDs are accepted while known external ID namespaces remain rejected. The append adapter is not exposed as a client write callable; no automatic legacy migration exists. Snapshot completeness remains `UNKNOWN` or `PARTIAL`, never inferred as complete. Updated branch and exact-SHA CI are pending. |
| 14 — Workflow Prediction | PR #307 has deterministic advisory predictions from structurally completed, artist-scoped workflow records. | There is no explicit `workflowExecutions` Firestore rule and the current client service creates/updates those records. Thus verified persistent history is not established. Do not label these predictions as verified until server-authoritative completion evidence and a safe consumer path exist. |
| 15 — Cross-Department Intelligence | PR #308 supplies a deterministic department review-plan projection. | It does not persist/lease/dispatch review work or demonstrate department consumers. Keep it a review pointer, not an event bus or automatic cross-department action. |
| 16 — Advanced DDEX / Industry Interoperability | PR #310 supplies bounded RDR-RCC TSV primitives; its current checks were green on the observed head. | No partner profile, AVS/profile validation, DPID/license setup, signing, persistence, exchange, or transmission is implemented. Do not invent unpublished specifications or transmit files. |
| 17 — AI Usage Rights | PR #311 contains scoped grant/evaluation contracts; local branch hardening rejects external identifiers as canonical rights references. | No authoritative grant repository is wired as an AI-ingestion gate. Declared/detected/inferred facts must not become clearance, provider permission, or training authority. Updated branch and exact-SHA CI are pending. |
| 18 — Local / Off-Grid Intelligence | PR #312 implements local-only audio/metadata inspection without saving or network access. Local UI now labels approximate loudness/peak comparison as estimates, not DSP compliance. | The application is not generally available offline. Focused UI tests pass; updated branch and exact-SHA CI are pending. |
| 19 — Full Founding Owner System | PR #313 preserves server-owned founder entitlements. Local reconciliation now downgrades canceled/downgraded subscription grants without revoking perpetual founder activations, and records distinct grant revisions. | Focused entitlement tests and Firebase build pass; updated branch and exact-SHA CI are pending. Do not modify production entitlements from this task. |

## Local verification for the current update

- Phase 13: 144 focused tests pass; shared and Firebase builds pass. The
  Firestore emulator suite passed its 247 Firestore cases, including denial of
  direct client access to canonical catalog paths.
- The combined Firestore/Storage rules command reported two failures in the
  pre-existing owner-bound long-recording Storage tests; those are unrelated
  to Firestore catalog paths and need separate review before claiming the full
  combined rules gate green.
- Phase 17: 38 rights-intelligence tests and shared typecheck pass.
- Phase 18: 9 QCPanel tests pass (JSDOM emits existing `window.scrollTo`
  warnings).
- Phase 19: 18 entitlement tests and Firebase build pass.
- Remote updates and exact-SHA CI for these local fixes are pending; no phase
  is claimed complete on the strength of local checks alone.

## Sequencing and safety

Do not infer catalog completeness, contributor identity, ownership, rights,
registration authority, or usage permission. Do not dispatch department work
or exchange DDEX/RDR-RCC data without the corresponding deterministic,
security-reviewed contracts and explicit external authorization. Jev may help
with bounded semantic interpretation, but cannot establish factual truth,
permissions, legal attestations, or completion evidence.
