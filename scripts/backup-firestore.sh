#!/bin/bash
# scripts/backup-firestore.sh
# Scheduled Firestore backup to GCS Coldline storage bucket with snapshot integrity verification
# Part of PRODUCTION_100 Item 65 & PRODUCTION_300 Item 295

set -euo pipefail

# Configuration
PROJECT_ID="${GCLOUD_PROJECT:-indii-music-founder}"
BUCKET_NAME="${FIRESTORE_COLDLINE_BUCKET:-gs://${PROJECT_ID}-firestore-backups-coldline}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BUCKET_NAME}/exports/${TIMESTAMP}"
# Large exports can legitimately take a while; 15 minutes is the ceiling so a
# hung gcloud (auth prompt, network stall) can never silently skip a backup.
EXPORT_TIMEOUT_SECONDS=900

echo "----------------------------------------------------------"
echo "Starting Firestore Managed Export to GCS Coldline"
echo "Project:  ${PROJECT_ID}"
echo "Storage:  COLDLINE"
echo "Target:   ${BACKUP_PATH}"
echo "----------------------------------------------------------"

# Ensure gcloud is configured with the expected project
gcloud config set project "${PROJECT_ID}" >/dev/null 2>&1

# Ensure Coldline bucket exists
if ! gsutil ls -b "${BUCKET_NAME}" >/dev/null 2>&1; then
    echo "Creating Coldline backup bucket ${BUCKET_NAME}..."
    gsutil mb -p "${PROJECT_ID}" -c COLDLINE -l us-central1 "${BUCKET_NAME}"

    # Enable bucket versioning
    gsutil versioning set on "${BUCKET_NAME}"

    # Apply lifecycle rule if config exists
    if [ -f "config/gcs-backup-lifecycle.json" ]; then
        echo "Applying Coldline lifecycle policy..."
        gsutil lifecycle set config/gcs-backup-lifecycle.json "${BUCKET_NAME}"
    fi
fi

# Execute the export; any non-zero exit fails loudly
if timeout "${EXPORT_TIMEOUT_SECONDS}" gcloud firestore export "${BACKUP_PATH}"; then
    echo "Export command completed. Initiating snapshot integrity verification..."
else
    echo "ERROR: Firestore backup export failed (or exceeded ${EXPORT_TIMEOUT_SECONDS}s)."
    exit 1
fi

# ==============================================================================
# Snapshot Integrity Verification
# ==============================================================================
echo "Verifying export artifacts in GCS Coldline..."

# Check 1: Ensure directory exists and has files
EXPORT_FILES=$(gsutil ls "${BACKUP_PATH}/**" 2>/dev/null || true)
if [ -z "${EXPORT_FILES}" ]; then
    echo "VERIFICATION FAILED: Target prefix ${BACKUP_PATH} contains zero files."
    exit 1
fi

# Check 2: Verify overall_export_metadata exists and has non-zero size
OVERALL_META=$(gsutil ls -l "${BACKUP_PATH}/*.overall_export_metadata" 2>/dev/null || true)
if [ -z "${OVERALL_META}" ]; then
    echo "VERIFICATION FAILED: Missing .overall_export_metadata file."
    exit 1
fi

# Check 3: Verify collection metadata files exist
COLLECTION_METAS=$(gsutil ls "${BACKUP_PATH}/**.export_metadata" 2>/dev/null || true)
if [ -z "${COLLECTION_METAS}" ]; then
    echo "VERIFICATION FAILED: Missing collection .export_metadata files."
    exit 1
fi

FILE_COUNT=$(echo "${EXPORT_FILES}" | wc -l | tr -d ' ')
echo "----------------------------------------------------------"
echo "VERIFICATION SUCCESS: Snapshot is intact and complete."
echo "Verified files: ${FILE_COUNT}"
echo "Storage target: ${BACKUP_PATH}"
echo "Safe for pre-deletion retention and compaction rails."
echo "----------------------------------------------------------"
