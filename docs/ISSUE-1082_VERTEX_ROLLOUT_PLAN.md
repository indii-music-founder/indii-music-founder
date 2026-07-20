# ISSUE-1082 — Vertex AI production rollout plan

## Objective

Restore and keep production creative generation available by making Vertex AI
via Application Default Credentials (ADC) the deterministic production media
provider. Prove one real authenticated `generateImageV3` request completes on
the postpaid GCP project, persists its output and cost outcome correctly, and
that the existing billing/quota alert reaches its intended recipient.

## Why this is the first item

The root issue document's only unchecked security item (SEC-001) is stale: the
canonical ledger records it as fixed on 2026-07-17 after credential rotation
and history purge. ISSUE-1082 remains a critical, user-visible outage: depleted
AI Studio prepaid credits previously made every creative generation request
fail. Its code and monitoring foundations exist, but production rollout and
live proof do not.

## Verified starting point

- `packages/firebase/src/functions/creative/gateway.ts` selects `vertex` by
  default when `NODE_ENV=production`, supports a `MEDIA_PROVIDER` override,
  and retries an API-key request through Vertex when the API key is invalid or
  prepaid billing is exhausted.
- `packages/firebase/src/functions/creative/__tests__/mediaProvider.test.ts`
  covers the default/override selection policy.
- `packages/firebase/src/lib/vertexClient.ts` builds a Vertex SDK client using
  ADC and the correct host for global and multi-region locations.
- `.github/workflows/deploy.yml` deploys functions, but currently writes only
  `INFLUENCER_BOUNTY_BASE_URL` into the Firebase project environment file.
  Production therefore depends on the Cloud Functions `NODE_ENV` convention
  instead of explicitly deploying `MEDIA_PROVIDER=vertex`.
- The canonical ledger records a live notification channel, a log-based
  `RESOURCE_EXHAUSTED` alert policy, and a monthly budget. The remaining
  acceptance work is deployment plus an authenticated live image and alert
  proof.

## Scope and boundaries

This work changes only production media-provider configuration, observability,
tests, deployment evidence, and the canonical issue status. It does not change
the Omni Flash path, which still deliberately requires the paid Gemini
Developer API key, nor does it redesign creative models or billing policy.

Existing uncommitted changes under `packages/firebase/` belong to another
workstream. Before implementation, inspect their ownership and avoid editing
or staging them. If they overlap the files below, stop and integrate only with
their owner's direction.

## Implementation plan

1. Establish a safe mainline baseline.

   - Read `.agent/workflows/branch-safety.md`, fetch `origin`, verify the
     checked-out branch is `main`, and ensure local `main` is fast-forwarded to
     `origin/main` before making task changes.
   - Record the existing dirty files and keep them out of this task's commit.
     Do not stash, reset, or overwrite user work.

2. Make production provider selection explicit and observable.

   - Update `.github/workflows/deploy.yml` so the Firebase project environment
     file written immediately before the functions deploy includes
     `MEDIA_PROVIDER=vertex`. Preserve the existing
     `INFLUENCER_BOUNTY_BASE_URL` value and use the Firebase-supported
     project-specific environment-file mechanism; do not put credentials in
     the repository.
   - In `packages/firebase/src/functions/creative/gateway.ts`, add a
     structured, non-sensitive provider-selection field to the image job
     record and completion log. The value must be the effective provider
     (`vertex` or `apikey`), never an API key, token, prompt, or user data.
     This supplies durable evidence that a successful request used Vertex
     rather than merely succeeded after an opaque fallback.
   - Retain `MEDIA_PROVIDER=apikey` as an intentional emergency override only;
     document it beside the workflow setting and in `.env.example`. Do not
     silently fall back from Vertex to the prepaid API-key provider in
     production.

3. Strengthen the regression contract.

   - Extend
     `packages/firebase/src/functions/creative/__tests__/mediaProvider.test.ts`
     to prove the explicit production value wins, development/test defaults do
     not use production billing, and an invalid explicit value cannot select
     API-key mode in production.
   - Add focused gateway tests (in the existing creative gateway test suite or
     a new adjacent test file) that mock the SDK client and assert image jobs
     record `provider: 'vertex'` when the effective provider is Vertex. Add a
     fallback test confirming a prepaid-billing error on the dev/QA API-key
     path retries once through Vertex, without exposing the provider error to
     the client as a false success.
   - Keep test fixtures fully synthetic and do not place live credentials,
     base64 media, or raw provider responses in source control.

