# Checkpoint — Session Breakdown production hardening closeout (2026-07-25)

## Scope delivered

- Owner/project-bound resumable browser upload grants with interruption resume
  and terminal-attempt restart identity.
- Immutable original generation/SHA verification through dispatch and worker.
- Private Cloud Tasks → Cloud Run proxy execution with bounded leases,
  create-only derivatives, deterministic replay, and exact manifest persistence.
- FFmpeg proxy, guide audio, waveform, thumbnails/contact sheet, and
  proxy/original presentation-time mapping.
- Idempotent cost reservation/settlement and dependency-aware retention that
  fails closed when its bounded legacy scan cannot prove safety.
- Creative Video session intake with pause, resume, cancel, recovery, status,
  and private proxy opening.
- Deployment configuration for CORS, queue, OIDC, Cloud Run resources, media
  environment, and bucket-scoped worker write/delete access.

## Closure boundary

ISSUE-1175 remains **PARTIAL**. Automated validation and deployed infrastructure
do not replace its binding live acceptance proof. One authenticated production
recording must still reach a terminal `ProxyManifest` and open its playable
private proxy before the issue can be marked fixed.

## Preserved unrelated work

- `preserve-unrelated-release-workflow-before-session-closeout`
- `codex-preserve-session-breakdown-before-firestore-hardening`
- `codex-generated-schema-after-dashboard-commit`
- `codex-preserve-session-breakdown-before-dashboard-sync`

These stashes are intentionally retained and are not part of the session
closeout commit.
