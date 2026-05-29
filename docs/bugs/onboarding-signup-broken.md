# BUG: Onboarding/Signup Flow Inaccessible

**Date:** 2026-03-04  
**Severity:** CRITICAL  
**Status:** CONFIRMED

## Summary
New users cannot sign up for indii. The onboarding flow is completely inaccessible.

## Issues Found

1. **No Sign Up Button**
   - Location: Login page (`localhost:4242`)
   - Expected: "Sign Up" or "Get Started" button
   - Actual: Only "Sign In", "Google", and "Guest Login" visible

2. **Auth Server Offline**
   - Port 3000 (Auth/Landing page) — Connection Refused
   - Likely the dedicated auth/onboarding server

3. **Signup Route Broken**
   - `/signup` on port 4242 redirects back to `/signin`
   - No standalone signup page accessible

4. **Guest Login Created Anonymous Users**
   - Expected: Production users must sign in or create a real account
   - Actual: "Explore as Guest" called Firebase anonymous auth and could create `users/{uid}` records with no real email identity
   - Status: Guest auth is being retired from production; E2E-only mock access remains separate from real Firebase Auth

## Impact
- New user acquisition blocked
- Cannot test first-time user experience
- Marketing/signup funnels broken

## Root Cause (Suspected)
- Port 3000 auth server not running
- Signup UI removed or hidden from login page
- Route guards redirecting unauthenticated users incorrectly
- Guest login used real Firebase anonymous auth instead of local/mock-only preview state

## Next Steps
1. Start port 3000 auth server
2. Restore Sign Up button on login page
3. Fix `/signup` route to render signup form
4. Keep guest/preview access out of production Firebase Auth
5. Audit and purge anonymous/no-email users only through a reviewed dry-run cleanup script

## QA Workaround
Testing should use real test accounts or explicit Firebase E2E mock mode, not production anonymous auth.
