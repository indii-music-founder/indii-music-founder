## 2024-05-23 - Dead Code Confusion
**Learning:** `ConversationHistoryList` component exists but is unused, while the `Sidebar` lacks expected "History" navigation. This architectural mismatch creates a "broken promise" where code exists but functionality is unreachable.
**Action:** When implementing History features, verify if `ConversationHistoryList` is viable or if it should be deprecated in favor of a new implementation in `ChatOverlay` or `Sidebar`.

## 2025-02-23 - State Loss in Standalone Modules
**Learning:** `CommandBar` and `ChatOverlay` are unmounted when navigating to `STANDALONE_MODULES` (e.g., `onboarding`), causing loss of transient state like chat drafts or input text.
**Action:** When working on persistence, move `CommandBar` state to a global store (Zustand) or ensure `STANDALONE_MODULES` layout wraps these components instead of unmounting them.