4. Verify deployment prerequisites before the production change.

   - Read the deployed `generateImageV3` configuration and its runtime service
     account. Confirm the active project has the Vertex AI API enabled and the
     runtime identity has only the permissions required to invoke Vertex and
     write the existing Storage/Firestore output. Correct missing IAM/API
     prerequisites through the approved cloud-owner workflow, not by adding a
     service-account key to source or client configuration.
   - Confirm the production image model selected by
     `resolveImageModel()` is available in `VERTEX_IMAGE_LOCATION` (default
     `us`). If it is not, configure a supported location deliberately and add
     a matching test/config assertion.
   - Confirm the log-based alert still filters the deployed function's
     `RESOURCE_EXHAUSTED`/billing signal, the notification channel is enabled,
     and the budget recipient is current. Do not lower quotas, consume credits,
     or induce a production failure merely to test the alert.

5. Validate and deliver one coherent mainline change.

   - Run the focused provider and gateway tests, Firebase TypeScript build,
     scoped Firebase lint, and the repository's required `npm run typecheck`
     and `npm run lint` checks.
   - Re-open the workflow and gateway lines after edits to verify the deployed
     `MEDIA_PROVIDER=vertex` setting and non-sensitive evidence field are
     present.
   - Fetch again immediately before committing. Create one task-only commit on
     `main`, with the current mainline as its parent, and push it exclusively
     with `git push origin HEAD:main`.
   - Identify and inspect the CI run for that exact commit SHA. Treat a failed
     functions deployment as an observed incident: diagnose the actual log
     before making a narrow follow-up fix. Do not guess at CI failures or
     rewrite main history.

6. Perform controlled live acceptance after CI deploys the functions.

   - With an approved authenticated test user and an agreed small spend cap,
     reserve cost through the normal client flow and submit one minimal,
     policy-safe image request to `generateImageV3`.
   - Verify the callable returns a real Storage result URI, the corresponding
     `creative_jobs/{jobId}` record reaches `completed`, its provider field is
     `vertex`, and the associated cost reservation is settled exactly once.
     Fetch the object through the normal owner-authorized path to confirm it is
     a decodable image; never inspect another user's data.
   - Correlate the function invocation with Cloud Logging's Vertex client
     initialization/request evidence and the postpaid project's billing view.
     This must demonstrate Vertex ADC was selected, not merely that an image
     appeared.
   - Trigger a documented, non-production alert test through the existing
     Cloud Monitoring test-notification mechanism. Confirm the designated
     founder/operations recipient receives it and record only the alert-policy
     ID and timestamp, not email addresses or secrets.

7. Close the evidence loop or leave an honest partial status.

   - Append the deployment SHA, CI run URL/status, sanitized live job ID,
     provider evidence, Storage/cost verification, and alert-test timestamp to
     ISSUE-1082 in `.agent/test_ledger/OPEN_ISSUES.md`.
   - Mark it `✅ FIXED` only after all of the acceptance evidence exists. If
     cloud IAM, model availability, production access, spend approval, or alert
     delivery blocks the live proof, retain `🟡 PARTIAL` and append the exact
     blocker. Never fabricate a successful generation, receipt, alert, or
     billing result.

## Files expected to change

| Path | Planned change |
| --- | --- |
| `.github/workflows/deploy.yml` | Deploy the explicit production `MEDIA_PROVIDER=vertex` function environment setting. |
| `packages/firebase/src/functions/creative/gateway.ts` | Persist/log the effective non-sensitive provider on image jobs. |
| `packages/firebase/src/functions/creative/__tests__/mediaProvider.test.ts` | Cover explicit production configuration and fail-safe selection. |
| `packages/firebase/src/functions/creative/__tests__/…` | Add or extend focused mocked gateway coverage for provider evidence and the prepaid fallback. |
| `.env.example` | Keep the documented provider policy and emergency override accurate. |
| `.agent/test_ledger/OPEN_ISSUES.md` | Append truthful fix/evidence details only after live acceptance. |

## Verification checklist

- [ ] Focused provider-selection and gateway tests pass.
- [ ] `npm run build -w packages/firebase` passes.
- [ ] Scoped Firebase lint, `npm run typecheck`, and `npm run lint` pass.
- [ ] The exact pushed SHA has a green CI run, including the functions deploy.
- [ ] Deployed function configuration explicitly supplies `MEDIA_PROVIDER=vertex`.
- [ ] One authenticated image request returns an owner-readable, decodable
      Storage result and a completed Vertex-labelled job.
- [ ] Its cost reservation is settled once; no duplicate output/job is created.
- [ ] Cloud Logging/billing evidence confirms Vertex ADC and postpaid billing.
- [ ] A controlled Monitoring notification reaches the intended recipient.
- [ ] ISSUE-1082 contains precise, sanitized evidence or remains honestly
      partial with the remaining external blocker.

## Rollback

If Vertex itself is unavailable after deployment, set
`MEDIA_PROVIDER=apikey` only through the approved production configuration
path, redeploy the affected functions, and use the existing API-key-to-Vertex
fallback behavior where applicable. Record the incident and revert to Vertex
once the root cause is fixed. Do not roll back by committing credentials,
weakening authentication/App Check, suppressing alerts, or hiding generation
errors from users.
