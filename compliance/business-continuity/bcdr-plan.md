# Business Continuity & Disaster Recovery Plan

## 1. Scope
This plan guides business and technical operations during disaster scenarios affecting Google Cloud Platform, GitHub, third-party DSP integrations, or physical developer facilities.

## 2. Disaster Scenarios & Playbooks
### Scenario A: Google Cloud Regional Outage
1. Firestore multi-region configuration automatically serves reads and writes from the paired region.
2. If Cloud Run us-central1 experiences extended disruption, CI/CD pipeline triggers redeployment of functions to us-east1 via `firebase.json` region overrides.

### Scenario B: Accidental Mass Collection Deletion in Firestore
1. Freeze Firestore access rules temporarily (`read: false, write: false`).
2. Restore from the most recent daily Firestore automated snapshot using `gcloud firestore databases restore`.
3. Verify tenant collection integrity using test scripts.
4. Unfreeze access rules and log restoration event in `dr-drill-log.md`.

### Scenario C: Audio Vault Bucket Corruption or Ransomware
1. Object versioning prevents unversioned overwrites. Noncurrent versions are retained for 30 days.
2. Execute version rollback script in Cloud Storage to reinstate the latest non-corrupted object generations.
