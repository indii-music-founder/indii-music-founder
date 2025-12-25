# Authentication System Implementation Plan

**Status:** In Progress
**Last Updated:** 2025-12-24
**Current Phase:** Phase 5 & 7 - Integration & Upgrades

---

## Overview

Implement full authentication (email/password + Google OAuth) for indiiOS, with auth UI on the landing page and protected access to the studio app.

---

## Current State

| Component | Status |
|-----------|--------|
| Firebase Project | `indiios-v-1-1` (configured) |
| Current Auth | Email/Pass + Google + Anon |
| User Profiles | Firestore (`users` collection) |
| Organizations | Firestore with `members[]` |
| Login UI | Implemented (`/login`, `/signup`) |

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

### Phase 2: Landing Page Auth Routes ✅ COMPLETE

- [x] Add Firebase SDK to landing page
- [x] Create `/login` page
- [x] Create `/signup` page
- [x] Create `/reset-password` page
- [x] Create auth layout

### Phase 3: Auth Components ✅ COMPLETE

- [x] AuthProvider (React context)
- [x] LoginForm (email/password + Google + Electron Bridge)
- [x] SignupForm
- [x] PasswordResetForm

### Phase 4: User Service ✅ COMPLETE

- [x] Create `UserService.ts` (Integrated in `@/modules/auth/UserService.ts`)
- [x] Migrate profiles from localStorage to Firestore (Partial - New users go to Firestore)
- [x] Sync brandKit to Firestore (Implemented in `UserServicesyncUserProfile` and `authSlice`)

### Phase 5: Studio App Integration 🚧 IN PROGRESS

- [x] Remove auto `signInAnonymously()` (Disabled in `firebase.ts`)
- [x] Add auth state listener (`authSlice` handles this)
- [x] Redirect unauthenticated users to landing (`App.tsx` handles this)
- [x] Update authSlice for Firestore profiles (Connected to `UserService`)
- [ ] Verify End-to-End flow in Production Build

### Phase 6: Polish ✅ COMPLETE

- [x] Loading states
- [x] Error messages
- [x] Account settings page
- [ ] Anonymous account linking

### Phase 7: Account Upgrades & Billing Integration 🚧 IN PROGRESS

- [ ] Integrate Stripe SDK for checkout
- [ ] Create `/upgrade` pricing table on landing page
- [ ] Implement webhook for subscription sync
- [ ] Add `subscriptionStatus` to Firestore `users` collection
- [/] Verify tier limits enforcement in `MembershipService` (Limits defined)

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
  subscriptionId?: string;       // Stripe Subscription ID
  customerId?: string;           // Stripe Customer ID
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  trialEndsAt?: Timestamp;
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

### 2025-12-24

- [x] Updated plan with Phase 7 (Upgrades & Billing)
- [x] Expanded `UserDocument` schema for subscription tracking
- [x] Documented "Upgrade Flow" and alignment with `MembershipService`

---

## Account Upgrade Flow

1. **Trigger:** User hits a limit defined in `MembershipService` (e.g., max projects) or manually visits `/upgrade`.
2. **Selection:** User selects a plan (Pro/Enterprise) using the `PricingTable` component.
3. **Checkout:** User is redirected to Stripe Checkout session.
4. **Fulfillment:** Stripe webhook updates the Firestore user document (`tier` and `subscriptionStatus`).
5. **Reflection:** Studio app listens for auth state changes; `authSlice` updates local state, and `MembershipService` immediately reflects new limits.

---

## Tier Enforcement Logic

Enforcement is handled via `src/services/MembershipService.ts`.

- **Frontend:** Use `MembershipService.canUseFeature(tier, feature)` to toggle UI elements.
- **Backend:** Firebase Cloud Functions for generation (video/image) verify the user's tier from their Firestore document before processing requests to avoid quota abuse.
