# Society registration completion

Build and publish on the authorized `rights-registration-hosted-filing` branch.

1. Complete pinned CWR REC records and expose SESAC preparation. Retain actual metadata and document obsolete SESAC flags rather than inventing offsets.
2. Add versioned onboarding and operator-approved transport configuration. Owners can request onboarding and revoke; only verified admin claims may approve private receiver settings. Bind exact batch approval and delivery claims to current profile revision.
3. Complete SFTP delivery controls, durable attempts, uncertain-transfer reconciliation, and bounded receiver ACK pickup. Unsupported receiver protocols remain explicit; never silently downgrade to plaintext FTP.
4. Centralize immutable ACK storage/correlation and per-work outcomes with sender/stage/provenance and revision fences. Recover legacy descriptors from verified manifests.
5. Connect Registration Center to preparation, onboarding, transmission, reconciliation, and per-work outcomes. Export remains available before receiver approval.
6. Run protocol and authorization tests, JEV source review, repository checks, publish branch and inspect exact-SHA CI. Real society acceptance is later with authorized accounts; structural checks do not substitute for it.

Critical files: `packages/shared/src/rights/cwr.ts`, `cwrReconciliation.ts`, `societyDelivery.ts`; `packages/firebase/src/functions/rights/{rightsRegistration,deliverCwr,ingestCwrAck,societyOnboarding}.ts`; `packages/renderer/src/modules/registration/components/SocietyRegistrationWorkspace.tsx`.

Verification: populated REC offsets and counts; malformed/duplicate ACK identities; sender/type/version mismatch; hub vs society outcomes; late revisions/conflicting evidence; private configuration isolation; revoked/duplicate claims; exact remote checksum reconciliation; bounded ACK retrieval. No production delivery or deployment without authorization.
