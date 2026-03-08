# Disaster Recovery Runbook

## Item 296: RTO/RPO Targets & Restoration Procedure

### Overview

This document covers the disaster recovery procedure for a full or partial data loss event in the indiiOS production environment.

---

## Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | 24 hours | Daily automated exports to GCS |
| **RPO** (with manual trigger) | ~1 hour | On-demand export before risky operations |
| **RTO** (Recovery Time Objective) | 4 hours | Full Firestore restoration from backup |
| **RTO** (partial) | 30 minutes | Single collection restoration |

---

## Disaster Scenarios

### Scenario 1: Accidental Collection Deletion

**Symptoms:** Users report missing data in a specific module.

**Recovery Steps:**

1. Identify the affected collection from user reports / error logs
2. Locate the latest backup in GCS:

   ```bash
   gsutil ls gs://indiiOS-firestore-backups/ | tail -5
   ```

3. Import only the affected collection:

   ```bash
   gcloud firestore import gs://indiiOS-firestore-backups/YYYY-MM-DD \
     --collection-ids=<collection_name>
   ```

4. Verify data integrity via Firebase Console or Firestore CLI
5. Notify affected users

---

### Scenario 2: Full Firestore Corruption

**Symptoms:** App-wide data issues, multiple collections affected.

**Recovery Steps:**

1. **IMMEDIATELY** halt all write operations:
   - Update Firestore rules to deny all writes temporarily
   - Stop Cloud Functions: `firebase functions:delete --all-functions`
2. Select the most recent clean backup:

   ```bash
   gsutil ls -l gs://indiiOS-firestore-backups/ | sort -k2 | tail -10
   ```

3. Perform full import:

   ```bash
   gcloud firestore import gs://indiiOS-firestore-backups/YYYY-MM-DD
   ```

4. Re-deploy Cloud Functions: `firebase deploy --only functions`
5. Restore normal Firestore rules: `firebase deploy --only firestore:rules`
6. Verify via app and monitoring dashboards

---

### Scenario 3: Firebase Project Compromise

**Symptoms:** Unauthorized access, unexpected billing spikes, data exfiltration.

**Immediate Actions:**

1. **Rotate ALL credentials** immediately (see `API_KEY_ROTATION_RUNBOOK.md`)
2. **Revoke all OAuth tokens** in GCP Console
3. **Enable audit logging** if not already active
4. **Lock down access** — remove all non-essential IAM members
5. **Contact Google Cloud Support** for forensic investigation

**Data Recovery:**

1. Create a new Firebase project (see `STAGING_PROJECT_RUNBOOK.md`)
2. Import latest backup into the new project
3. Update all environment variables and redeploy
4. Notify users of the security incident (GDPR Article 33: 72 hours)

---

### Scenario 4: Cloud Functions Failure

**Symptoms:** Payment processing stops, AI generation fails, webhooks unresponsive.

**Recovery Steps:**

1. Check Cloud Functions logs:

   ```bash
   firebase functions:log --only <function_name>
   ```

2. Verify function deployment status:

   ```bash
   gcloud functions list --project=indiiOS-v-1-1
   ```

3. Redeploy from last known good commit:

   ```bash
   git checkout <last_known_good_sha>
   firebase deploy --only functions
   ```

4. If OOM crashes, increase memory allocation:

   ```bash
   gcloud functions deploy <function_name> --memory=2048MB
   ```

---

## Post-Incident Checklist

After any incident, complete the following within 48 hours:

- [ ] Root cause identified and documented
- [ ] Incident timeline written (start → detection → response → resolution)
- [ ] Preventive measures implemented
- [ ] Monitoring gaps addressed
- [ ] Error added to `.agent/skills/error_memory/ERROR_LEDGER.md`
- [ ] Affected users notified (if any data loss)
- [ ] If PII involved: GDPR notification within 72 hours to supervisory authority

---

## Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Firebase Support | GCP Console → Support | P1 for data loss |
| On-Call Engineer | [TBD — fill in] | PagerDuty |
| Legal/Privacy | [TBD — fill in] | For GDPR breach notification |

---

*Last updated: 2026-03-08 · Review quarterly*
