# Canonical Roadmap Engineering Status: Phases 12–19

## Current acceptance audit — 2026-10-01

Audited against `main` at `4ee4136f7100b38b25dc3df9b1d8a89901e5b591`.
Local and remote main agree; the worktree was clean. All phase PRs below are
merged and there are no open repository PRs. The exact-SHA deployment workflow
[36882789774](https://github.com/indii-music-founder/indii-music-founder/actions/runs/36882789774)
succeeded. Those delivery facts do not close the integration gaps below.

| Phase | Delivered | Remaining acceptance work |
| --- | --- | --- |
| 12 | Claims/conflict projection and Legal Dashboard tab (#305; Phase 20). Owner-declared claims now enter the canonical owner store through an authenticated callable; claim and receipt event are created atomically. The tab reads the persisted scope and distinguishes loading/unavailable from an empty recorded inbox. | Owner-declared records do not cover external platform/partner intake. There is no durable human review/status-response workflow, and an empty internal inbox does not establish outside-source coverage or catalog completeness. ISSUE-1450 remains partial. |
| 13 | Catalog evaluator, owner-scoped canonical snapshot persistence and Registration Center consumer (#304). | No automatic legacy migration; incomplete snapshots remain UNKNOWN/PARTIAL. Genuine-account reload/downstream acceptance is not established by the engineering tests. |
| 14 | Deterministic artist-scoped predictions and sidebar consumer (#307); explicit owner-read/server-write rule. | The renderer still creates and mutates `users/{uid}/workflowExecutions` directly. The rule denies those writes. A backend trigger can only react after a record exists; it does not supply the missing authorized creation/human-action path. Verified history production remains incomplete. ISSUE-1451. |
| 15 | Deterministic review pointers on Connected Intelligence results (#308). | No persisted review queue, lease/dispatch or department consumer completion receipts. A review pointer is not automatic cross-department execution. |
| 16 | RDR-RCC TSV framing/escaping primitives (#310). | Full partner/profile/AVS validation, DPID/licence setup, reviewed field mapping and exchange remain separate gates. No external transmission is authorized by this audit. |
| 17 | Scoped AI_USE grant contracts and non-authorizing review projection (#311). | No authoritative grant repository integrated with an AI-ingestion execution gate. Every review remains `executionAuthorized: false`; rule changes to workflow history do not complete AI-rights integration. |
| 18 | Local audio/metadata QC estimates (#312). | General offline operation is not delivered. Approximate local QC must retain its estimate labels. |
| 19 | Server-owned founder entitlements and subscription-state hardening (#313). | Merged delivery replaces the old pending-PR gate. Genuine-account entitlement/reload acceptance remains unverified here; no entitlement mutation was performed. |

### Other started work reconciled in the same audit

- **Post-mastering administrative engine:** P1–P5 code landed, but
  `projectSemanticNode` has no non-test caller. The runbook does not regenerate
  the catalog projection; the public endpoint implements `?entityId=` rather
  than the planned entity/artist-feed routes; the SDK has no semantic catalog
  methods. The runbook explicitly defers `DISTRIBUTION_READY` integration to a
  later phase. These are open integration work, not a completed semantic
  surface (ISSUE-1452).
- **Long-video upload:** App Check fix #349 and production release landed.
  A fresh inspection of the existing genuine signed-in
  `https://app.indii.music/creative` tab showed Long recording / Choose phone
  recording, with no file selected. The account was pre-existing, not created
  in this audit; its previous verification recorded Founding Member, Lifetime,
  but this audit did not reopen Settings to reconfirm that plan. Original
  iPhone file selection, non-zero-offset resume, terminal proxy processing,
  Timeline playback/reload and conditional social draft remain unverified.
- **Print/upscale:** Browser neural upscale and bleed/CMYK handoff landed in
  `d9186692a` and `f18555900`. The generic export implementation is separate
  from every-target production byte inspection, vendor dieline import and
  PDF/X certification. See the [print handoff plan](../plans/print-ready-image-handoff-2026-09-28.md).
- **Domain-trained upscaler #329:** synthesis and benchmark harnesses landed;
  real corpus extraction, hardware benchmark execution and human review did
  not follow merely from closing the issue. GPU training remains owner-gated.
  **Tile-refine #325** was explicitly deferred; it is not implemented.
- **Road Manager ISSUE-1448:** the key restriction change was completed in the
  console and the structural spec was updated in `47630d90b`. Real provider
  results and genuine-user route persistence/deletion remain unverified.
- **Boardroom ISSUE-1449:** assertions were corrected; the existing simulated
  stream lacks billing completion, yielding one pass and three explicit
  failures. Do not fabricate completion or weaken the production guard.
- **Meta:** content connection code landed; the latest task report records
  business verification Verified, access verification In review. App Review
  and broader subscriber permission acceptance remain incomplete. This is a
  recorded prior observation, not a fresh Meta-console check.
- **Funding applications:** the 2026-09-28 handoff starts PearX and Detroit
  Startup Fund applications but supplies no submission receipt. Do not label
  applications submitted from a prepared dossier or closed engineering PR.
  Final consequential submission still needs founder approval.

### Recovered recent uncommitted evaluation work

A read-only worktree inventory also found four staged, uncommitted TypeSafe
shadow-evaluation files in `typesafe-evidence-shadow-eval` (base dated
2026-09-24). The minimal patch was recovered onto current `main`, preserving
that worktree. It adds candidate-level false-positive/false-negative metrics,
a five-threshold sweep, additional literal evaluation cases and opt-in provider
telemetry. The default production evidence gate is unchanged. These are
structural evaluation tools; the opt-in external-provider run does not establish
a genuine customer path and was not executed during this completion audit.

### Evidence limits

This is a repository/task-history completion audit, not a new customer-path
acceptance pass. No mocks, seeded data, injected auth, artificial plans,
external submissions or production data mutations were used in this audit.
The prior structural suites and CI may establish engineering regression
coverage; they cannot establish genuine-user acceptance. Missing user actions,
credentials, external review and explicit spending/legal gates remain visible.

The historical snapshot below explains earlier findings. Its open-PR,
branch-head and pending-CI statements are historical, not current instructions.

## Historical snapshot — 2026-09-25

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
| 12 — Claims + Conflict Intelligence | PR #305 is merged; deterministic conflict projection is review-only. A later owner-scoped server path persists user-declared assertions and receipt events; the tab loads them and labels an empty inbox without implying clearance. | External platform/partner claim intake and durable human review/status-response persistence remain open. Rights findings do not authorize enforcement or clearance. |
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
