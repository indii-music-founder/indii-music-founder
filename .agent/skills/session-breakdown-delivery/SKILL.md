---
name: session-breakdown-delivery
description: Deliver the ordered Session Breakdown roadmap in ISSUE-1175 through ISSUE-1181 for indii. Use whenever working on secure long-recording ingestion, canonical-master synchronization, session analysis, audio cleanup, Director's Cut approval, master-relative timeline compilation, or private Social/Campaign handoff. Start from the active ledger, preserve the strict issue order, and fail closed on ownership, provenance, generation, approval, and terminal-state checks.
---

# Session Breakdown Delivery

## Purpose

Implement the Session Breakdown roadmap as one dependency-ordered product path. The authoritative requirements, acceptance criteria, and status remain in `.agent/test_ledger/OPEN_ISSUES_V2.md` under ISSUE-1175 through ISSUE-1181. Do not copy or replace those records with a separate issue ledger.

The product turns one long phone recording into artist-approved selects. It preserves the immutable original, normalizes a private editing proxy, aligns performance footage to a verified canonical master, classifies and proposes reversible edits, permits explicit Director's Cut approval, compiles one durable project timeline, then creates private typed derivative handoffs. It never auto-publishes.

## Non-negotiable invariants

- Keep originals and canonical masters immutable, generation-pinned private inputs. Never use a public/download URL as record identity.
- Use integer microseconds for durable media time. Preserve an explicit proxy-time to original-presentation-time map.
- Keep deterministic media/DSP work responsible for timestamps, transcodes, synchronization, audio recipes, and rendering. Gemini may only operate on bounded evidence and return validated, structured recommendations.
- Make every processing, analysis, alignment, recipe, approval, compilation, and render operation idempotent, owned, provenance-stamped, cancellable, and auditable.
- A completed analysis is not an approval; an approved plan is not a render or publication permission.
- Reuse the prerequisite systems named in the ledger: ISSUE-1145, 1147, 1157, 1159, 1168, 1169/1170, and 1123. Do not build parallel upload, persistence, render, or handoff systems.

## Delivery order

Work exactly in this sequence. Do not start a later issue's implementation before the predecessor's contracts, tests, and dependency evidence are ready.

1. **ISSUE-1175 — secure ingestion and proxy manifest.** Establish versioned `CanonicalMediaRef`, `VideoSession`, and `ProxyManifest`; owner-bound resumable sessions; immutable source receipts; private CFR SDR proxy, guide audio, inspection evidence, time map, job lifecycle, and cleanup.
2. **ISSUE-1176 — master synchronization.** Add immutable `MasterTimingProfile` and `MasterSyncAlignment` sidecars plus deterministic multi-window alignment, confidence policy, manual auditable anchors, and no-match review states.
3. **ISSUE-1177 — grounded session analysis.** Build deterministic evidence, durable transcription, and a strictly validated `SessionEditPlan`. Model output may classify and recommend only within supplied evidence bounds.
4. **ISSUE-1178 — reversible audio recipes.** Introduce versioned `AudioRecipe` derivatives, conservative cleanup profiles, master replacement/ambience blending, deterministic ducking, quality disclosures, and preview-before-approval.
5. **ISSUE-1179 — Director's Cut.** Implement project-scoped review and immutable `ApprovalReceipt` records. Make low-confidence, stale, and damaged-audio conditions explicit gates; never compile or render in the UI.
6. **ISSUE-1180 — durable timeline compilation.** Extend the single ISSUE-1147 timeline contract; compile exactly one project revision from a valid approval receipt; preserve source ranges, sync lock, mapping, audio semantics, and provenance through preview and final server render.
7. **ISSUE-1181 — private derivatives and typed handoff.** Generate only explicit, terminal/playable private variants, retain full lineage, insert them into the asset library, and create typed Social/Campaign drafts that require separate delivery approval.

## Start every issue

1. Read the full active ledger entry and its prerequisite entries. Write a short acceptance-to-evidence checklist in the current task context; do not mark the issue complete until every item is evidenced.
2. Read `.agent/workflows/branch-safety.md`, fetch `origin`, confirm `main`, fast-forward safely, and inspect the worktree. Work directly on `main` unless the user explicitly requests a branch.
3. Map the existing contract, owner boundary, worker, storage rule, UI, and tests before editing. Reuse an existing system where the ledger names one.
4. For any Firestore or Storage work, activate the corresponding Firebase skill and add emulator ownership tests before considering happy paths complete. For high-risk deterministic logic, work test-first.
5. Keep the implementation a vertical slice for the current issue. Do not prebuild later timeline, render, or publishing behavior.

## Required evidence by layer

| Layer | Evidence before moving on |
| --- | --- |
| Shared contracts | Schema/version tests; explicit owner, project, Storage generation, hash, MIME, byte-size, worker/schema version, receipt, and microsecond-time fields where applicable. |
| Backend and workers | Idempotency, retry, cancellation, cleanup, cost reservation/settlement, stale-generation, and cross-owner denial tests. |
| Media/DSP | Fixture-driven FFprobe/transcode or synthetic signal assertions; beginning/middle/end timing checks; immutable source/master checks. |
| Model boundary | Malicious, stale, out-of-range, overlapping, and unsupported structured responses fail closed; no raw private original sent to consumer tooling. |
| UI | Reducer/service, interaction, empty/error, reload, accessibility, ownership, and stale-state tests. UI emits intent only; backend performs protected state changes. |
| Handoff | Terminal/playable eligibility, typed asset-ID contract, lineage/deletion graph, and explicit separate publish approval tests. |

## Completion standard

For each issue, run the narrowest relevant tests during implementation, then the required package checks. Update the canonical ledger in the same coherent commit only after every acceptance criterion has concrete evidence. Push directly with `git push origin HEAD:main`, inspect CI for that exact SHA, and fix only logged root causes until green.

If a prerequisite is not actually available, stop at the dependency boundary, leave the issue open or partial with precise evidence, and request the external authority or implementation work needed. Never replace missing evidence with a claimed success.
