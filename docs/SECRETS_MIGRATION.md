# Secrets Migration to Google Secret Manager

> Item 297: Migrate from GitHub Actions secrets and local `.env` files to Google Cloud Secret Manager for fine-grained IAM access control.

## Overview

Currently, secrets are stored in:

1. **GitHub Actions Secrets** — Used in CI/CD pipelines
2. **Local `.env` files** — Used during development
3. **Firebase Functions secrets** — Defined via `defineSecret()` in `functions/src/config/secrets.ts`

This runbook migrates production secrets to **Google Cloud Secret Manager** for centralized, auditable, IAM-controlled access.

---

## Secrets Inventory

| Secret | Current Location | Priority |
| ------ | ---------------- | -------- |
| `GEMINI_API_KEY` | GH Actions + `.env` | Critical |
| `STRIPE_SECRET_KEY` | GH Actions | Critical |
| `STRIPE_WEBHOOK_SECRET` | GH Actions | Critical |
| `INNGEST_EVENT_KEY` | Functions secrets | High |
| `INNGEST_SIGNING_KEY` | Functions secrets | High |
| `SENTRY_DSN` | `.env` | Medium |
| `FIREBASE_SERVICE_ACCOUNT` | GH Actions | Critical |

---

## Migration Steps

### 1. Create Secrets in Secret Manager

```bash
# For each secret:
echo -n "YOUR_SECRET_VALUE" | gcloud secrets create GEMINI_API_KEY \
  --data-file=- \
  --project=indiios-production \
  --replication-policy="automatic"

# Repeat for all secrets in the inventory
```

### 2. Grant IAM Access

```bash
# Cloud Functions service account (for runtime access)
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:indiios-production@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=indiios-production

# CI/CD service account (for deployment)
gcloud secrets add-iam-policy-binding FIREBASE_SERVICE_ACCOUNT \
  --member="serviceAccount:github-actions@indiios-production.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=indiios-production
```

### 3. Update Cloud Functions to Use Secret Manager

Cloud Functions already use `defineSecret()` from `firebase-functions/params`. No changes needed — Firebase Functions automatically integrates with Secret Manager.

```typescript
// functions/src/config/secrets.ts (already correct)
import { defineSecret } from 'firebase-functions/params';

export const geminiApiKey = defineSecret('GEMINI_API_KEY');
export const inngestEventKey = defineSecret('INNGEST_EVENT_KEY');
```

### 4. Update GitHub Actions

Replace hardcoded GitHub secrets with Workload Identity Federation:

```yaml
# .github/workflows/deploy.yml
- id: auth
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github'
    service_account: 'github-actions@indiios-production.iam.gserviceaccount.com'

- id: get-secrets
  uses: google-github-actions/get-secretmanager-secrets@v2
  with:
    secrets: |-
      GEMINI_API_KEY:indiios-production/GEMINI_API_KEY
      STRIPE_SECRET_KEY:indiios-production/STRIPE_SECRET_KEY
```

### 5. Rotate All Secrets Post-Migration

After migration, rotate every secret to invalidate the old values stored in GitHub:

1. Generate new API key in provider dashboard
2. Update Secret Manager version: `gcloud secrets versions add SECRET_NAME --data-file=-`
3. Remove old GitHub Actions secret
4. Redeploy Cloud Functions

---

## Verification Checklist

- [ ] All secrets created in Secret Manager
- [ ] IAM bindings verified for service accounts
- [ ] Cloud Functions deploy successfully with Secret Manager
- [ ] GitHub Actions use Workload Identity Federation
- [ ] Old GitHub secrets removed
- [ ] All secrets rotated post-migration
- [ ] Audit log confirms no unauthorized access

---

> **Important:** Never delete a secret version until all deployments using it have been updated. Use `gcloud secrets versions disable` first.
