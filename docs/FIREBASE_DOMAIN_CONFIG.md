# Firebase Domain Authorization Fix

## Problem
Users encounter the error:
```
auth/requests-from-referer-empty-are-blocked
Error: "Authentication service not configured for this domain. Please contact support."
```

This occurs when Firebase's Identity Toolkit rejects sign-in/sign-up requests from an unauthorized origin.

---

## Root Cause
Two independent allowlists can reject Firebase Authentication:

1. **Firebase Auth authorized domains** allow the hostname that hosts the app.
2. **Google Cloud API-key browser restrictions** allow the complete request referrer, including scheme and port.

The dynamic error `auth/requests-from-referer-http://localhost:4243-are-blocked` is produced by the second layer. Adding an Auth authorized domain alone does not repair it.

---

## Solution (Firebase Console)

1. **Open Firebase Console:** https://console.firebase.google.com → Select `indii-music-founder`
2. **Navigate:** Authentication → Settings → Authorized Domains
3. **Add all production domains:**
   - `founder.indii.music`
   - `app.indii.music`
   - `indii.music`
   - `www.indii.music`
   - `studio.indii.music`
   - `indii-music-founder.web.app`
   - `indii-music-founder.firebaseapp.com`
4. **For development (local), add hostnames only:**
   - `localhost`
   - `127.0.0.1`

Firebase Auth authorized domains do not include schemes, ports, or paths.

## Google Cloud API-key browser restrictions

The deploy workflow owns the Firebase web API-key restriction allowlist and must include the canonical Vite/Electron renderer development origin:

- `http://localhost:4243/*`
- `http://127.0.0.1:4243/*`

Do not remove these entries from `.github/workflows/deploy.yml`; otherwise the next deployment will restore a production-only allowlist and break local authentication again. Port 4243 is the renderer port declared by `packages/renderer/vite.config.ts`, `electron.vite.config.ts`, and `npm run dev:web`.

---

## Code-Side Improvements (Completed)

- ✅ Added `cors: true` to auth functions (handoff.ts)
- ✅ Configured CORS handler with allowed origins in index.ts
- ✅ Added user-friendly error message in authSlice.ts for domain config issues
- ✅ Normalized Firebase's dynamic `auth/requests-from-referer-<origin>-are-blocked` error code
- ✅ Persisted localhost:4243 and 127.0.0.1:4243 in the deploy-managed API-key referrer allowlist

---

## Verification

After updating Firebase Console, test:
```bash
# Local dev
npm run dev:web
# Open http://localhost:4243 → Sign in → Should reach credential validation

# Production
# Visit https://founder.indii.music → Sign up → Should work
```

---

## Related Issues
- `auth/requests-from-referer-<empty>-are-blocked` (Firebase Identity Toolkit)
- Not a CORS issue (hosting/functions already configured)
- The restriction itself is cloud configuration; application code still maps failures to a safe user-facing message.

---

## References
- [Firebase Console](https://console.firebase.google.com/)
- Firebase Docs: [Authenticate with Email/Password](https://firebase.google.com/docs/auth/web/password-auth)
