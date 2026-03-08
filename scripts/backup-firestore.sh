#!/bin/bash
# scripts/backup-firestore.sh
# Scheduled Firestore backup to GCS bucket (Daily)
# Part of PRODUCTION_100 Item 65

# Configuration
PROJECT_ID="indiios-v-1-1"
BUCKET_NAME="gs://indiios-alpha-electron-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BUCKET_NAME}/${TIMESTAMP}"

echo "----------------------------------------------------------"
echo "Starting Firestore Backup for ${PROJECT_ID}"
echo "Target: ${BACKUP_PATH}"
echo "----------------------------------------------------------"

# Ensure gcloud is authenticated and pointed to the right project
gcloud config set project ${PROJECT_ID}

# Create backup bucket if it doesn't exist (optional, usually pre-created)
# gsutil mb -p ${PROJECT_ID} -c nearline -l us-central1 ${BUCKET_NAME} 2>/dev/null

# Execute the export
gcloud firestore export ${BACKUP_PATH}

if [ $? -eq 0 ]; then
    echo "SUCCESS: Firestore backup completed."
    # Optional: Webhook to Slack/Discord or internal monitoring
    # curl -X POST -H 'Content-type: application/json' --data '{"text":"Firestore Backup SUCCESS: '${TIMESTAMP}'"}' ${BACKUP_WEBHOOK_URL}
else
    echo "ERROR: Firestore backup failed."
    exit 1
fi

echo "----------------------------------------------------------"
echo "Backup execution finished."
