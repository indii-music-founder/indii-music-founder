# Firestore Backup & Disaster Recovery Runbook

## Item 295: Automated Daily Firestore Export

### Overview

This runbook documents the automated daily Firestore backup strategy and
the disaster recovery procedure for a full data loss event.

---

## Backup Architecture

```
Cloud Scheduler (daily 2:00 AM UTC)
    ↓ triggers
Cloud Function (firestore-backup)
    ↓ calls
gcloud firestore export → gs://indii-backups/firestore/YYYY-MM-DD/
```

---

## Step 1: Create Backup GCS Bucket

```bash
# Create a dedicated backup bucket with versioning
gsutil mb -p indii-v-1-1 -l us-central1 gs://indii-backups

# Enable versioning for additional protection
gsutil versioning set on gs://indii-backups

# Set lifecycle rule: delete backups older than 90 days
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 90 }
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://indii-backups
```

## Step 2: Grant Firestore Export Permissions

```bash
# Get the default service account
SA=$(gcloud iam service-accounts list --project=indii-v-1-1 \
  --filter="email:firebase-adminsdk" --format="value(email)")

# Grant Firestore export permissions
gcloud projects add-iam-policy-binding indii-v-1-1 \
  --member="serviceAccount:$SA" \
  --role="roles/datastore.importExportAdmin"

# Grant Storage write access
gsutil iam ch serviceAccount:$SA:objectCreator gs://indii-backups
```

## Step 3: Create Cloud Function

```typescript
// functions/src/backup/firestoreBackup.ts
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

export const scheduledFirestoreBackup = functions
  .pubsub.schedule('0 2 * * *')  // Daily at 2:00 AM UTC
  .timeZone('America/New_York')
  .onRun(async () => {
    const client = new admin.firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || 'indii-v-1-1';
    const databaseName = client.databasePath(projectId, '(default)');

    const date = new Date().toISOString().split('T')[0];
    const bucket = `gs://indii-backups/firestore/${date}`;

    const [response] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: bucket,
      collectionIds: [], // Empty = all collections
    });

    console.log(`[Backup] Export started: ${response.name}`);
    console.log(`[Backup] Destination: ${bucket}`);
  });
```

## Step 4: Set Up Cloud Scheduler (Alternative to Cloud Function)

```bash
# Using gcloud directly (alternative to Cloud Function above)
gcloud scheduler jobs create http firestore-daily-backup \
  --project=indii-v-1-1 \
  --schedule="0 2 * * *" \
  --time-zone="America/New_York" \
  --uri="https://firestore.googleapis.com/v1/projects/indii-v-1-1/databases/(default):exportDocuments" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"outputUriPrefix":"gs://indii-backups/firestore/"}' \
  --oauth-service-account-email="firebase-adminsdk@indii-v-1-1.iam.gserviceaccount.com"
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
  --project=indii-v-1-1
```

### Step 3: Verify Data

```bash
# Run a count query to verify collections are populated
firebase firestore:list --project=indii-v-1-1
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
