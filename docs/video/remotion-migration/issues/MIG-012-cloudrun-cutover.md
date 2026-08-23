# MIG-012: Cloud Run cutover to the new renderer (stays on Google Cloud)

Type: HITL (infra/cost approval) · Blocked by: corrected parity sign-off · Stories: 15, 16

> STATUS: **not deployed.** The pinned HyperFrames CLI exposes Cloud Run commands and
> the runbook records the approval boundary. Repo-side cloud adapter wiring, authenticated
> GCS smoke proof, budget mapping, and cutover still remain after founder approval.

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Deploy the new engine's renderer as a Google Cloud Run Jobs worker (Chromium + engine +
FFmpeg) reading inputs from and writing outputs to GCS, owner-scoped authorization preserved.
Until then, composed Firebase render requests fail closed before reservation or dispatch;
desktop-local composition rendering remains available. Existing direct Transcoder jobs
continue independently for supported direct operations.

## Acceptance criteria
- [ ] Worker deployed on Cloud Run Jobs; GCS round-trip verified with ADC auth
- [ ] Owner-scoped access checks enforced server-side end-to-end
- [ ] Receipt protocol identical from client perspective
- [ ] Cost estimate reviewed and approved by founder before switch-on
- [ ] Rollback plan validated against the actual post-deploy gateway flag
