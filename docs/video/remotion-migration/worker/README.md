# Cloud Run Video Worker (MIG-012)

This directory records the approval-gated cloud-composition work. It is not a
deployed worker and it is not a claim that only one command remains.

## Verified locally

- `hyperframes@0.8.10` is exact-pinned and its installed CLI exposes
  `cloudrun deploy`, `sites`, `render`, `progress`, and `destroy`.
- The desktop compiler and local adapter produce real artifacts behind
  `VideoRendererContract`.
- Firebase rejects composed cloud projects before budget reservation, durable job
  creation, or provider dispatch. Supported direct operations retain their existing
  managed Transcoder path.

## Work after founder approval

1. Authenticate the official GCP application-default flow and review the CLI's
   proposed resources/costs.
2. Deploy the vendor-managed Cloud Run resources with the pinned CLI.
3. Implement the server-side cloud adapter and map its lifecycle onto the frozen
   indii receipt contract and existing cost-reservation policy.
4. Prove owner-scoped GCS input/output with a genuine authenticated round trip.
5. Run local-versus-cloud parity, record the result, and only then enable the
   composed route behind a rollback flag.

No legacy composition service remains to fall back to. Rollback means disabling the
new composed route (returning to the current fail-closed behavior); it does not mean
switching back to the retired engine.
