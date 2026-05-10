# GitHub Secrets Migration — indii-music/indiiOS-Clean

> Required for CI/CD to pass on the new organization repository.
> Navigate to: **Settings → Secrets and variables → Actions → New repository secret**
> URL: https://github.com/indii-music/indiiOS-Clean/settings/secrets/actions

## Required Secrets (copy from the-walking-agency-det/indiiOS-Clean)

| Secret Name | Purpose | Used In |
|---|---|---|
| `VITE_API_KEY` | Gemini API key | unit-tests, build |
| `VITE_FIREBASE_API_KEY` | Firebase project identifier | unit-tests, build, e2e |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | unit-tests, build, e2e |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | build |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | build |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | build |
| `VITE_FIREBASE_APP_CHECK_KEY` | App Check enforcement key | build |
| `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN` | App Check CI bypass token | unit-tests |
| `VITE_VERTEX_PROJECT_ID` | Vertex AI project | unit-tests, build |
| `VITE_VERTEX_LOCATION` | Vertex AI location (e.g. us-central1) | unit-tests, build |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps API | build, e2e |
| `FIREBASE_SERVICE_ACCOUNT` | Full service account JSON for Firebase deploy | deploy-staging, deploy-production |
| `WINDOWS_CERTIFICATE` | Windows code-signing cert (base64) | release workflow |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows cert password | release workflow |

## Optional (E2E only)
| Secret Name | Purpose |
|---|---|
| `E2E_TEST_EMAIL` | Playwright test account email |
| `E2E_TEST_PASSWORD` | Playwright test account password |

## Steps
1. Go to the OLD repo: https://github.com/the-walking-agency-det/indiiOS-Clean/settings/secrets/actions
2. Note each secret value (you'll need to re-enter them — GitHub doesn't let you view existing values)
3. Go to the NEW repo: https://github.com/indii-music/indiiOS-Clean/settings/secrets/actions
4. Add each secret above with the same values

## After Adding Secrets
Re-run the failed workflow manually:
1. Go to https://github.com/indii-music/indiiOS-Clean/actions
2. Click "Deploy to Firebase Hosting" → "Run workflow" → Run on `main`
