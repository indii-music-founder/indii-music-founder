# BUG: Firebase Storage CORS Blocking Image Uploads

**Date:** 2026-03-04  
**Severity:** CRITICAL  
**Status:** CONFIRMED

## Summary
Image generation succeeds but Firebase Storage upload fails due to CORS policy, preventing images from appearing in the gallery.

## Details
- **Location:** Creative Director → Direct tab
- **Flow:** Prompt → Generation API (success) → Storage Upload (failure)
- **Error:** `XMLHttpRequest to firebasestorage.googleapis.com blocked by CORS policy from localhost:4242`
- **Result:** Image generated but never appears in gallery
- **User Impact:** "No assets yet" persists despite successful generations

## Technical
- Origin: `localhost:4242`
- Target: `firebasestorage.googleapis.com`
- Error: CORS policy violation
- Firebase Storage bucket CORS configuration likely missing localhost

## Impact
- Creative workflow completely broken
- Users cannot save or view generated assets
- Core feature (AI image generation) unusable

## Fix Required
Update Firebase Storage CORS configuration to allow:
- `localhost:4242`
- `localhost:3000`
- `localhost:8080`
- Production domains

## Workaround
None. Feature is non-functional in dev environment.
