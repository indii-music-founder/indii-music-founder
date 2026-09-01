# Firestore Backup & Disaster Recovery Runbook

## Item 295: Automated Daily Firestore Export

### Overview

This runbook documents the automated daily Firestore backup strategy and
the disaster recovery procedure for a full data loss event.

---

## Backup & Database Health Architecture

```
Cloud Scheduler (Daily 02:00 UTC)
    ↓ triggers
Cloud Function v2: scheduledFirestoreColdlineExport (packages/firebase/src/devops/databaseMaintenance.ts)
    ↓ calls
admin.firestore.v1.FirestoreAdminClient.exportDocuments
    ↓ streams
gs://indii-music-founder-firestore-backups-coldline/exports/YYYY-MM-DDTHH-mm-ss/ (Storage Class: COLDLINE)

Cloud Scheduler (Daily 04:00 UTC)
    ↓ triggers
Cloud Function v2: purgeStaleDatabaseTelemetry
    ↓ verifies
Snapshot Integrity Rail: verifyExportSnapshot() checks GCS Coldline manifest & chunks < 48h
    ↓ (Aborts if snapshot missing/corrupted; dry-run unless enableDeletion=true)
Batched Document Compaction & Purge (agent_traces > 30d, ai_context_cache expired, orphaned notification_tokens)
```

---

## Step 1: Create Backup GCS Coldline Bucket

```bash
# Dedicated Coldline bucket for disaster recovery snapshots
gsutil mb -p indii-music-founder -c COLDLINE -l us-central1 gs://indii-music-founder-firestore-backups-coldline

# Enable versioning for object protection
gsutil versioning set on gs://indii-music-founder-firestore-backups-coldline

# Apply Coldline lifecycle policy (Coldline -> Archive at 90d -> Delete at 365d)
gsutil lifecycle set config/gcs-backup-lifecycle.json gs://indii-music-founder-firestore-backups-coldline
```

## Step 2: Grant Firestore Export & GCS Permissions

```bash
# Service account identity
SA="indii-music-founder@appspot.gserviceaccount.com"

# Grant Firestore export administrator role
gcloud projects add-iam-policy-binding indii-music-founder \
  --member="serviceAccount:$SA" \
  --role="roles/datastore.importExportAdmin"

# Grant Storage write and object viewer permissions on Coldline bucket
gsutil iam ch serviceAccount:$SA:roles/storage.admin gs://indii-music-founder-firestore-backups-coldline
```

## Step 3: Automated Cloud Functions (Scheduled)

The automated routines are defined in `packages/firebase/src/devops/databaseMaintenance.ts`:

1. **`scheduledFirestoreColdlineExport`**: Runs daily at 02:00 UTC. Initiates Firestore managed export of all collections to `gs://${BUCKET}/exports/${timestamp}` with Coldline storage class.
2. **`verifyExportSnapshot`**: Inspects the GCS target path, ensuring `.overall_export_metadata` and collection chunk `.export_metadata` files exist with `size > 0`.
3. **`purgeStaleDatabaseTelemetry`**: Runs daily at 04:00 UTC.
   - **Safety Rail**: Checks `getLatestVerifiedSnapshot(48)`. If no verified Coldline export exists within 48 hours, **aborts immediately** to protect against data loss.
   - **Dry-Run Rail**: Safe by default (`dryRun: true`). Set `admin/databaseMaintenance.enableDeletion=true` in Firestore to enable permanent deletions.
   - Purges stale `agent_traces` (> 30 days), expired `ai_context_cache`, orphaned/stale `notification_tokens` (> 90 days), expired `taxFormRequests`, and transient outbox events.
   - Writes run metrics to `admin/databaseMaintenance/runs/{runId}`.

## Step 4: Manual CLI Export & Verification Drill

Run the updated automated backup and verification script:

```bash
./scripts/backup-firestore.sh
```

---

## Disaster Recovery Procedure

### Recovery Time Objective (RTO): 2 hours

### Recovery Point Objective (RPO): 24 hours (last daily backup)

### Step 1: Identify Latest Backup

```bash
gsutil ls gs://indii-backups/firestore/ | tail -5
```

### Step 2: Import Backup

```bash
# Import the latest backup
gcloud firestore import gs://indii-backups/firestore/YYYY-MM-DD/ \
  --project=indii-music-founder
```

### Step 3: Verify Data

```bash
# Run a count query to verify collections are populated
firebase firestore:list --project=indii-music-founder
```

### Step 4: Notify Users

If the incident affected users, send a notification via the in-app toast system
and email to affected accounts.

---

## Monitoring

Set up alerts for backup failures:

```bash
gcloud monitoring policies create \
  --display-name="Firestore Backup Failure" \
  --condition-display-name="No backup in 36 hours" \
  --notification-channels=CHANNEL_ID
```

---

*Document owner: Engineering · Last updated: 2026-03-08*
