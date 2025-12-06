# Authentication System Implementation Plan

**Status:** In Progress
**Last Updated:** 2025-12-06
**Current Phase:** Phase 1 - Firebase Setup

---

## Overview

Implement full authentication (email/password + Google OAuth) for indiiOS, with auth UI on the landing page and protected access to the studio app.

---

## Current State

| Component | Status |
|-----------|--------|
| Firebase Project | `indiios-v-1-1` (configured) |
| Current Auth | Anonymous only (`signInAnonymously`) |
| User Profiles | localStorage (not cloud) |
| Organizations | Firestore with `members[]` |
| Login UI | None |

---

## Phases

### Phase 1: Firebase Auth Setup (Backend)
- [ ] Enable Email/Password provider in Firebase Console
- [ ] Enable Google OAuth provider in Firebase Console
- [ ] Configure authorized domains
- [x] Create `users` collection schema (in lib/auth.ts)
- [ ] Update Firestore security rules

### Phase 1.5: Landing Page Firebase SDK ✅ COMPLETE
- [x] Install Firebase SDK
- [x] Create `lib/firebase.ts`
- [x] Create `lib/auth.ts` (all auth helper functions)
- [x] Create `.env.example`

### Phase 2: Landing Page Auth Routes ⬅️ NEXT
- [x] Add Firebase SDK to landing page
- [ ] Create `/login` page
- [ ] Create `/signup` page
- [ ] Create `/reset-password` page
- [ ] Create auth layout (centered card)

### Phase 3: Auth Components
- [ ] AuthProvider (React context)
- [ ] LoginForm (email/password)
- [ ] SignupForm (registration)
- [ ] GoogleAuthButton (OAuth)
- [ ] PasswordResetForm

### Phase 4: User Service
- [ ] Create `UserService.ts`
- [ ] Migrate profiles from localStorage to Firestore
- [ ] Sync brandKit to Firestore

### Phase 5: Studio App Integration
- [ ] Remove auto `signInAnonymously()`
- [ ] Add auth state listener
- [ ] Redirect unauthenticated users to landing
- [ ] Update authSlice for Firestore profiles

### Phase 6: Polish
- [ ] Loading states
- [ ] Error messages
- [ ] Account settings page
- [ ] Anonymous account linking

---

## File Structure (Landing Page)

```
landing-page/app/
├── (auth)/
│   ├── layout.tsx           # Auth pages layout
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── reset-password/page.tsx
├── lib/
│   ├── firebase.ts          # Firebase init
│   └── auth.ts              # Auth helpers
└── components/auth/
    ├── AuthProvider.tsx
    ├── LoginForm.tsx
    ├── SignupForm.tsx
    └── GoogleButton.tsx
```

---

## Firestore Schema

### `users` Collection
```typescript
interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  tier: 'free' | 'pro' | 'enterprise';
}
```

---

## Dependencies to Add (Landing Page)

```bash
cd landing-page
npm install firebase react-hook-form zod @hookform/resolvers
```

---

## Security Rules Addition

```javascript
// firestore.rules - add to existing rules
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && request.auth.uid == userId;
}
```

---

## Resume Instructions

When resuming this work:
1. Check which phase is marked "CURRENT" above
2. Check off completed items
3. Run `npm run build` in landing-page to verify no breaks
4. Test locally with `npm run dev` in landing-page folder

---

## Completed Work

### 2025-12-06

- [x] Created this implementation plan
- [x] Restructured landing page (/ = normal, /teaser = WebGL)
- [x] Updated metadata and navigation
- [x] Installed Firebase SDK in landing-page
- [x] Created `landing-page/app/lib/firebase.ts`
- [x] Created `landing-page/app/lib/auth.ts` with:
  - `signInWithEmail()`
  - `signUpWithEmail()`
  - `signInWithGoogle()`
  - `logOut()`
  - `resetPassword()`
  - Auto user document creation in Firestore
- [x] Created `landing-page/.env.example`
