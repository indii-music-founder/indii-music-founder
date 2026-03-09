# Key Rotation Runbook — Item 256

Step-by-step procedure for rotating API keys and secrets without downtime.

---

## 1. Firebase API Key

Firebase API keys are **identifiers** (not secrets). They restrict which APIs the client SDK can call. Rotation is low-risk.

### Steps:
1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Select the existing Browser Key for `indiiOS`
3. Click **Regenerate Key** (old key remains valid during propagation)
4. Update `VITE_FIREBASE_API_KEY` in:
   - Vercel/Firebase Hosting environment variables
   - GitHub Actions secrets: `VITE_FIREBASE_API_KEY`
   - Local `.env` file
5. Deploy: `npm run deploy`
6. Verify app loads and Firebase Auth / Firestore work correctly
7. Delete the old key after 24h (allow CDN cache flush)
8. **No Cloud Function redeployment required** (Functions use service account credentials, not API keys)

---

## 2. Gemini / Vertex AI API Key

### Steps:
1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a new API key restricted to: `Generative Language API` + `Vertex AI API`
3. Update `VITE_API_KEY` in:
   - Firebase Hosting environment variables
   - GitHub Actions secrets: `VITE_API_KEY`
   - Local `.env`
4. Also update `VITE_VERTEX_PROJECT_ID` if the project changes
5. Deploy: `npm run deploy`
6. Verify: Open app, run an AI generation in Creative Studio
7. Delete old key from GCP console after 1h monitoring

---

## 3. Stripe Secret Key

**This is a TRUE SECRET — never commit to version control.**

### Steps:
1. Log in to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys)
2. Click **Roll key** on the Secret Key (`sk_live_*`)
3. Update in Firebase Secret Manager:
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```
4. Redeploy Cloud Functions:
   ```bash
   cd functions && npm run build && firebase deploy --only functions
   ```
5. Verify: Test a subscription payment in Stripe test mode first
6. Monitor Stripe Dashboard for webhook errors after rotation
7. Old key is automatically invalidated after rolling

### Stripe Webhook Secret:
1. Go to [Stripe → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Reveal signing secret**
3. If rotating: Delete old endpoint, create new one, update `STRIPE_WEBHOOK_SECRET` in Secret Manager
4. Redeploy functions

---

## 4. Firebase Service Account (CI/CD)

Used by GitHub Actions for deployment.

### Steps:
1. Go to [Firebase Console → Project Settings → Service Accounts](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk)
2. Click **Generate new private key**
3. Go to GitHub → Repo → Settings → Secrets → Actions
4. Update `FIREBASE_SERVICE_ACCOUNT` with the new JSON (base64 encoded or raw)
5. Trigger a test deployment via `workflow_dispatch`
6. Verify build succeeds and app is deployed
7. Delete the old service account key from Firebase Console (do NOT delete the service account itself)

---

## 5. PandaDoc API Key

Managed as a Firebase Secret (server-side only, never client-side).

### Steps:
1. Log in to [PandaDoc Developer Portal](https://app.pandadoc.com/a/#/settings/developers)
2. Generate a new API key
3. Update in Firebase:
   ```bash
   firebase functions:secrets:set PANDADOC_API_KEY
   ```
4. Redeploy Cloud Functions:
   ```bash
   firebase deploy --only functions:pandadocListTemplates,functions:pandadocCreateDocument,functions:pandadocSendDocument
   ```
5. Test: Create a document from the Legal panel in the app

---

## 6. Pinata JWT (IPFS)

### Steps:
1. Log in to [Pinata Cloud → API Keys](https://app.pinata.cloud/keys)
2. Generate a new JWT with `pinFileToIPFS` + `pinJSONToIPFS` + `unpin` scopes
3. Update `VITE_PINATA_JWT` in hosting environment variables
4. Revoke old JWT from Pinata dashboard
5. Test: Navigate to Merchandise → Blockchain Ledger → Sync to IPFS

---

## 7. WalletConnect Project ID

This is a **public identifier** (like a Firebase API key) — not a secret. However, unauthorized use can exhaust your quota.

### Steps:
1. Log in to [Reown Cloud (WalletConnect)](https://cloud.reown.com)
2. Create a new project or rotate the Project ID
3. Update `VITE_WALLETCONNECT_PROJECT_ID` in hosting environment
4. No redeployment of server-side services required

---

## Post-Rotation Checklist

After rotating any key:

- [ ] Old key deleted / revoked from source system
- [ ] New key verified working in production
- [ ] GitHub Actions secrets updated
- [ ] Firebase Hosting environment updated
- [ ] Local `.env` updated (never commit this file)
- [ ] Cloud Functions redeployed if the key is used server-side
- [ ] Monitoring checked for auth errors in the 24h after rotation
- [ ] Slack/email notification sent to engineering team
- [ ] Rotation recorded in the Key Rotation Log (Firestore `admin/keyRotationLog`)

---

*Last updated: 2026-03-08. Review quarterly or after any security incident.*
