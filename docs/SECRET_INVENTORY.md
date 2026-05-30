# indii Secret Inventory & Security Audit (v1.64.0)

This document provides a comprehensive inventory of all sensitive credentials, API keys, and secrets used by the indii platform. It serves as the master record for the "Official Official" secret rotation plan.

## ⚠️ SECURITY POLICY
- **NO HARDCODING:** Secrets must NEVER be committed to version control.
- **ENVIRONMENT ISOLATION:** Use separate keys for Production, Staging, and Development.
- **SECRET MANAGER:** Backend secrets must be stored in Google Secret Manager or Firebase Secrets.
- **ROTATION:** Follow the [API Key Rotation Runbook](./API_KEY_ROTATION_RUNBOOK.md).

---

## 1. Core Infrastructure (GCP / Firebase)

| Secret Name | Usage | Location | Status |
| --- | --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Frontend Firebase SDK | `.env`, GitHub Secrets | ✅ IDENTIFIER |
| `FIREBASE_SERVICE_ACCOUNT` | GitHub Actions Deployment | GitHub Secrets (Base64) | 🔐 SECRET |
| `VITE_FIREBASE_APP_CHECK_KEY` | ReCAPTCHA Enterprise | `.env`, GitHub Secrets | 🔐 SECRET |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local Backend Dev | Local Path (not in repo) | 🔐 SECRET |

## 2. Intelligence & AI Services

| Secret Name | Usage | Location | Status |
| --- | --- | --- | --- |
| `VITE_API_KEY` | Gemini API (Frontend/Sidecar) | `.env`, GitHub Secrets | 🔐 SECRET |
| `GEMINI_API_KEY` | Gemini API (Functions) | `functions/.env`, Firebase Secrets | 🔐 SECRET |
| `VITE_VERTEX_PROJECT_ID` | Vertex AI Configuration | `.env`, GitHub Secrets | ✅ IDENTIFIER |
| `VITE_MEM0_API_KEY` | Episodic Memory API | `.env`, GitHub Secrets | 🔐 SECRET |

## 3. Financial & Legal (Stripe / DocuSign)

| Secret Name | Usage | Location | Status |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | Payment Processing | Firebase Secrets | 🔐 SECRET |
| `STRIPE_WEBHOOK_SECRET` | Webhook Verification | Firebase Secrets | 🔐 SECRET |
| `VITE_DOCUSIGN_ACCESS_TOKEN` | Contract Management | `.env` (Manual) | 🔐 SECRET |
| `VITE_NOTARIZE_API_KEY` | Legal Verification | `.env` | 🔐 SECRET |

## 4. Distribution & Industry (DSPs)

| Secret Name | Usage | Location | Status |
| --- | --- | --- | --- |
| `DSP_SFTP_PASSWORD` | Spotify/Apple SFTP | Keytar / Secret Manager | 🔐 SECRET |
| `DSP_SFTP_SSH_KEY` | Secure File Uploads | `.ssh/` (Local) | 🔐 SECRET |
| `VITE_APPLE_MUSIC_DEV_TOKEN` | Music Data Fetching | `.env` | 🔐 SECRET |

## 5. Desktop & Platform (Electron / GitHub)

| Secret Name | Usage | Location | Status |
| --- | --- | --- | --- |
| `APPLE_ID_PASSWORD` | macOS App Notarization | Keychain / CI Secret | 🔐 SECRET |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Windows/Mac Signing | GitHub Secrets | 🔐 SECRET |
| `GITHUB_PLATFORM_KEY` | Automated Workflows | `.env` (Temporary) | 🔐 SECRET |
| `SENTRY_AUTH_TOKEN` | Source Map Uploads | GitHub Secrets | 🔐 SECRET |

---

## 6. Licenses & Paid Subscriptions (The "To-Pay" List)

Based on the [PRODUCTION_100.md](./PRODUCTION_100.md) and [TOP_50_PLATINUM_RELEASE.md](./TOP_50_PLATINUM_RELEASE.md) audits, the following licenses/accounts require active maintenance or payment:

1. **Apple Developer Program ($99/yr):** Required for macOS code signing and notarization.
2. **Microsoft Partner Center ($99/once):** Required for Windows app certification/signing.
3. **Google Cloud Billing (GCP):** For Gemini/Vertex AI tokens (scales with usage).
4. **Firebase Blaze Plan:** Pay-as-you-go for Functions, Firestore, and Storage.
5. **Stripe Connect:** Account maintenance and transaction fees.
6. **Sentry.io:** For error tracking (Free tier currently, may require growth plan).
7. **Mem0.ai:** Managed memory service (Paid tier for production scale).
8. **GitHub Pro/Teams:** For private repo features and Action minutes.
9. **DSPs (Optional):** Some distributors require annual fees or ISRC assignment fees.

---

## 7. Secret Audit (2026-05-30)

- [x] **Hardcoded Scan:** Performed `grep` audit for `sk-`, `AIza`, `ghp_`, `AKIA`.
- [x] **Results:** No hardcoded secrets found in `src/`, `functions/`, or `electron/`.
- [x] **Temporary Keys:** Identified `GITHUB_PLATFORM_KEY` as a temporary workflow key.
- [x] **Rotation Readiness:** All primary keys are mapped to environment variables.

**Next Audit Scheduled:** 2026-08-16 (90-day cycle)
