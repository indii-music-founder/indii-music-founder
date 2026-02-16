# Authentication System Implementation Plan

**Status:** Complete ✅
**Scope:** Full Sign In / Sign Up / Login System
**Affected Areas:** Landing Page + Studio App
**Completed:** 2025-12-27

---

## Executive Summary

Currently, the app uses **anonymous authentication** - users are auto-logged in without identity. To make this "real," we need:

1. **Email/Password Authentication** - Create accounts, login, logout
2. **User Profiles** - Store user data in Firestore
3. **Auth Routes** - Dedicated login/signup pages in studio
4. **Landing Page Integration** - Connect auth buttons to real flows
5. **Protected Routes** - Guard sensitive areas
6. **OAuth (Optional)** - Google Sign-In for convenience

---

## Current State

| Component | Status |
|-----------|--------|
| Firebase Auth SDK | Installed, using anonymous only |
| SelectOrg Component | Works (org creation/switching) |
| AuthSlice (Zustand) | Has org state, no user auth state |
| User Profiles | None - no `/users` collection |
| Login Component | Does not exist |
| Signup Component | Does not exist |
| Firestore Rules | Requires `request.auth != null` (anonymous passes) |
| Landing Page Auth Buttons | Link to studio root (no real auth) |

---

## Architecture Decision

### Option A: Auth in Studio App (Recommended)
- Landing page stays static, links to studio `/auth/*` routes
- All auth logic lives in one place (studio)
- Simpler Firebase config (one project)
- Easier to maintain

### Option B: Auth in Landing Page
- Would require Firebase SDK in Next.js landing page
- Cross-domain session sharing complexity
- Two places to maintain auth logic

**Decision:** Option A - Studio handles all auth

---

## Implementation Phases

### Phase 1: User Profile Infrastructure

**Goal:** Create user data model and Firestore collection

**Files to Create/Modify:**
```
src/
├── types/User.ts                    # User type definitions
├── services/UserService.ts          # CRUD for user profiles
├── core/store/slices/authSlice.ts   # Add user state
```

**User Model:**
```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  emailVerified: boolean;
  membership: {
    tier: 'free' | 'pro' | 'enterprise';
    expiresAt: Timestamp | null;
  };
  preferences: {
    theme: 'dark' | 'light';
    notifications: boolean;
  };
}
```

**Firestore Rules Addition:**
```javascript
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow write: if request.auth.uid == userId;
}
```

**Estimated Effort:** 1-2 hours

---

### Phase 2: Auth Components

**Goal:** Create login, signup, and password reset UI

**Files to Create:**
```
src/modules/auth/
├── Login.tsx              # Email/password login form
├── Signup.tsx             # Registration form
├── ForgotPassword.tsx     # Password reset flow
├── AuthLayout.tsx         # Shared layout for auth pages
├── components/
│   ├── AuthForm.tsx       # Reusable form wrapper
│   ├── SocialAuth.tsx     # Google/OAuth buttons (future)
│   └── AuthError.tsx      # Error display component
```

**Login.tsx Features:**
- Email + Password fields
- "Remember me" checkbox
- "Forgot password?" link
- "Don't have an account? Sign up" link
- Error handling (invalid credentials, network errors)
- Loading state during auth

**Signup.tsx Features:**
- Email + Password + Confirm Password
- Display name (optional)
- Terms of Service checkbox
- "Already have an account? Sign in" link
- Email validation
- Password strength indicator
- Error handling

**Design:**
- Full-screen centered card (like SelectOrg)
- indiiOS branding at top
- Dark theme consistent with app
- Subtle gradient background

**Estimated Effort:** 2-3 hours

---

### Phase 3: Auth Service & State

**Goal:** Wire up Firebase Auth methods and state management

**Files to Modify:**
```
src/
├── services/AuthService.ts          # New - auth methods
├── services/firebase.ts             # Add auth providers
├── core/store/slices/authSlice.ts   # Add user auth state
├── core/App.tsx                     # Add auth listener
```

**AuthService Methods:**
```typescript
class AuthService {
  // Email/Password
  async signUp(email: string, password: string, displayName?: string): Promise<User>
  async signIn(email: string, password: string): Promise<User>
  async signOut(): Promise<void>
  async sendPasswordReset(email: string): Promise<void>
  async updatePassword(newPassword: string): Promise<void>

  // Email Verification
  async sendVerificationEmail(): Promise<void>
  async checkEmailVerified(): Promise<boolean>

  // Profile
  async updateProfile(updates: Partial<UserProfile>): Promise<void>

  // Upgrade from Anonymous
  async linkAnonymousAccount(email: string, password: string): Promise<User>

  // State
  getCurrentUser(): User | null
  onAuthStateChange(callback: (user: User | null) => void): Unsubscribe
}
```

