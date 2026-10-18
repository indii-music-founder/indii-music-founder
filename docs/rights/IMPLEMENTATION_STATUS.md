# Rights registration branch status

This branch is reviewable implementation work, not release acceptance evidence.
No society deliveries, copyright payments, filings, deployments, or genuine
customer acceptance journeys were performed for this change.

## Implemented surfaces

- Versioned filing contracts, explicit legal metadata, manifest hashes, owner-scoped
  persistence, immutable filing snapshots, and separate user-reported evidence.
- Fixed-width CWR 2.1/2.2 export and CWR acknowledgment parsing/correlation, exact
  batch approval, and a gated SFTP delivery adapter requiring approved submitter
  configuration and receiver onboarding evidence.
- SoundExchange bulk serialization from operator-reviewed official template profiles.
- Dedicated browser worker and session broker packages, owner-bound single-use
  tickets, execution claims, control generations, bounded frames, network filtering,
  human control, and consent-based encrypted authentication-state storage.
- Registration Center preparation UI and legacy desktop safeguards against missing
  targets, unbound sessions, invented metadata, and unverified confirmation claims.

## Required work before enablement

Keep `RIGHTS_HOSTED_ENABLED`, `RIGHTS_PAYMENT_ENABLED`, and
`RIGHTS_CWR_DELIVERY_ENABLED` disabled. Operator configuration alone is not proof
that an integration works.

Hosted browser adapters currently expose limited verified preparation actions;
complete Standard, GRUW, and separate GRAM application journeys, deposit selection,
trusted official receipt capture, durable reconciliation, compatibility projections,
and canonical catalog identity linkage still require completion and genuine checks.
Session expiry/worker-loss reconciliation and deployment lifecycle recovery require
additional verification and operational cleanup. Docker images have not been
validated by a deployment.

SESAC export remains blocked pending its required recipient-specific record layout
and validation. MusicMark and MLC require receiver onboarding, approved submission
identity and credentials, real transmission testing, and official acknowledgment
reconciliation. Imported acknowledgments retain user-import provenance and do not
independently establish an official provider outcome. SoundExchange requires an
approved official template; delivery remains manual.

Remembered authentication requires reviewed cookie classification, KMS/GCS IAM,
retention lifecycle configuration, and revocation/expiry verification. Hosted payment
requires its own sensitive-data assessment and controls before enabling. Human
control does not eliminate credential or payment-data processing scope.

Local pure tests and legacy structural regressions verify code properties only.
They do not establish customer-path readiness or permission to deploy or transmit.
