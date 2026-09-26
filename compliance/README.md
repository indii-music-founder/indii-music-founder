# indii.music SOC 2 Readiness & Continuous Evidence

This directory contains the compliance governance framework used to prepare indii.music for a future independent SOC 2 examination.

**This repository is not claiming SOC 2 certification or an auditor attestation.**

The objective is to build controls and evidence collection into normal engineering operations so a future auditor can inspect a history that was accumulated as work happened rather than reconstructed after the fact.

## Structure

- `policies/`: core security, availability, confidentiality, change-management, access, vendor, and related policies.
- `controls/`: machine-readable control registry.
- `risk/`: risk methodology and risk register.
- `vendors/`: third-party inventory and security review process.
- `incidents/`: incident-response procedures, templates, and records.
- `business-continuity/`: continuity / disaster-recovery planning and drill records.
- `EVIDENCE_RETENTION.md`: evidence lifecycle and current retention gap.

## Continuous evidence workflow

`.github/workflows/soc2-evidence-collector.yml` runs:

- on a daily schedule;
- on demand;
- when defined compliance/security surfaces change.

The workflow currently checks:

1. the control registry and policies;
2. frontend API/token isolation;
3. Vertex/backend routing boundaries;
4. dependency vulnerability output;
5. a timestamped evidence summary bound to the exact git SHA.

It then uploads the evidence package as a GitHub Actions artifact.

## What the evidence proves

The collector can prove that named automated checks executed against a particular repository state at a particular time.

It does **not** independently prove that every SOC 2 control is effective, that every operational control is automated, or that an auditor has accepted the evidence.

Human/operational controls require their own source evidence.

## Retention limitation

The current repository is public and the workflow uses 90-day GitHub Actions artifact retention.

That is a useful hot-evidence window, but it is not by itself an adequate archive for a longer SOC 2 Type II observation period.

Before relying on this system for an examination, evidence snapshots must also be exported to a durable, access-controlled store with retention appropriate to the intended audit period.

See `EVIDENCE_RETENTION.md`.

## Verification

Run:

```bash
npm run check:soc2
npm run security:frontend-api-boundary
npm run security:vertex-only
npm run security:vertex-routing
```

Auditor-facing claims should always distinguish:

- **control designed**
- **control implemented**
- **control tested**
- **evidence retained**
- **auditor examined**

Those are different states.
