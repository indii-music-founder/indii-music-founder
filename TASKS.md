# TASKS.md - Active Work Items

**Last Updated:** 2025-12-24

This is the single source of truth for pending tasks. Completed plans have been archived to `archive/`.

---

## High Priority

### RAG System Compatibility

- [x] Resolve `fileData` support (Upgraded to Managed File Search System)
- [x] Verify RAG results end-to-end: `npx tsx scripts/verify-rag-filesearch.ts`

### Electron Desktop App

- [ ] Test full auth flow end-to-end in packaged build
- [ ] Verify deep link protocol on macOS
- [ ] Test on production build (signed)

### Gemini 3.0 Migration (Final Steps)

- [ ] **FUTURE/ENTERPRISE**: Migrate `generateImageV3` from AI Studio (API Key) to Vertex AI (IAM) once `gemini-3-pro-image-preview` is available on Vertex endpoints

---

## Medium Priority

### Mobile Improvements

- [x] Verify OnboardingModal fits mobile viewports
- [x] Verify NewProjectModal fits mobile viewports
- [x] Ensure input font size >= 16px (prevent iOS zoom)
- [x] Verify touch targets >= 44x44px
- [x] Monitor Liquid Orbs performance on low-end devices
- [x] Implement lazy loading for Gallery images

### Dashboard Enhancements

**Reference:** [dashboard_spec.md](./dashboard_spec.md)

- [x] Storage health bar visualization
- [x] Project duplication feature
- [x] Analytics/Stats gamification view

### Test Coverage Expansion

- [ ] Add unit tests for `MembershipService`
- [ ] Add unit tests for `CleanupService`
- [ ] Run "The Gauntlet" protocol for membership limits

---

## Low Priority

### Documentation Updates

- [ ] Update any remaining "Rndr-AI" references to "indiiOS"

---

## Recently Completed (Dec 2025)

### Authentication System

All 8 phases implemented. See `archive/PLAN_AUTH_SYSTEM.md` for reference.

### Core Services

- MembershipService (tier limits)
- CleanupService (database vacuum)
- ExportService (ZIP backup)
- VoiceService (speech-to-text/TTS)

### Features

- Semantic Memory for Agents
- Product Showroom (see `archive/showroom_plan.md`)
- Voice Control integration
- Multi-Agent Architecture (Hub-and-Spoke)

### Infrastructure

- Gemini 3.0 model standardization
- Firebase Functions backend migration
- Stress testing (E2E Playwright)

---

## Archived Documentation

Completed implementation plans moved to `archive/`:

- `archive/PLAN_AUTH_SYSTEM.md` - Auth implementation (complete)
- `archive/showroom_plan.md` - Showroom feature (complete)
- `archive/implementation_plan.md` - Component kit integration (complete)
- `archive/ROADMAP.md` - Phase 1-7 roadmap (complete)
