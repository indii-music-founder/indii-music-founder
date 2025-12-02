#!/bin/bash

# Configure Secrets for indiiOS Backend
# Usage: ./configure_secrets.sh

echo "Configuring Secrets for indiiOS..."

# Ensure Firebase CLI is logged in
if ! firebase login --interactive --reauth; then
    echo "Error: Failed to authenticate with Firebase."
    exit 1
fi

# Set the project
read -p "Enter Firebase Project ID: " PROJECT_ID
firebase use $PROJECT_ID

# Define Secrets
SECRETS=(
    "GEMINI_API_KEY"
    "VEO_API_KEY"
    "IMAGEN_API_KEY"
    "INNGEST_SIGNING_KEY"
    "INNGEST_EVENT_KEY"
)

for SECRET in "${SECRETS[@]}"; do
    echo "Configuring $SECRET..."
    read -s -p "Enter value for $SECRET: " VALUE
    echo ""
    
    # Check if secret exists, if so, add a new version
    if firebase functions:secrets:get $SECRET > /dev/null 2>&1; then
        echo "$VALUE" | firebase functions:secrets:set $SECRET
    else
        echo "$VALUE" | firebase functions:secrets:set $SECRET
    fi
done

echo "Secrets configured successfully!"
echo "Granting access to service account..."

# Grant access to the default compute service account (often used by functions)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for SECRET in "${SECRETS[@]}"; do
    gcloud secrets add-iam-policy-binding $SECRET \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID
done

echo "Access granted."
