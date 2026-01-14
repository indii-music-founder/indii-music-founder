# Production Remediation Handoff Document

**Created:** 2026-01-13
**Status:** IN PROGRESS - Partial Implementation Complete

---

## COMPLETED FIXES (6 of 16)

### 1. ✅ TEST_MODE Authentication Bypass Fixed
**File:** `src/core/store/slices/authSlice.ts` (lines 62-94)
- Added `import.meta.env.DEV` and `VITE_ALLOW_TEST_MODE` checks
- Production builds now cannot be bypassed via localStorage

### 2. ✅ TEST_MODE Block Added to main.tsx
**File:** `src/main.tsx` (lines 13-18)
- Defense-in-depth: removes TEST_MODE from localStorage in production
- Also added Sentry initialization import

### 3. ✅ CORS Misconfiguration Fixed
**File:** `functions/src/index.ts` (lines 58-105)
- Changed from `origin: true` (allow all) to whitelist
- Only allows: indiios-studio.web.app, indiios-v-1-1.web.app, studio.indiios.com, indiios.com, app://. (Electron)
- Localhost only allowed when FUNCTIONS_EMULATOR=true

### 4. ✅ App Check Hard Fail in Production
**File:** `src/services/firebase.ts` (lines 58-90)
- Now throws error and shows user-facing message if App Check key missing in production
- No longer silently continues without security

### 5. ✅ Firebase Internals Exposure Fixed
**File:** `src/services/firebase.ts` (lines 109-119)
- Changed from `window.location.hostname === 'localhost'` (spoofable) to `import.meta.env.DEV && VITE_EXPOSE_INTERNALS === 'true'`
- Now requires explicit env flag in dev builds only

### 6. ✅ Sentry Error Tracking File Created
**File:** `src/lib/sentry.ts` (NEW FILE)
- Complete Sentry initialization with production-only activation
- Configured with error filtering, replay, and PII scrubbing

---

## REMAINING FIXES (10 of 16)

### 7. 🔲 Add Security Headers to firebase.json
**File:** `firebase.json`

**Add to BOTH hosting targets (landing and app):**
```json
"headers": [
  {
    "source": "**",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.googleusercontent.com; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net wss://*.firebaseio.com; frame-src 'self' https://accounts.google.com https://*.firebaseapp.com;" },
      { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-XSS-Protection", "value": "1; mode=block" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]
  }
]
```

### 8. 🔲 Update deploy.yml with Inngest Secrets
**File:** `.github/workflows/deploy.yml`

**Add after line 105 (after studio deploy):**
```yaml
      - name: Deploy Cloud Functions
        run: |
          export GOOGLE_APPLICATION_CREDENTIALS=$HOME/gcloud-key.json
          firebase deploy --only functions --project indiios-v-1-1 --non-interactive
        env:
          INNGEST_EVENT_KEY: ${{ secrets.INNGEST_EVENT_KEY }}
          INNGEST_SIGNING_KEY: ${{ secrets.INNGEST_SIGNING_KEY }}
```

**GitHub Secrets to add:**
- INNGEST_EVENT_KEY
- INNGEST_SIGNING_KEY
- VITE_SENTRY_DSN

### 9. 🔲 Fix Error Stack Exposure in ErrorBoundary
**File:** `src/core/components/ErrorBoundary.tsx`

Find the error display section and wrap with dev check:
```typescript
const isDev = import.meta.env.DEV;
const errorId = crypto.randomUUID().slice(0, 8);

{isDev ? (
    <>
        <p>{this.state.error?.message}</p>
        <pre>{this.state.error?.stack}</pre>
    </>
) : (
    <>
        <p>An unexpected error occurred. Please refresh.</p>
        <p>Reference: {errorId}</p>
    </>
)}
```

### 10. 🔲 Fix Silent Error Swallowing in VideoGenerationService
**File:** `src/services/video/VideoGenerationService.ts`

Find `catch (e) { return { canGenerate: true }; }` and change to:
```typescript
catch (e) {
    console.error('[VideoGeneration] Quota check failed:', e);
    if (import.meta.env.PROD) {
        return { canGenerate: false, reason: 'Service unavailable. Please try again.' };
    }
    return { canGenerate: true };
}
```

### 11. 🔲 Fix Unsafe JSON.parse in MemoryTools
**File:** `src/services/agent/tools/MemoryTools.ts` (around line 55)

