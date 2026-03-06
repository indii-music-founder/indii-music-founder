# BUG: Onboarding/Signup Flow Inaccessible

**Date:** 2026-03-04  
**Severity:** CRITICAL  
**Status:** CONFIRMED

## Summary
New users cannot sign up for indiiOS. The onboarding flow is completely inaccessible.

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

4. **Guest Login Skips Onboarding**
   - Expected: Guest → Onboarding → New profile
   - Actual: Guest → Existing "The Walking Agency" profile
   - No new user setup triggered

## Impact
- New user acquisition blocked
- Cannot test first-time user experience
- Marketing/signup funnels broken

## Root Cause (Suspected)
- Port 3000 auth server not running
- Signup UI removed or hidden from login page
- Route guards redirecting unauthenticated users incorrectly

## Next Steps
1. Start port 3000 auth server
2. Restore Sign Up button on login page
3. Fix `/signup` route to render signup form
4. Fix Guest Login to trigger onboarding for new sessions

## QA Workaround
Testing continues with existing user flows (Guest Login).
