# Firebase Authentication & Migration Notes (2025-12-28)

## 1. The Mobile "Cycle" Problem (Root Cause)

- **Symptom:** On iOS (iPhone/iPad), clicking Google Sign-In takes the user to Google but returns them to the login page without being authenticated.
- **Cause:** Mobile browsers (Safari) block third-party cookies/storage. If the app is on `indiios-studio.web.app` and the `authDomain` is `indiios-v-1-1.firebaseapp.com`, the state cannot be shared between the handshake domain and the app domain.
- **Solution:** Set `authDomain` to match the app's hosting domain (`indiios-studio.web.app`).

## 2. Firebase Dynamic Links (FDL) Deprecation

- **Shutdown Date:** August 25, 2025.
- **Current Impact:** Legacy `signInWithRedirect` implementation relies on FDL for deep-linking back to the app on mobile. As FDL degrades, these links fail to trigger the app's state change, leading to "cycles."
- **Migration Path:**
  - Use a **Custom Auth Domain** (configured now as `indiios-studio.web.app`).
  - Must ensure `https://indiios-studio.web.app/__/auth/handler` is added to Authorized Redirect URIs in Google Cloud Console.
  - Official migration requires "Firebase Authentication with Identity Platform" upgrade for custom subdomains (e.g., `auth.indiios.com`), but using the Firebase Hosting domain works as a shorter-term "nuclear" fix.

## 3. App Hosting & Extensions

- **App Hosting:** `indii-backend` is active on `*.hosted.app`, but the Studio UI is currently served via standard Firebase Hosting on `indiios-studio.web.app`.
- **Extensions:** Only `storage-resize-images` is installed. No auth-related extensions are complicating the flow.

## 4. API Key & App Registration Cleanup (Dec 28)

- **Finding:** The previously hardcoded API key (`AIzaSyDQ...`) was identified as deleted in the GCP Console.
- **Resolution:**
  - Migrated to the active, unrestricted API key: `AIzaSyD9SmSp-2TIxw5EV9dfQSOdx4yRNNxU0RM`.
  - Updated `appId` to `1:223837784072:web:3af738739465ea4095e9bd` and `measurementId` to `G-T6V8WPE7Z7` to match the active configuration in project settings.
  - This resolves the `auth/invalid-credential` error occurring despite physically correct email/passwords.

## 5. Implementation Details

- **Hybrid Flow:**
  - **Electron:** Uses `signInWithPopup`.
  - **Web/Mobile:** Uses `signInWithRedirect` + `getRedirectResult`.
- **Config Sync:** Both `landing-page` and the main Studio app must use identical Firebase credentials and `authDomain` strategies to prevent cross-origin issues.

## 5. Next Steps

- [x] Verify `/__/auth/handler` status in Google Cloud Console.
- [x] Update Firebase API Key and App ID to active project credentials.
- [ ] Monitor iOS login attempts for success on `indiios-studio.web.app`.
- [ ] Prepare for official Identity Platform upgrade if custom subdomains are needed.