Wrap JSON.parse in try-catch:
```typescript
let verification;
try {
    verification = JSON.parse(text);
} catch (parseError) {
    console.error('[MemoryTools] JSON parse failed:', text?.slice(0, 200));
    verification = { score: 0, pass: false, reason: 'Failed to parse AI response' };
}
```

### 12. 🔲 Create Rate Limiting Middleware
**New File:** `functions/src/middleware/rateLimiter.ts`

```typescript
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

export async function checkRateLimit(
    userId: string,
    endpoint: string,
    maxRequests: number = 60,
    windowMs: number = 60000
): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `rate_limit:${endpoint}:${userId}:${windowStart}`;
    const ref = admin.firestore().collection('_rate_limits').doc(key);

    return admin.firestore().runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const count = doc.exists ? (doc.data()?.count || 0) : 0;
        if (count >= maxRequests) {
            return { allowed: false, remaining: 0 };
        }
        tx.set(ref, { count: count + 1, expiresAt: windowStart + windowMs });
        return { allowed: true, remaining: maxRequests - count - 1 };
    });
}

export function withRateLimit<T>(
    handler: (data: T, ctx: functions.https.CallableContext) => Promise<any>,
    config: { endpoint: string; maxRequests?: number }
) {
    return async (data: T, ctx: functions.https.CallableContext) => {
        if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth required');
        const result = await checkRateLimit(ctx.auth.uid, config.endpoint, config.maxRequests);
        if (!result.allowed) {
            throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded');
        }
        return handler(data, ctx);
    };
}
```

### 13. 🔲 Fix Node Version Mismatch
**File:** `.github/workflows/build.yml` (line 19)

Change `node-version: '20.x'` to `node-version: '22.x'`

### 14. 🔲 Fix Duplicate Firestore Rules
**File:** `firestore.rules`

Remove duplicate rules at lines 116-118, 250-251, 262-264. Keep only ONE of each:
```javascript
match /organizations/{orgId} {
    allow read: if isAuthenticated() && request.auth.uid in resource.data.members;
    allow create: if isAuthenticated() && request.auth.uid in request.resource.data.members;
    allow update: if isAuthenticated() && request.auth.uid in resource.data.members;
    allow delete: if false;
}
```

### 15. 🔲 Enable Skipped RateLimiter Tests
**File:** `src/services/ai/RateLimiter.test.ts` (lines 48-62)

Change `it.skip` to `it` and fix timer mocking.

### 16. 🔲 Run Tests and Build
```bash
npm run build
npm run test
npm run lint
```

---

## ENVIRONMENT VARIABLES TO ADD

Add to `.env.template`:
```bash
VITE_ALLOW_TEST_MODE=false
VITE_EXPOSE_INTERNALS=false
VITE_SENTRY_DSN=
VITE_APP_VERSION=0.1.0
```

---

## FULL PLAN FILE

The complete detailed plan is at:
`~/.claude/plans/compiled-noodling-globe.md`

---

## VERIFICATION AFTER ALL FIXES

```bash
# Build succeeds
npm run build

# Tests pass
npm run test

# Check security headers after deploy
curl -I https://indiios-studio.web.app | grep -E "X-Frame|Content-Security"

# Verify TEST_MODE blocked in production
# In browser console: localStorage.setItem('TEST_MODE', 'true')
# Refresh - should NOT bypass auth
```

---

## SUMMARY

| Phase | Item | Status |
|-------|------|--------|
| P0 | TEST_MODE bypass | ✅ DONE |
| P0 | CORS config | ✅ DONE |
| P0 | App Check hard fail | ✅ DONE |
| P0 | Firebase internals | ✅ DONE |
| P0 | Sentry init | ✅ DONE |
| P0 | Security headers | 🔲 TODO |
| P0 | Deploy secrets | 🔲 TODO |
| P1 | ErrorBoundary stack | 🔲 TODO |
| P1 | Video error handling | 🔲 TODO |
| P1 | JSON.parse safety | 🔲 TODO |
| P1 | Rate limiting | 🔲 TODO |
| P1 | Node version | 🔲 TODO |
| P1 | Firestore rules | 🔲 TODO |
| P1 | RateLimiter tests | 🔲 TODO |
| P2 | Verify build | 🔲 TODO |
