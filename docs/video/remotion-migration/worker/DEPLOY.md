# Cloud Render Cutover Runbook (MIG-012)

> Status: **NOT APPROVED OR DEPLOYED.** Founder approval authorizes the paid GCP
> evaluation/deployment work; it does not by itself complete the repo-side cloud
> adapter, authenticated smoke proof, or cutover.

## Installed dependency

- `hyperframes@0.8.10` — exact-pinned in `packages/main` and at the repository root
  for Electron Builder production packaging.
- The official `@hyperframes/gcp-cloud-run@0.8.11` SDK/container/Terraform package is
  verified from the published docs. It is intentionally not installed until this
  deployment path is approved and implemented.

The installed CLI is the source of truth for flags. Before any paid action, run the
pinned command's help and review its current plan:

```bash
HOME=/tmp/hf-home XDG_CACHE_HOME=/tmp/.cache \
  node node_modules/hyperframes/bin/hyperframes.mjs cloudrun --help
```

## Phase A — approval, authentication, and infrastructure

1. Obtain explicit founder approval for GCP resource creation and expected spend.
2. Install exact-pinned `@hyperframes/gcp-cloud-run@0.8.11`, then use the official
   Application Default Credentials login flow if credentials are
   absent or expired; do not substitute another identity.
3. Select the existing indii GCP project, region, service account, bucket prefixes,
   concurrency, timeout, and spend ceilings.
4. Run the pinned CLI's `cloudrun deploy` command using only flags supported by
   `cloudrun deploy --help`, then record every created resource and teardown command.

## Phase B — repo-side cloud adapter

Implement a server-side adapter behind `VideoRendererContract`:

1. Compile `IndiiVideoProject` to a frozen composition bundle.
2. Upload or register the site using `@hyperframes/gcp-cloud-run/sdk` (`deploySite`).
3. Start a Cloud Run render with `renderToCloudRun`, poll `getRenderProgress`, and map
   provider execution IDs/progress/artifacts onto
   `renderId/projectId/progress/status/asset/expiresAt`.
4. Apply the existing owner authorization and cost reservation before dispatch;
   finalize or release the reservation on terminal state.
5. Keep the current Firebase fail-closed branch until all smoke criteria pass.

## Phase C — authenticated smoke and parity

1. Queue a real owner-scoped text fixture through the public server boundary.
2. Observe queued/running/completed receipts and a generation-bound private GCS artifact.
3. Download and probe the artifact, then compare it with the local render under the
   structural + SSIM parity gate.
4. Record the exact deployed revision, resource IDs, cost, and parity report.

## Phase D — cutover and rollback

- Enable composed cloud routing behind an explicit server-side flag only after Phase C.
- Rollback disables that route and restores today's fail-closed response.
- Teardown is a separate destructive action and requires explicit scope confirmation.
