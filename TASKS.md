# TASKS.md - Active Work Items

**Last Updated:** 2025-12-25

This is the single source of truth for pending tasks. Completed plans have been archived to `archive/`.

---

## Current App State (Dec 25, 2025)

### Working Features

- **Electron Desktop App**: Packaged and running on macOS (arm64)
- **Google OAuth Flow**: Full deep link auth working via `indii-os://` protocol
- **Login Bridge**: Deployed at `https://indiios-v-1-1.web.app/login-bridge`
- **Firebase Auth**: signInWithCredential using Google OAuth tokens
- **IPC Communication**: Secure preload bridge between main/renderer
- **All 15 Agents**: Registered and operational (Marketing, Legal, Finance, Producer, Music, Director, Screenwriter, Video, Social, Publicist, Road, Publishing, Licensing, Brand, Generalist)
- **Unit Tests**: 42 passing (MembershipService + CleanupService)

### Auth Flow Architecture

```text
Electron App → Login Bridge (browser) → Google OAuth → Deep Link → IPC → Firebase Auth
                                         ↓
                              GoogleAuthProvider.credentialFromResult()
                                         ↓
                              indii-os://auth/callback?idToken=...&accessToken=...
                                         ↓
                              signInWithCredential(auth, credential)
```

### Key Files Modified (Dec 25)

| File | Change |
| ---- | ------ |
| `landing-page/app/login-bridge/page.tsx` | Extract Google OAuth credential (not Firebase ID token) |
| `src/core/store/slices/authSlice.ts` | IPC listener for deep link auth callbacks |
| `src/services/AuthService.ts` | Electron detection, ELECTRON_AUTH_PENDING flow |
| `src/modules/auth/Login.tsx` | Handle ELECTRON_AUTH_PENDING, fixed SVG path |
| `electron/handlers/auth.ts` | Deep link parsing with token logging |
| `forge.config.cjs` | URL scheme `indii-os://` protocol registration |

### Known Issues (Non-Blocking)

- GPU process crash on app close (cosmetic, `exit_code=15`)
- Network service restart on close (cosmetic)

---

## High Priority

### RAG System Compatibility

- [x] Resolve `fileData` support (Upgraded to Managed File Search System)
- [x] Verify RAG results end-to-end: `npx tsx scripts/verify-rag-filesearch.ts`

### Electron Desktop App

- [x] Test full auth flow end-to-end in packaged build
- [x] Verify deep link protocol on macOS
- [x] Test on production build (ad-hoc signed)

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

- [x] Add unit tests for `MembershipService` (25 test cases covering all methods)
- [x] Add unit tests for `CleanupService` (17 test cases with Firebase mocks)
- [x] Run "The Gauntlet" protocol for membership limits (Scenarios 3 & 4 added to stress-test-new-user.spec.ts)

---

## Low Priority

### Documentation Updates

- [x] Update any remaining "Rndr-AI" references to "indiiOS" (Updated: metadata.json, agents, TEST_PLAYBOOK.md, docs/)

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
