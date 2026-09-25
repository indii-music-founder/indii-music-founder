# Canonical Roadmap Engineering Status: Phases 12–19

Verified 2026-09-25 18:30 UTC. This ledger distinguishes code/tests from
phase acceptance; an open PR or green CI alone does not complete a phase.

## Delivery lane

- Repository: `indii-music-founder/indii-music-founder` only.
- Current `main`: `2abf6c6e5818053aae54484100671604b47a5ff3`.
- User authorized updates to the existing phase branches. PRs are not merged
  by this work; production, external transmissions, paid actions, and legal
  attestations remain out of scope.
- Exact remote PR heads/checks must be read from GitHub at delivery time; this
  file is not a substitute for those live values.

## Phase gates

| Phase | Evidence and current state | Remaining acceptance work |
| --- | --- | --- |
| 12 — Claims + Conflict Intelligence | PR #305 is merged; deterministic conflict projection is review-only. | No durable canonical claim intake/review state or dedicated Claims Inbox consumer is established by that slice. Rights findings do not authorize enforcement or clearance. |
| 13 — Advanced Catalog Intelligence | PR #304 adds owner-scoped canonical persistence, protected read projection, and Registration Center consumption to the deterministic identifier/relationship evaluator. Exact PR head `a5ef8d2fe08bc11954867eec74b5f0b76b7d47b9` passed setup, test, and build; workflow run `36172067071` is green. Legacy records remain separate and unconfirmed. | The prior store path was invalid Firestore structure; it is corrected here. Namespaced internal IDs are accepted while known external ID namespaces remain rejected. The append adapter is not exposed as a client write callable; no automatic legacy migration exists. Snapshot completeness remains `UNKNOWN` or `PARTIAL`, never inferred as complete. |
| 14 — Workflow Prediction | PR #307 has deterministic advisory predictions from structurally completed, artist-scoped workflow records. | There is no explicit `workflowExecutions` Firestore rule and the current client service creates/updates those records. Thus verified persistent history is not established. Do not label these predictions as verified until server-authoritative completion evidence and a safe consumer path exist. |
| 15 — Cross-Department Intelligence | PR #308 supplies a deterministic department review-plan projection. | It does not persist/lease/dispatch review work or demonstrate department consumers. Keep it a review pointer, not an event bus or automatic cross-department action. |
| 16 — Advanced DDEX / Industry Interoperability | PR #310 supplies bounded RDR-RCC TSV primitives; its current checks were green on the observed head. | No partner profile, AVS/profile validation, DPID/license setup, signing, persistence, exchange, or transmission is implemented. Do not invent unpublished specifications or transmit files. |
| 17 — AI Usage Rights | PR #311 contains scoped grant/evaluation contracts; local branch hardening rejects external identifiers as canonical rights references. Exact head `032705f28da8a5401bbc687368584e06b355b46d` passed setup, test, and build in run `36172077943`. | No authoritative grant repository is wired as an AI-ingestion gate. Declared/detected/inferred facts must not become clearance, provider permission, or training authority. |
| 18 — Local / Off-Grid Intelligence | PR #312 implements local-only audio/metadata inspection without saving or network access. Local UI now labels approximate loudness/peak comparison as estimates, not DSP compliance. Exact head `3017db7f4b7c227264a13200ee1f4c50851624cc` passed setup, test, and build in run `36172087917`. | The application is not generally available offline. |
| 19 — Full Founding Owner System | PR #313 preserves server-owned founder entitlements. Branch hardening now grants subscription access only for explicit `active`, `trialing`, or existing `past_due` grace states; founder activations remain perpetual and distinct grant revisions are recorded. Prior head `19a67a4fa22d32f7a4c71d9c922d7a14b9b31318` passed; follow-up head `c6b69dd8bf9ac8a63b5dbab7ae5932da74c804fd` is running as workflow `36173367381`. Do not modify production entitlements from this task. | Do not treat malformed or unknown subscription states as paid; the follow-up exact-SHA gate is pending. |

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
- The latest `main` workflow for `2abf6c6e5818053aae54484100671604b47a5ff3`
  (run `36173085786`) fails only in two stale agent-dashboard tests: the
  existing browser-safety follow-up PR #315 covers those test updates and has
  its own green run. Do not duplicate or merge that PR here.
- No phase is claimed complete on the strength of local checks alone. PR #304,
  #311, and #312 exact heads are green; PR #313's entitlement hardening is
  awaiting exact-SHA CI. Phases 14–16 and Phase 17's operational integration
  gates remain open as described above.

## Sequencing and safety

Do not infer catalog completeness, contributor identity, ownership, rights,
registration authority, or usage permission. Do not dispatch department work
or exchange DDEX/RDR-RCC data without the corresponding deterministic,
security-reviewed contracts and explicit external authorization. Jev may help
with bounded semantic interpretation, but cannot establish factual truth,
permissions, legal attestations, or completion evidence.
