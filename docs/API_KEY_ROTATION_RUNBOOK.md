# API Key Rotation Runbook

## Item 256: Step-by-Step Key Rotation Procedure

### Overview

This document provides the procedure for rotating API keys and secrets used by the indiiOS platform. Each section covers a specific credential, the rotation steps, and which services need redeployment.

---

## 1. Firebase API Key Rotation

> **Important:** Firebase API keys are identifiers, not secrets. They identify the project but don't provide authorization. Rotation is optional and primarily for quota management.

### When to Rotate

- Suspected abuse or quota manipulation
- Key restrictions change needed

### Steps

1. **Generate new key** in GCP Console → APIs & Services → Credentials
2. **Apply restrictions** to the new key:
   - Application restriction: HTTP referrers (`app.indiios.com`, `localhost:4242`)
   - API restriction: Identity Toolkit, Cloud Firestore, Cloud Storage, Firebase Cloud Messaging
3. **Update environment variables:**

   ```bash
   # .env (local)
   VITE_FIREBASE_API_KEY=<new-key>
   
   # GitHub Actions Secrets
   # Settings → Secrets → Actions → VITE_FIREBASE_API_KEY → Update
   ```

4. **Redeploy:**

   ```bash
   npm run deploy         # Firebase Hosting (web app)
   npm run build:desktop  # Electron desktop builds
   ```

5. **Disable old key** in GCP Console after confirming new key works

### Services Affected

- Firebase Hosting (web app)
- Electron desktop app (requires new build + distribution)
- Any CI/CD pipeline using the key

---

## 2. Gemini API Key Rotation

### When to Rotate

- Monthly rotation recommended
- If key is suspected compromised
- After personnel changes

### Steps

1. **Generate new key** in Google AI Studio → API Keys
2. **Update environment variables:**

   ```bash
   # .env (local)
   VITE_API_KEY=<new-gemini-key>
   
   # GitHub Actions Secrets
   # Settings → Secrets → Actions → VITE_API_KEY → Update
   ```

3. **Redeploy:**

   ```bash
   npm run deploy  # Web app
   ```

4. **Revoke old key** in Google AI Studio after confirming new key works

### Services Affected

- All AI generation features (image, video, text, TTS)
- Agent Zero sidecar (if using client-side key passthrough)
- Cloud Functions (if server-side AI calls use this key)

---

## 3. Stripe Secret Key Rotation

### When to Rotate

- Quarterly rotation recommended
- After personnel changes
- If key is suspected compromised

### Steps

1. **Generate new key** in Stripe Dashboard → Developers → API Keys → Create restricted key
2. **Update Cloud Functions environment:**

   ```bash
   firebase functions:config:set stripe.secret_key=<new-key>
   ```

3. **Update GitHub Actions Secrets** for CI testing
4. **Deploy functions:**

   ```bash
   cd functions && npm run deploy
   ```

5. **Verify** by processing a test payment in the staging environment
6. **Roll old key** once all active subscriptions have processed at least one cycle

### Services Affected

- Cloud Functions (payment processing)
- Stripe webhook endpoint (verify webhook secret separately)

### ⚠️ CRITICAL

- **Never** rotate the Stripe webhook signing secret (`whsec_...`) simultaneously with the API key
- Test with a $0.50 charge before rotating production

---

## 4. Sentry DSN Rotation

### When to Rotate

- If DSN is leaked in a public commit (check gitleaks output)
- After Sentry project reconfiguration

### Steps

1. **Find new DSN** in Sentry → Settings → Projects → indiiOS → Client Keys → DSN
2. **Update environment variables:**

   ```bash
   # .env (local)
   VITE_SENTRY_DSN=<new-dsn>
   
   # GitHub Actions Secrets
   # Settings → Secrets → Actions → VITE_SENTRY_DSN → Update
   ```

3. **Redeploy:**

   ```bash
   npm run deploy
   ```

4. **Revoke old DSN** in Sentry → Client Keys → Disable

### Services Affected

- Web app error reporting
- No backend changes needed

---

## 5. Firebase Service Account Key Rotation

### When to Rotate

- Every 90 days (Google recommends)
- If key file is suspected leaked

### Steps

1. **Generate new key** in GCP Console → IAM → Service Accounts → firebase-adminsdk → Keys → Add Key
2. **Download** the new JSON key file
3. **Update GitHub Actions Secret:**
   - Encode: `base64 < new-key.json`
   - Update `FIREBASE_SERVICE_ACCOUNT` secret in GitHub
4. **Update any local deployments** that reference the key file
5. **Delete old key** in GCP Console after confirming CI passes

### Services Affected

- GitHub Actions deployments
- Any server-side Firebase Admin SDK usage

---

## Emergency Rotation Checklist

If a key is confirmed compromised:

1. [ ] Generate new key immediately (don't wait for a rotation window)
2. [ ] Update all environments (production, staging, CI) simultaneously
3. [ ] Deploy to production within 30 minutes
4. [ ] Revoke/disable the old key
5. [ ] Check audit logs for unauthorized usage during the exposure window
6. [ ] File an incident report in `.agent/skills/error_memory/ERROR_LEDGER.md`

---

*Document owner: Engineering · Last updated: 2026-03-08*
