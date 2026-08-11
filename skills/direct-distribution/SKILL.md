---
name: direct-distribution
description: Evidence-controlled product skill for indii's Direct Distribution Engine: package generation, DDEX/ingestion metadata, QC, ISRC authority, tax/royalty calculations, keys/readiness, and transport. Use when designing, auditing, documenting, or implementing direct distribution. Keep repository implementation, automated tests, sandbox transport, production operation, and external partner/registry acceptance as separate states.
---

# Direct Distribution Engine

This is a covenant document: verify every path and status at the current SHA before relying on it. Never convert implemented code or sandbox tests into a claim that Apple, Spotify, Merlin, MLC, an ISRC agency, a tax authority, or another partner has accepted indii.

## Capability status at 2026-08-11

| Layer | Repository evidence | Current claim boundary |
| --- | --- | --- |
| Local execution | `packages/main/src/utils/python-bridge.ts`, `packages/main/src/utils/AgentSupervisor.ts` | Implemented local subprocess bridge; production packaging remains separately verified. |
| Package/ingestion generation | `execution/distribution/package_itmsp.py`, `ingestion_build.py`, `ingestion_generator.py`, `xsd_validator.py` | Implemented generators and validators; do not cite the removed `ddex_generator.py`. |
| QC and Content ID | `execution/distribution/qc_validator.py`, `content_id_csv_generator.py`, `packages/renderer/src/modules/distribution/components/QCPanel.tsx` | Implemented repository surface; provider ingestion acceptance is external evidence. |
| Authority identifiers | `execution/distribution/isrc_manager.py`, `packages/renderer/src/modules/distribution/components/AuthorityPanel.tsx` | Local identifier management exists; issuer/manager status and registry recognition require external proof. |
| Tax and waterfall | `execution/distribution/tax_withholding_engine.py`, `execution/finance/waterfall_payout.py`, `packages/renderer/src/modules/distribution/components/BankPanel.tsx` | Calculation/code paths exist; legal/tax compliance and real payouts require professional and live evidence. |
| Keys/readiness | `execution/distribution/keys_manager.py`, `packages/renderer/src/modules/distribution/components/KeysPanel.tsx` | Readiness artifacts exist; Merlin/MLC membership or connection is not implied. |
| Transport | `packages/renderer/src/services/distribution/DeliveryService.ts`, `BatchDeliveryService.ts`, `transport/SFTPTransporter.ts`, plus main-process distribution handlers | Transport mechanisms exist; successful sandbox or test transport is not partner production delivery. |

## Routing modes

### Audit or explain

Read the relevant code, tests, directives, and current issue ledger. Report each claim as:

- **Implemented** — current repository mechanism exists.
- **Structurally verified** — automated test or local validator passes.
- **Sandbox verified** — genuine sandbox endpoint accepted the exercised payload.
- **Production verified** — production endpoint accepted and durable status was observed.
- **Externally recognized** — partner, registry, authority, or contract evidence exists.
- **Unknown/stale** — evidence is absent or out of date.

### Implement

Use the active issue/acceptance contract and preserve:

- artist/account ownership and least privilege;
- immutable source/provenance and deterministic identifiers;
- schema/XSD validation before transport;
- idempotency keys, retry boundaries, acknowledgements, and terminal failure states;
- integer-safe money math and explicit currency/rounding policy;
- auditable tax inputs without making legal or tax promises;
- separate approval for partner delivery, publishing, payout, or other external writes.

### Deliver or validate externally

Read `.agent/REAL_USER_AUTHENTICITY.md`. Require official credentials, the exact target, a non-destructive or explicitly authorized payload, cost awareness, and observable acknowledgement. If authorization is missing or expired, stop and provide the official sign-in flow.

## Verification map

Use the narrow tests associated with the changed layer, then escalate with fan-out. Relevant evidence includes:

- Python unit/integration tests under `execution/distribution/`;
- main-process distribution security and integration tests under `packages/main/src/handlers/`;
- renderer distribution component/service tests;
- typecheck/lint and affected builds;
- schema/XSD validation against the exact generated package;
- genuine sandbox/production acknowledgement only when that external validation is authorized.

## Failure behavior

- Never retry a non-idempotent delivery blindly.
- Preserve provider acknowledgements and correlation IDs without exposing credentials.
- Do not mark delivery complete from a queued state.
- Do not rewrite credentials or partner configuration to make a test pass.
- After repeated failure, stop the mechanism, retain the package/evidence, and report the exact external or code prerequisite.
