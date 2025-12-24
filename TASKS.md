# TASKS.md - Active Work Items

**Last Updated:** 2025-12-23

This is the single source of truth for pending tasks. See referenced docs for detailed implementation specs.

---

## High Priority

### Authentication System

**Reference:** [PLAN_AUTH_SYSTEM.md](./PLAN_AUTH_SYSTEM.md) (detailed 8-phase spec)

- [x] Phase 1: User Profile Infrastructure (Completed)
- [x] Phase 2: Auth Components (Login, Signup, ForgotPassword) (Completed)
- [x] Phase 3: Auth Service & State Management (Completed)
- [x] Phase 4: Routing & Protected Routes (Implemented in App.tsx)
- [x] Phase 5: Landing Page Integration (Completed)
- [x] Phase 6: Anonymous → Authenticated Migration (Implemented in Sidebar)
- [x] Phase 7: Logout Flow (Completed)
- [x] Phase 8: Google OAuth (Implemented)

### Electron Auth Testing

**Reference:** [docs/ELECTRON_AUTH_FIX_STATUS.md](./docs/ELECTRON_AUTH_FIX_STATUS.md)

- [ ] Test full auth flow end-to-end
- [ ] Verify deep link protocol on macOS
- [ ] Test on production build

### RAG System Verification

- [ ] Run `npx ts-node --experimental-specifier-resolution=node scripts/test-music-biz-rag.ts`
- [ ] Verify RAG results (Resolving 400 Bad Request with `fileData`)
- [ ] Check corpus quota in Google AI Studio

### Gemini 3.0 Migration (Dec 2025)

- [x] Update `ai-models.ts` to `gemini-3-flash-preview` & `gemini-3-pro-image-preview`
- [x] Update Cloud Functions to use Gemini 3.0 models
- [x] Rotate API Key (Fix Leaked Key)
- [ ] Resolve RAG compatibility with Gemini 3 Flash (`fileData` support)

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

- [x] ~~Rename "Music Studio" → "Music Analysis" in UI components~~ (Completed 2025-12-23)
- [ ] Update any remaining "Rndr-AI" references to "indiiOS"

---

## Archived

Completed documentation has been moved to `archive/` folder for reference.
