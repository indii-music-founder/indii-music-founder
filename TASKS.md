# TASKS.md - Active Work Items

**Last Updated:** 2025-12-23

This is the single source of truth for pending tasks. See referenced docs for detailed implementation specs.

---

## High Priority

### Authentication System

**Reference:** [PLAN_AUTH_SYSTEM.md](./PLAN_AUTH_SYSTEM.md) (detailed 8-phase spec)

- [ ] Phase 1: User Profile Infrastructure (1-2 hrs)
- [ ] Phase 2: Auth Components (Login, Signup, ForgotPassword) (2-3 hrs)
- [ ] Phase 3: Auth Service & State Management (2-3 hrs)
- [ ] Phase 4: Routing & Protected Routes (1-2 hrs)
- [ ] Phase 5: Landing Page Integration (30 min)
- [ ] Phase 6: Anonymous → Authenticated Migration (1 hr)
- [ ] Phase 7: Logout Flow (1 hr)
- [ ] Phase 8: Google OAuth (optional, 1-2 hrs)

### Electron Auth Testing

**Reference:** [docs/ELECTRON_AUTH_FIX_STATUS.md](./docs/ELECTRON_AUTH_FIX_STATUS.md)

- [ ] Test full auth flow end-to-end
- [ ] Verify deep link protocol on macOS
- [ ] Test on production build

### RAG System Verification

- [ ] Run `npx tsx scripts/test-music-biz-rag.ts`
- [ ] Verify RAG results (check for 404/429 API errors)
- [ ] Check corpus quota in Google AI Studio

---

## Medium Priority

### Mobile Improvements

- [ ] Verify OnboardingModal fits mobile viewports
- [ ] Verify NewProjectModal fits mobile viewports
- [ ] Ensure input font size ≥ 16px (prevent iOS zoom)
- [ ] Verify touch targets ≥ 44x44px
- [ ] Monitor Liquid Orbs performance on low-end devices
- [ ] Implement lazy loading for Gallery images

### Dashboard Enhancements

**Reference:** [dashboard_spec.md](./dashboard_spec.md)

- [ ] Storage health bar visualization
- [ ] Project duplication feature
- [ ] Analytics/Stats gamification view

---

## Low Priority

### Documentation Updates

- [ ] Rename "Music Studio" → "Music Analysis" in UI components
- [ ] Update any remaining "Rndr-AI" references to "indiiOS"

---

## Archived

Completed documentation has been moved to `archive/` folder for reference.