**AuthSlice Additions:**
```typescript
interface AuthSlice {
  // Existing
  currentOrganizationId: string;
  organizations: Organization[];
  userProfile: UserProfile;

  // New
  user: User | null;              // Firebase User object
  isAuthenticated: boolean;       // true if user is logged in (non-anonymous)
  isLoading: boolean;             // Auth state loading
  authError: string | null;       // Last error message

  // New Actions
  setUser: (user: User | null) => void;
  setAuthError: (error: string | null) => void;
  logout: () => Promise<void>;
}
```

**Estimated Effort:** 2-3 hours

---

### Phase 4: Routing & Protected Routes

**Goal:** Add auth routes and protect authenticated areas

**Files to Modify:**
```
src/
├── core/App.tsx                     # Add route handling
├── core/components/ProtectedRoute.tsx  # New - route guard
├── core/store/slices/appSlice.ts    # Add auth route states
```

**Route Structure:**
```
/                 → Dashboard (protected)
/auth/login       → Login page
/auth/signup      → Signup page
/auth/reset       → Password reset
/auth/verify      → Email verification pending
/select-org       → Org selection (protected)
/creative         → Creative Studio (protected)
/video            → Video Studio (protected)
...
```

**ProtectedRoute Logic:**
```typescript
function ProtectedRoute({ children }) {
  const { user, isLoading, isAuthenticated } = useStore();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    // Redirect to login
    setModule('auth-login');
    return null;
  }

  return children;
}
```

**Module States to Add:**
```typescript
type ModuleId =
  | 'dashboard'
  | 'creative'
  | 'video'
  | 'auth-login'      // New
  | 'auth-signup'     // New
  | 'auth-reset'      // New
  | 'auth-verify'     // New
  | 'select-org'
  | ...;
```

**Estimated Effort:** 1-2 hours

---

### Phase 5: Landing Page Integration

**Goal:** Connect landing page auth buttons to real auth flows

**Files to Modify:**
```
landing-page/app/
├── page.tsx                    # Update auth button links
```

**Changes:**
```typescript
// Before
<Link href="https://indiios-studio.web.app">Sign In</Link>

// After
<Link href="https://indiios-studio.web.app/auth/login">Sign In</Link>
<Link href="https://indiios-studio.web.app/auth/signup">Get Started</Link>
```

**Also Update:**
- Mobile menu links
- CTA "Get Started Free" button
- Any other auth-related links

**Estimated Effort:** 30 minutes

---

### Phase 6: Anonymous → Authenticated Migration

**Goal:** Handle users who start anonymous and later sign up

**Strategy:**
1. User arrives → Anonymous sign-in (current behavior)
2. User creates org/projects as anonymous
3. User clicks "Sign Up" → `linkWithCredential()` to preserve data
4. Anonymous UID becomes permanent UID
5. All org memberships preserved

**Firebase Method:**
```typescript
import { linkWithCredential, EmailAuthProvider } from 'firebase/auth';

async function upgradeAnonymousAccount(email: string, password: string) {
  const credential = EmailAuthProvider.credential(email, password);
  const userCredential = await linkWithCredential(auth.currentUser!, credential);
  // Same UID, now with email attached
  return userCredential.user;
}
```

**Estimated Effort:** 1 hour

---

### Phase 7: Logout Flow

**Goal:** Clean logout that clears all state

**Logout Actions:**
1. Call `auth.signOut()` (Firebase)
2. Clear Zustand state (user, orgs, history)
3. Clear localStorage (orgId, userProfile, cached data)
4. Clear IndexedDB cache (Firestore persistence)
5. Redirect to login page

**UI Placement:**
- User menu dropdown in dashboard header
- Account settings page (future)

**Estimated Effort:** 1 hour

---

### Phase 8 (Optional): Google OAuth

**Goal:** Add "Sign in with Google" for convenience

**Files to Modify:**
```
src/
├── services/firebase.ts          # Add GoogleAuthProvider
├── services/AuthService.ts       # Add signInWithGoogle()
├── modules/auth/Login.tsx        # Add Google button
├── modules/auth/Signup.tsx       # Add Google button
```

**Implementation:**
```typescript
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  // Create user profile if first sign-in
  await createOrUpdateUserProfile(result.user);

  return result.user;
}
```

**Firebase Console Setup Required:**
1. Enable Google provider in Authentication
2. Add authorized domains
3. Configure OAuth consent screen

**Estimated Effort:** 1-2 hours

---

## File Summary

