# indii.music SOC 2 Compliance Framework

This directory houses the compliance governance framework, policies, vendor inventories, incident runbooks, and machine-readable controls registry for indii.music.

## Structure
- `policies/`: 16 core policies covering Security, Availability, and Confidentiality.
- `controls/`: Machine-readable master controls registry (`controls.yaml` and `registry.json`).
- `risk/`: Risk assessment matrix, scoring methodology, and enterprise risk register.
- `vendors/`: Third-party vendor inventory and security review procedures.
- `incidents/`: Incident response plan, postmortem templates, and security event logs.
- `business-continuity/`: Business continuity / disaster recovery plan, RPO/RTO metrics, and drill logs.

## Verification
Run the automated controls validator:
```bash
node scripts/verify-soc2-controls.mjs
```
