# Firebase Domain Authorization Fix

## Problem
Users encounter the error:
```
auth/requests-from-referer-empty-are-blocked
Error: "Authentication service not configured for this domain. Please contact support."
```

This occurs when Firebase's Identity Toolkit rejects signin/signup requests from an unauthorized domain.

---

## Root Cause
Firebase Authentication requires all **web domains** to be explicitly authorized in the Firebase Console. Requests from unauthorized domains are rejected at the API level (not our code).

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
4. **For development (local):**
   - Add `localhost:4242`
   - Add `localhost:4243`
   - Add `127.0.0.1:4242`

---

## Code-Side Improvements (Completed)

- ✅ Added `cors: true` to auth functions (handoff.ts)
- ✅ Configured CORS handler with allowed origins in index.ts
- ✅ Added user-friendly error message in authSlice.ts for domain config issues

---

## Verification

After updating Firebase Console, test:
```bash
# Local dev
npm run dev:web
# Open http://localhost:4242 → Sign up → Should work

# Production
# Visit https://founder.indii.music → Sign up → Should work
```

---

## Related Issues
- `auth/requests-from-referer-<empty>-are-blocked` (Firebase Identity Toolkit)
- Not a CORS issue (hosting/functions already configured)
- Not an application code issue (requires Firebase Console configuration)

---

## References
- [Firebase Console](https://console.firebase.google.com/)
- Firebase Docs: [Authenticate with Email/Password](https://firebase.google.com/docs/auth/web/password-auth)
