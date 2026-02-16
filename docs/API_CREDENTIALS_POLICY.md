# 🔒 API CREDENTIALS POLICY (PROTECTED DOCUMENT)

> [!CAUTION]
> **CHANGE CONTROL POLICY**
>
> This document is **READ-ONLY** for all AI agents.
>
> **NO AGENT may modify this file without EXPLICIT user approval.**
>
> If an agent suggests changes, they must:
>
> 1. Present the proposed change to the user
> 2. Wait for explicit written approval
> 3. Only then execute the modification
>
> **Violations are treated as terminal errors.**

---

## Current API Key Status

**Last Updated:** 2026-01-19T18:40:00-05:00  
**Updated By:** User + Antigravity Agent  
**Status:** ✅ OPERATIONAL

---

## Active Keys

### Primary AI Key: Gemini Developer API Key

| Property | Value |
| --- | --- |
| **Key ID** | `Gemini Developer API key` |
| **Project** | `indiios-v-1-1` |
| **Restrictions** | ✅ Restricted to **Generative Language API** |
| **Used In** | `.env` (VITE_API_KEY), `functions/.env` (GEMINI_API_KEY) |

### Firebase Auth Key: Browser key (auto-created by Firebase)

| Property | Value |
| --- | --- |
| **Key ID** | `Browser key (auto created by Firebase)` |
| **Project** | `indiios-v-1-1` |
| **Restrictions** | ✅ Restricted to 24 Firebase APIs (Identity Toolkit, etc.) |
| **Used In** | `.env` (VITE_FIREBASE_API_KEY) |

---

## Keys Requiring Attention

| Key Name | Issue | Recommended Action |
| --- | --- | --- |
| `indiiOS-Studio-Primary-2025` | ⚠️ Unrestricted | Add API restrictions |
| `API key 2` | ⚠️ Unrestricted | Add API restrictions or delete if unused |

---

## Environment Variable Mapping

```bash
# .env (Frontend - Vite)
VITE_API_KEY=<Gemini Developer API Key>
VITE_FIREBASE_API_KEY=<Gemini Developer API Key>

# functions/.env (Cloud Functions)
GEMINI_API_KEY=<Gemini Developer API Key>
```

---

## Validation Checklist (Before Any Key Change)

Before modifying API keys, verify:

- [ ] New key is from project `indiios-v-1-1` (NOT a different project)
- [ ] Key has appropriate API restrictions (not unrestricted)
- [ ] Key is not expired or about to expire
- [ ] Both `.env` AND `functions/.env` are updated together
- [ ] Dev server is restarted after changes (`npm run dev`)
- [ ] AI functionality is tested in browser after restart

---

## Incident Log

### 2026-01-19: Expired Key Incident

**Symptom:**

```text
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?alt=sse: [400] API key expired.
```

**Root Cause:**

- Original `VITE_API_KEY` expired
- First replacement key was from wrong project (686237393884)
- Second replacement key was unrestricted

**Resolution:**

- Used browser agent to access GCP Console
- Identified properly restricted "Gemini Developer API key"
- Updated all `.env` files
- Verified AI functionality in browser

**Lesson Learned:**

- Always verify key belongs to correct project before using
- Prefer restricted keys over unrestricted
- Test in browser after any key change

### 2026-01-19: Production Deployment Failure

**Symptom:**
Deployment pipeline succeeded, but production app (`indii-backend`) was running outdated code (Dec 1st build) and using expired keys.

**Root Cause:**

- `VITE_API_KEY` and other env vars in GitHub Actions were pulled from **stale GitHub Secrets**, not the repo's `.env` file.
- Deployment workflow was passing old secrets to the build process.

**Resolution:**

- Manually updated GitHub Secrets (`VITE_API_KEY`, `VITE_FIREBASE_API_KEY`) in Repo Settings.
- Triggered manual re-deploy.

**Lesson Learned:**

