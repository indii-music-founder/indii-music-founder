# Session Breakdown issue-to-implementation reconciliation

**Audit date:** 2026-07-25

**Canonical requirements:** `.agent/test_ledger/OPEN_ISSUES_V2.md`

**Delivery rule:** ISSUE-1175 → 1176 → 1177 → 1178 → 1179 → 1180 → 1181

This document is an evidence cross-check, not a replacement ledger. Status changes
belong in the canonical ledger only after the corresponding acceptance evidence
exists.

## Executive finding

The implementation is materially ahead of several old issue summaries, but the
ledger's current dependency gate is still correct:

- ISSUE-1175 has a production implementation and strong automated evidence.
  It is not closed because the required authenticated production upload has not
  yet reached a terminal `ProxyManifest` and opened the resulting private proxy.
- ISSUE-1176 is not an implemented synchronization vertical slice. No
  `MasterTimingProfile` or `MasterSyncAlignment` production contract exists in
  the current tree, and there is no session-to-master alignment job/API/UI.
- ISSUE-1177 through ISSUE-1179 and ISSUE-1181 contain contract scaffolding,
  not customer workflows.
- ISSUE-1180 has useful compiler and timeline work, but it cannot be treated as
  a Session Breakdown completion path before 1175–1179 produce verified inputs
  and approval receipts.

## ISSUE-1175 — secure ingestion and proxy manifest

**Reconciled status:** PARTIAL, one binding production proof outstanding.

| Acceptance area | Actual implementation/evidence | Result |
| --- | --- | --- |
| Owner-bound resumable upload | `createVideoSession.ts`, `SessionVideoUploadService.ts`, resumable grant binding, offset/resume tests | Implemented and tested |
| Cross-owner denial | Firestore/Storage emulator cases plus callable ownership tests | Implemented and tested |
| Immutable original | Generation/SHA-pinned finalization, create-only promotion, stale-generation rejection | Implemented and tested |
| Private proxy derivatives | `video_pipeline.py` and `video_session_pipeline.py` produce CFR SDR proxy, guide audio, waveform, thumbnails/contact sheet | Implemented and fixture-tested |
| Presentation-time mapping | Integer-microsecond map with beginning/middle/end frame-bound assertions | Implemented and fixture-tested |
| Idempotency and cost | Deterministic task/job identity, transactional claim, leases, exact-manifest replay, cost reservation/settlement | Implemented and tested |
| Cancellation/retention | Cancellation receipts and dependency-aware bounded cleanup | Implemented and tested |
| Customer UI | `SessionIngestionPanel.tsx` supports start, resume, pause, cancel, recovery, status, and private proxy opening | Implemented and tested |
| Production infrastructure | Cloud Tasks queue, private Cloud Run worker, OIDC, env/IAM, Functions/Hosting deployment | Deployed; CI `30173066519` green |
| Authenticated terminal artifact | Signed-in production Studio is open and the fixture/upload panel is ready; Chrome file upload is blocked until the ChatGPT Chrome Extension is allowed access to file URLs | **Outstanding closure gate** |

### Closure procedure

1. Enable file upload for the ChatGPT Chrome Extension.
2. Upload `/tmp/issue-1175-production-proof-20260725.mp4` through the signed-in
   production `Long recording` panel.
3. Record the session ID and observe upload → uploaded → processing → completed.
4. Read the owner-scoped session and validate the persisted manifest against
   `ProxyManifestSchema`.
5. Verify original generation/SHA remain unchanged and derived generations are
   private and distinct.
6. Select **Open edit proxy** and prove the private proxy is playable.
7. Retry the same operation and verify manifest/job/cost reuse.
8. Append the exact artifact evidence to the canonical ledger and only then
   mark ISSUE-1175 fixed.

## ISSUE-1176 — master synchronization

**Reconciled status:** BLOCKED / essentially not implemented.

The ledger's older `PARTIAL` label refers to generic engine-DSP dependency/tests,
not the required synchronization workflow. Current source search finds neither
`MasterTimingProfile` nor `MasterSyncAlignment`, and the existing DSP pipeline
profiles/verifies a canonical master without locating repeated or partial guide
audio occurrences.

Required next vertical slice after 1175 closes:

1. Add strict, versioned shared schemas for `MasterTimingProfile` and
   `MasterSyncAlignment`, including owner/project identity, source/guide/master
   generations and hashes, integer-microsecond anchors, fit/residual/drift,
   confidence/status, algorithms, and manual overrides.
2. Add owner-authorized profile/alignment job APIs that consume only the
   terminal ISSUE-1175 guide receipt and an immutable canonical master.
3. Implement deterministic multi-window alignment with repeated-section,
   wrong-version, no-match, drift, discontinuity, and ambiguity policies.
4. Persist immutable evidence separately from timeline state. Manual nudges
   append auditable anchors and never rewrite deterministic evidence.
5. Validate noisy/reverberant, speech-over-music, Bluetooth-delay, codec-loss,
   partial/repeated-take, slow-drift, discontinuity, wrong-version, and no-match
   fixtures.
6. Add ownership, stale-generation, retry/idempotency, and beginning/middle/end
   rendered marker proofs.

Do not begin ISSUE-1177 implementation until this evidence exists.

## Later Session Breakdown issues

| Issue | Code that actually exists | What is still missing |
| --- | --- | --- |
| 1177 grounded analysis | `SessionSegmentSchema`, `SessionEditPlanSchema`, schema tests | Deterministic evidence/transcription pipeline, bounded model boundary, persistence, cost/idempotency, UI |
| 1178 audio recipes | `AudioRecipeSchema`, tests | DSP recipes/derivatives, loudness and damage fixtures, preview, ownership/cost/cancellation |
| 1179 Director's Cut | `ApprovalReceiptSchema`, tests | Review UI/state/persistence, stale and low-confidence gates, accessibility/E2E |
| 1180 timeline compilation | Durable project persistence, source-mapping fields, pure `compileApprovalToTimeline`, idempotency/ownership tests | Valid 1176–1179 inputs, server-private final resolution, preview/render parity, rendered sync fixture |
| 1181 private handoff | `DerivativeAssetReceiptSchema`, `SocialHandoffDraftSchema`, tests | Terminal private render lifecycle, asset-library insertion, typed draft service, deletion graph, separate delivery approval |

## Process improvements

1. **Separate implementation status from closure status.** Use `CONTRACT`,
   `IMPLEMENTED`, `DEPLOYED`, and `PRODUCTION-PROVEN` evidence columns so a
   passing schema suite cannot look like a customer workflow.
2. **Make live proof reproducible.** Keep a non-sensitive production fixture,
   expected manifest assertions, polling command, cleanup policy, and evidence
   template in one maintained smoke harness.
3. **Link every acceptance item to a test or artifact.** The ledger should name
   the exact test file/case, production run, document ID, and receipt identity.
4. **Treat superseded CI correctly.** A concurrency cancellation is not a code
   failure when a green descendant SHA contains the commit; record the
   descendant run explicitly.
5. **Keep dependency gates executable.** CI or a ledger check should prevent
   1176 closure unless 1175 has a recorded terminal production manifest, and
   similarly prevent later closures without predecessor receipts.
6. **Audit stale status language during every closure.** ISSUE-1176's `PARTIAL`
   headline currently overstates reality even though its founder assessment is
   accurate. Reconcile headlines with the strongest actual artifact.
