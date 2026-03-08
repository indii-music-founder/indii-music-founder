# Staging Firebase Project Runbook

## Item 293: Create `indiiOS-staging` Firebase Project

### Overview

This runbook documents how to create and configure a staging Firebase project
that is fully isolated from production, preventing dev/test data from contaminating
the production database.

---

## Step 1: Create the GCP Project

```bash
# Create project
gcloud projects create indiiOS-staging --name="indiiOS Staging"

# Link to billing account
gcloud billing projects link indiiOS-staging --billing-account=BILLING_ACCOUNT_ID
```

## Step 2: Initialize Firebase

```bash
firebase projects:addfirebase --project indiiOS-staging
```

## Step 3: Enable Required Services

```bash
# Authentication
firebase auth:import --project indiiOS-staging

# Firestore
firebase firestore:databases:list --project indiiOS-staging
# If empty, create:
gcloud firestore databases create --project=indiiOS-staging --location=us-central

# Storage
gsutil mb -p indiiOS-staging gs://indiiOS-staging.appspot.com

# Cloud Functions
gcloud services enable cloudfunctions.googleapis.com --project=indiiOS-staging
```

## Step 4: Configure Auth Providers

In Firebase Console → indiiOS-staging → Authentication → Sign-in method:

1. Enable **Email/Password**
2. Enable **Google** (configure OAuth consent screen)
3. Enable **Anonymous** (for dev only)

## Step 5: Deploy Security Rules

```bash
firebase deploy --only firestore:rules,storage --project indiiOS-staging
```

## Step 6: Create `.env.staging`

```env
VITE_FIREBASE_API_KEY=<staging-api-key>
VITE_FIREBASE_PROJECT_ID=indiiOS-staging
VITE_FIREBASE_AUTH_DOMAIN=indiiOS-staging.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=indiiOS-staging.appspot.com
VITE_FIREBASE_APP_ID=<staging-app-id>
VITE_SENTRY_DSN=<staging-sentry-dsn>
```

## Step 7: Add CI Environment

In GitHub Actions, create an `environment: staging` that uses the staging secrets.
PR preview deploys should target the staging project:

```yaml
- name: Deploy preview to staging
  run: firebase hosting:channel:deploy preview-${{ github.head_ref }} --project indiiOS-staging
```

## Step 8: Verification

1. Deploy to staging: `firebase deploy --project indiiOS-staging`
2. Open the staging URL and verify auth works
3. Create a test user and verify Firestore data lands in the staging project
4. Confirm production Firestore is unaffected

---

## Rollback

If the staging project needs to be deleted:

```bash
gcloud projects delete indiiOS-staging
```

---

*Document owner: Engineering · Last updated: 2026-03-08*
