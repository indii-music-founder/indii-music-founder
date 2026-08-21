#!/bin/bash
# scripts/backup-firestore.sh
# Scheduled Firestore backup to GCS bucket (Daily)
# Part of PRODUCTION_100 Item 65

set -euo pipefail

# Configuration
PROJECT_ID="indii-music-founder"
BUCKET_NAME="gs://indii-alpha-electron-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BUCKET_NAME}/${TIMESTAMP}"
# Large exports can legitimately take a while; 15 minutes is the ceiling so a
# hung gcloud (auth prompt, network stall) can never silently skip a backup.
EXPORT_TIMEOUT_SECONDS=900

echo "----------------------------------------------------------"
echo "Starting Firestore Backup for ${PROJECT_ID}"
echo "Target: ${BACKUP_PATH}"
echo "----------------------------------------------------------"

# Ensure gcloud is authenticated and pointed to the right project
gcloud config set project "${PROJECT_ID}"

# Create backup bucket if it doesn't exist (optional, usually pre-created)
# gsutil mb -p ${PROJECT_ID} -c nearline -l us-central1 ${BUCKET_NAME} 2>/dev/null

# Execute the export; any non-zero exit (including the timeout kill) fails the
# script loudly instead of silently pretending the backup happened.
if timeout "${EXPORT_TIMEOUT_SECONDS}" gcloud firestore export "${BACKUP_PATH}"; then
    echo "SUCCESS: Firestore backup completed."
    # Optional: Webhook to Slack/Discord or internal monitoring
    # curl -X POST -H 'Content-type: application/json' --data '{"text":"Firestore Backup SUCCESS: '${TIMESTAMP}'"}' ${BACKUP_WEBHOOK_URL}
else
    echo "ERROR: Firestore backup failed (or exceeded ${EXPORT_TIMEOUT_SECONDS}s)."
    exit 1
fi

echo "----------------------------------------------------------"
echo "Backup execution finished."
