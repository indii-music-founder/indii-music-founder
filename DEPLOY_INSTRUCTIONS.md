# Production Deployment Manual

## 🚨 Critical: CI/CD Authorization

The automated deployment pipeline is currently failing due to missing/expired OAuth tokens for Firebase.

### Diagnosis
The logs indicate:
`Error: Deploy target landing not configured for project... No OAuth tokens found`

### Remediation Steps

1.  **Generate a new CI Token:**
    Run the following command in your local terminal:
    ```bash
    firebase login:ci
    ```
    This will open a browser. Authenticate with the owner account (`Narrow Channel` / `automator@indiios.com`).

2.  **Update GitHub Secrets:**
    *   Copy the token output from the terminal.
    *   Go to GitHub Repository Settings -> Secrets and variables -> Actions.
    *   Update `FIREBASE_TOKEN` with the new value.

3.  **Configure Firebase Targets:**
    Ensure the `landing` target is mapped in `.firebaserc`. If missing, run:
    ```bash
    firebase target:apply hosting landing landing-page
    ```
    (Replace `landing-page` with the actual site ID from Firebase Console).

4.  **Retry Deployment:**
    Re-run the failed GitHub Action workflow.

## 📦 Build Verification

Before deploying, ensure local builds pass stricter checks:

```bash
# Verify Electron Build
npm run build:electron

# Verify Web Build
npm run build:studio
```

## 🧪 Stability Checklist

- [x] **Preload Script**: Verified `dist-electron/preload.cjs` exists and is referenced by `main.ts`.
- [x] **Load Testing**: Enabled `VITE_ALLOW_TEST_MODE=true` in `.env` to allow stress tests to bypass auth.
- [x] **Dependencies**: Replaced deprecated `ytdl-core` with `@distube/ytdl-core`.