### New Files (8)
| File | Purpose |
|------|---------|
| `src/types/User.ts` | User type definitions |
| `src/services/AuthService.ts` | Auth methods wrapper |
| `src/services/UserService.ts` | User profile CRUD |
| `src/modules/auth/Login.tsx` | Login page |
| `src/modules/auth/Signup.tsx` | Signup page |
| `src/modules/auth/ForgotPassword.tsx` | Password reset |
| `src/modules/auth/AuthLayout.tsx` | Shared auth page layout |
| `src/core/components/ProtectedRoute.tsx` | Route guard |

### Modified Files (7)
| File | Changes |
|------|---------|
| `src/services/firebase.ts` | Add auth providers |
| `src/core/store/slices/authSlice.ts` | Add user state |
| `src/core/store/slices/appSlice.ts` | Add auth module IDs |
| `src/core/App.tsx` | Add auth routes, listener |
| `firestore.rules` | Add /users rules |
| `landing-page/app/page.tsx` | Update auth links |

---

## Security Considerations

### Firestore Rules Updates
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User profiles - only owner can read/write
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Organizations - require non-anonymous auth for creation
    match /organizations/{orgId} {
      allow create: if request.auth != null
        && request.auth.token.email != null;  // Require email
      allow read: if request.auth.uid in resource.data.members;
      allow update: if request.auth.uid in resource.data.members;
    }

    // ... rest of rules
  }
}
```

### Password Requirements
- Minimum 8 characters
- At least one number
- At least one special character (optional)

### Rate Limiting
- Firebase Auth has built-in rate limiting
- 5 failed attempts → temporary lockout

---

## Testing Plan

### Unit Tests
- AuthService methods
- AuthSlice state updates
- ProtectedRoute component

### E2E Tests
- Sign up flow
- Sign in flow
- Password reset flow
- Logout flow
- Anonymous → authenticated upgrade

### Manual Testing
- Cross-browser (Chrome, Safari, Firefox)
- Mobile responsive
- Error states (network offline, invalid credentials)

---

## Rollout Strategy

### Phase 1: Internal Testing (1-2 days)
- Deploy to staging
- Team tests all flows
- Fix any issues

### Phase 2: Gradual Rollout
- Deploy to production
- Keep anonymous auth working (backward compatible)
- Monitor for errors

### Phase 3: Encourage Sign-Up
- Add prompts in app: "Save your work - create an account"
- Email verification reminders
- Feature gating for anonymous users (limited generations)

---

## Estimated Total Effort

| Phase | Effort |
|-------|--------|
| Phase 1: User Profiles | 1-2 hours |
| Phase 2: Auth Components | 2-3 hours |
| Phase 3: Auth Service | 2-3 hours |
| Phase 4: Routing | 1-2 hours |
| Phase 5: Landing Integration | 30 min |
| Phase 6: Anonymous Migration | 1 hour |
| Phase 7: Logout | 1 hour |
| Phase 8: Google OAuth | 1-2 hours |
| **Total** | **10-15 hours** |

---

## Questions to Resolve

1. **Email Verification Required?**
   - Should we block users until email is verified?
   - Or allow limited access and prompt verification?

2. **Anonymous User Limits?**
   - Should anonymous users be able to create orgs?
   - Limit generations for anonymous?

3. **Terms of Service / Privacy Policy?**
   - Need legal docs before collecting emails
   - Checkbox required on signup?

4. **Google OAuth Priority?**
   - Implement now or Phase 2?
   - Other providers (Apple, GitHub)?

5. **Password Reset Flow?**
   - Firebase email template customization?
   - Custom reset page or Firebase default?

---

## Implementation Status

All phases have been implemented:

| Phase                        | Status      | Files                                                                              |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| Phase 1: User Profiles       | ✅ Complete | `src/types/User.ts`, `src/services/UserService.ts`                                 |
| Phase 2: Auth Components     | ✅ Complete | `src/modules/auth/Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `AuthLayout.tsx` |
| Phase 3: Auth Service        | ✅ Complete | `src/services/AuthService.ts`, `src/core/store/slices/authSlice.ts`                |
| Phase 4: Routing             | ✅ Complete | `src/core/App.tsx` with protected routes                                           |
| Phase 5: Landing Integration | ✅ Complete | Links updated                                                                      |
| Phase 6: Anonymous Migration | ✅ Complete | Electron deep-link flow                                                            |
| Phase 7: Logout              | ✅ Complete | Full state cleanup                                                                 |
| Phase 8: Google OAuth        | ✅ Complete | Google sign-in via Electron bridge                                                 |

**Electron Deep-Link Auth:** Full implementation with IPC bridge for secure OAuth flow.
