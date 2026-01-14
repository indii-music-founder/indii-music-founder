## 2025-05-27 - Custom Router Implementation Violation

**Learning:** The application uses a custom `ModuleRenderer` controlled by `useStore().currentModule` instead of standard `react-router-dom` `<Route>` definitions. This breaks standard browser navigation (Back/Forward) and deep linking because URL changes are not bi-directionally synced with the store state.

**Action:**
1.  Verify if `currentModule` is updated when the URL changes.
2.  Write a test to assert that changing the URL updates the displayed module.
3.  If it fails, implement a synchronization mechanism (e.g., a `useEffect` in `App.tsx` that listens to `location.pathname` and updates `currentModule`, and vice versa).