- **CI/CD Separation:** Updating local `.env` does NOT update the deployment pipeline.
- **Secret Sync:** Always update GitHub Secrets immediately after changing local keys.

---

## Deployment & CI/CD

The following secrets must be maintained in **GitHub Repo Settings > Secrets and variables > Actions**:

| Secret Name | Value Origin |
| --- | --- |
| `VITE_API_KEY` | `Gemini Developer API key` (Restricted) |
| `VITE_FIREBASE_API_KEY` | `Browser key` (from Firebase) |
| `VITE_VERTEX_PROJECT_ID` | `indiios-v-1-1` |
| `VITE_VERTEX_LOCATION` | `us-central1` |

> [!WARNING]
> CI/CD Pipeline (`deploy.yml`) injects these secrets at build time. Changing `.env` locally has **NO EFFECT** on production builds. You must update GitHub Secrets manually.

---

## Emergency Recovery

If AI stops working due to key issues:

1. **Check the error message** — look for project ID mismatch or "key expired"
2. **Go to GCP Console:** <https://console.cloud.google.com/apis/credentials?project=indiios-v-1-1>
3. **Use the "Gemini Developer API key"** (already restricted)
4. **Update both files:**
   - `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/.env`
   - `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/functions/.env`

```bash
# lsof -ti:4242 | xargs kill -9 2>/dev/null; sleep 1; npm run dev
```

1. **Test:** Send a message in the Creative Orchestrator

---

## Firebase API Key Architecture & Management

Based on best practices, Firebase API keys follow a different security model than typical backend secrets:

### 1. The Nature of Firebase API Keys

Unlike typical API keys, Firebase API keys are **not used for authorization** and do not need to be treated as high-risk secrets. They serve to **identify** your Firebase project and associate requests with it for quota and billing purposes.
- **Safety:** It is safe to include these keys in your code or checked-in configuration files.
- **Authorization:** Access to backend resources (database, storage, etc.) must be controlled via **Firebase Security Rules** and **App Check**, not by hiding the API key.

### 2. API Restrictions

While keys aren't secrets, they must still be restricted to limit their scope.
- **Allowlisting:** Restrict API keys to only the specific APIs required (e.g., Identity Toolkit, Firestore).
- **Caution:** When modifying restrictions, ensure you do not remove required APIs (like `firebaseinstallations.googleapis.com` or `identitytoolkit.googleapis.com`), which would cause app failure.

### 3. Service Separation

If using other Google Cloud APIs (Maps, Vision), create **separate, restricted API keys** for those services. This allows for granular rotation or revocation without disrupting core Firebase functionality.

### 4. Environment Isolation

Do not share API keys across testing, staging, and production.
- **Project Isolation:** Ensure staging apps interact only with staging Firebase projects.
- **Configuration:** Use environment variables or configuration files to inject the correct keys for the current environment rather than hardcoding.

### 5. Quota Management

To prevent abuse (e.g., brute-force attacks):
- **Tighten Quotas:** Lower default quotas for sensitive endpoints like `identitytoolkit.googleapis.com` in the GCP Console to match expected traffic.

### 6. Client-Side Security Logic

Since configuration files are public in web/mobile apps, **never trust client-side configurations** for security. Always enforce validation and authorization on the server-side via Security Rules.

---

## Agent Instructions

> [!IMPORTANT]
> **FOR ALL AI AGENTS:**
>
> 1. **You MAY NOT modify `.env` files** without explicit user approval.
> 2. **You MAY NOT generate or rotate API keys** without explicit user approval.
> 3. **Firebase API Keys (`AIza*`) are identifiers**, not secrets. They are safe for inclusion in public-facing configuration files, but preferred to be managed via env vars for environment isolation.
> 4. **True Secrets** (Service Account Keys, Stripe Secrets, etc.) MUST NEVER be hardcoded.
> 5. **You MUST reference this document** when handling credential issues.

---

**Document Hash:** `sha256:API_CREDENTIALS_POLICY_V2_2026-01-25`
