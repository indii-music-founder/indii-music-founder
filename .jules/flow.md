## 2025-05-27 - Custom Router Implementation Violation

**Learning:** The application uses a custom `ModuleRenderer` controlled by `useStore().currentModule` instead of standard `react-router-dom` `<Route>` definitions. This breaks standard browser navigation (Back/Forward) and deep linking because URL changes are not bi-directionally synced with the store state.

**Action:**
1.  Verify if `currentModule` is updated when the URL changes.
2.  Write a test to assert that changing the URL updates the displayed module.
3.  If it fails, implement a synchronization mechanism (e.g., a `useEffect` in `App.tsx` that listens to `location.pathname` and updates `currentModule`, and vice versa).
## 2024-05-22 - SPA Violation: Missing URL Synchronization
**Learning:** The application was violating the "URL is the single source of truth" philosophy. Navigation was purely state-based (Zustand `currentModule`), leaving the URL static at `/` regardless of the current view. This broke the browser "Back" button, Deep Linking, and shareability.
**Action:** Implemented `useURLSync` hook in `App.tsx` to bi-directionally synchronize Zustand state with React Router. This enables deep linking (e.g., `/creative` loads the Creative Studio) and history navigation. The logic is robust against sub-paths (e.g., `/chat/123`), ensuring deep links are preserved while still correctly mapping the root module.

## 2024-05-24 - Race Condition: Store Initialization vs Deep Links
**Learning:** `useURLSync` (Store -> URL effect) creates a race condition on initial load if the Store initializes with a default value ('dashboard') different from the URL (e.g., '/legal'). This causes an immediate redirect to the default route, breaking deep links.
**Action:** Initialize the Store's `currentModule` state by reading `window.location.pathname` directly in the state creator (`appSlice.ts`), ensuring the Store and URL are aligned from the moment the app mounts. This eliminates the race condition and respects deep links.

## 2026-01-19 - Guest Login Blocking E2E Navigation Tests
**Learning:** The "Guest Login" button was visible in Dev/E2E but non-functional due to a hardcoded disable in `authSlice`. This prevented all navigation tests from executing as they couldn't bypass the login screen.
**Action:** Enabled `loginAsGuest` in `authSlice` to populate a mock user, allowing E2E tests to verify routing and deep linking logic.
