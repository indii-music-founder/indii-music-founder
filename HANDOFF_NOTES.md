# indiiOS Electron App - Handoff Notes

**Date:** 2025-12-07
**Status:** CI/CD deployment still failing, Firebase config fixes complete

---

## Summary of Work Done

### 1. Firebase Configuration Unified (COMPLETED)

**Problem:** Landing page used `architexture-ai-api` project, studio used mixed configs with `indiios-alpha-electron-1` references.

**Fix:** Updated both apps to use `indiios-v-1-1` project consistently.

**Files Modified:**
- `landing-page/app/lib/firebase.ts` - Now uses `indiios-v-1-1` with correct config
- `src/services/firebase.ts` - Now uses `indiios-v-1-1` with correct config

**Firebase Config (canonical):**
```
Project: indiios-v-1-1
authDomain: indiios-v-1-1.firebaseapp.com
databaseURL: https://indiios-v-1-1-default-rtdb.firebaseio.com
storageBucket: indiios-v-1-1.firebasestorage.app
messagingSenderId: 223837784072

Landing Page Web App:
- apiKey: AIzaSyD7bmREk0yo8-WtJIngr7ek9U1-BC7BTC0
- appId: 1:223837784072:web:28eabcf0c5dd985395e9bd

Studio Web App:
- apiKey: AIzaSyCXQDyy5Bc0-ZNoZwI41Zrx9AqhdxUjvQo
- appId: 1:223837784072:web:3af738739465ea4095e9bd
```

### 2. Electron Auth URL Fixed (COMPLETED)

**Problem:** `electron/main.ts` defaulted to `localhost:3000` for login bridge.

**Fix:** Updated default to `https://indiios-v-1-1.web.app/login-bridge`

**File:** `electron/main.ts` line 43

### 3. CI/CD npm ci Fix (COMPLETED)

**Problem:** `npm ci` failed with exit code 255 due to native dependencies (keytar, canvas, sharp, electron-rebuild) requiring compilation.

**Fix:** Added `--ignore-scripts` to skip native dep compilation (not needed for web deploy).

**File:** `.github/workflows/deploy.yml` line 24

### 4. Removed Orphaned Functions Config (COMPLETED)

**Problem:** `firebase.json` referenced deleted `functions/` directory with predeploy script.

**Fix:** Removed entire `functions` section from `firebase.json`.

### 5. Environment Examples Updated (COMPLETED)

**Files:**
- `.env.example` - Added `VITE_LANDING_PAGE_URL`
- `landing-page/.env.example` - Updated Firebase config (gitignored, not committed)

---

## Current Issue: Firebase Hosting Deployment Fails

### Symptom
GitHub Actions workflow fails at "Deploy to Firebase Hosting" step with exit code 2.

### Attempts Made

1. **Used FirebaseExtended/action-hosting-deploy@v0** - Failed with exit code 2
2. **Switched to Firebase CLI directly** - Same failure
3. **Fixed JSON secret handling** - Same failure
4. **Added --debug flag** - Logs don't load on GitHub
5. **Split into two deploy steps (landing + app targets)** - Awaiting result

### Current Workflow Configuration
```yaml
- name: Deploy Landing Page to Firebase
  uses: FirebaseExtended/action-hosting-deploy@v0
  with:
    repoToken: ${{ secrets.GITHUB_TOKEN }}
    firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
    channelId: live
    projectId: indiios-v-1-1
    target: landing

- name: Deploy Studio App to Firebase
  uses: FirebaseExtended/action-hosting-deploy@v0
  with:
    repoToken: ${{ secrets.GITHUB_TOKEN }}
    firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
    channelId: live
    projectId: indiios-v-1-1
    target: app
```

### Firebase Hosting Targets (from .firebaserc)
```json
{
  "projects": { "default": "indiios-v-1-1" },
  "targets": {
    "indiios-v-1-1": {
      "hosting": {
        "landing": ["indiios-v-1-1"],
        "app": ["indiios-studio"]
      }
    }
  }
}
```

### Likely Root Cause
The `FIREBASE_SERVICE_ACCOUNT` GitHub secret may be:
1. Not valid JSON
2. For wrong project (not `indiios-v-1-1`)
3. Missing required permissions
4. Not properly formatted when stored as secret

### Recommended Next Steps

1. **Verify the FIREBASE_SERVICE_ACCOUNT secret:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Generate new private key for `indiios-v-1-1` project
   - Copy the ENTIRE JSON content
   - Update GitHub secret at: Settings → Secrets → FIREBASE_SERVICE_ACCOUNT

2. **Ensure service account has permissions:**
   - Should have `Firebase Hosting Admin` role
   - Should have `Cloud Build Editor` role (for deployments)

3. **Alternative: Use Firebase CI Token:**
   ```bash
   firebase login:ci
   ```
   Then use `FIREBASE_TOKEN` secret instead of service account.

---

## Files Changed (Commits)

| Commit | Description |
|--------|-------------|
| ec96231 | fix: Unify Firebase config to indiios-v-1-1 project and fix CI/CD |
| 012c1c0 | fix: Remove functions config from firebase.json |
| f087976 | fix: Use Firebase CLI directly for multi-target hosting deploy |
| 0cb7e03 | fix: Properly handle Firebase service account secret in workflow |
| ffa4dec | fix: Use correct Firebase hosting targets in deployment |

---

## Local Testing Status

- `npm run build` - PASSES
- `npm run build:electron` - PASSES
- Auth flow logic - Fixed (Firebase configs unified)
- CI/CD deployment - FAILING (service account issue)

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `landing-page/app/lib/firebase.ts` | Landing page Firebase config |
| `src/services/firebase.ts` | Studio app Firebase config |
| `electron/main.ts` | Electron main process, auth handling |
| `.github/workflows/deploy.yml` | CI/CD workflow |
| `firebase.json` | Firebase hosting config |
| `.firebaserc` | Firebase project/target mappings |
| `landing-page/app/login-bridge/page.tsx` | OAuth bridge for Electron |

---

## Original Issues Identified (for context)

1. **PKCE Verifier Never Set** - `pendingVerifier` in electron/main.ts never populated (but legacy bridge flow works without it)
2. **Firebase Project Mismatch** - FIXED
3. **Auth Race Condition** - `isAuthReady` set before orgs load (minor, not blocking)
4. **Functions Directory Deleted** - 77 files removed, references cleaned up
5. **CI/CD Native Deps** - FIXED with --ignore-scripts
