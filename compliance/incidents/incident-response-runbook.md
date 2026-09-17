# Incident Response Runbook

## 1. Incident Roles
- **Incident Commander (IC)**: Lead engineer or Founder. Drives triage, coordinates actions, logs decisions.
- **Technical Lead**: Conducts containment, code patches, credential rotations.
- **Communications Lead**: Handles user notifications, status page updates, partner communications.

## 2. Step-by-Step Response Procedure

```
[ALERT / REPORT]
       ↓
1. TRIAGE & ASSESS (<15 min)
   - Assign severity: P0 / P1 / P2 / P3
   - Open incident log & private war room channel
       ↓
2. CONTAINMENT (<30 min)
   - Leaked Secret: Revoke in Secret Manager & rotate immediately
   - Storage Exposure: Restrict Cloud Storage bucket rules
   - Unauthorized Access: Terminate session, invalidate user tokens
       ↓
3. INVESTIGATION & FORENSICS
   - Query Cloud Logging / audit records
   - Identify breach scope, affected tenant UIDs, and timestamps
       ↓
4. REMEDIATION & RESTORATION
   - Deploy emergency hotfix via fast-track CI
   - Verify integrity of restored Firestore / storage data
       ↓
5. COMMUNICATION (<72 hr)
   - Notify affected customers/artists if confidential data exposed
   - Update platform status page
       ↓
6. POSTMORTEM (<5 business days)
   - Blameless review, root-cause analysis, corrective action tracking
```

## 3. Emergency Contacts & Escalation Pathways
- **Founder / Incident Commander**: `wiil@indii.music`
- **Infrastructure Emergency**: Google Cloud Console Support (Critical Sev)
- **Code Repository Lockdown**: GitHub Organization Admin Panel
