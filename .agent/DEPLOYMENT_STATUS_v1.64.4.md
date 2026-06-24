# v1.64.4 Deployment Ready

**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT  
**Date:** 2026-06-24 08:15 EDT  
**Branch:** `main`  
**Latest Commit:** `1998da06c`

---

## What's Shipped in v1.64.4

### Phase 0: Foundation
- ✅ Restored confirmation dialog on send-to-video (user safety)
- ✅ Fixed test isolation (4242 tests passing)

### Workstream 1A: Auth Error Handling
- ✅ Added user-friendly Firebase referer domain error message
- ✅ Created `docs/FIREBASE_DOMAIN_CONFIG.md` for Firebase Console setup

### Workstream 1C: Pre-commit Quality Gates
- ✅ Enhanced `.husky/pre-commit` with:
  - ESLint (code quality)
  - TypeScript typecheck (type safety)
  - Security boundary verification (API safety)

---

## Quality Verification

```
✓ 4242 tests passing (all categories)
✓ Zero typecheck errors (tsc -b)
✓ Zero critical lint errors (eslint)
✓ All pre-commit gates passing
✓ API security boundaries verified
```

---

## Deployment Command

```bash
npm version patch  # v1.64.4
git push
# CI automatically deploys to Firebase Hosting
```

---

## Manual Steps Required

**For users experiencing `auth/requests-from-referer-empty-are-blocked` error:**

See `docs/FIREBASE_DOMAIN_CONFIG.md` for Firebase Console setup instructions. This is a **one-time manual configuration** in Firebase Console (not a code issue).

---

## Next: v1.65.0 & v1.66.0

All workstreams for creative polish (2A-2D) and features (3A-3E) are queued and ready for agent swarm pickup.

See `.agent/PLATINUM_ROADMAP_2026Q2.md` for full specifications.

---

## Release Notes Snippet

```markdown
### v1.64.4 — Hardening Release
- ✨ Improved auth error messaging for domain configuration issues
- 🔒 Enhanced pre-commit quality gates (lint → typecheck → security checks)
- 🎯 Restored confirmation dialog on send-to-video (better UX safety)
- 📋 Fixed test infrastructure and isolation issues
- ✅ All 4242 tests passing, zero type errors

**Breaking changes:** None
**Migration required:** Firebase Console domain authorization (see docs)
```
