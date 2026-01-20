## 2024-05-23 - Dead Code Confusion
**Learning:** `ConversationHistoryList` component exists but is unused, while the `Sidebar` lacks expected "History" navigation. This architectural mismatch creates a "broken promise" where code exists but functionality is unreachable.
**Action:** When implementing History features, verify if `ConversationHistoryList` is viable or if it should be deprecated in favor of a new implementation in `ChatOverlay` or `Sidebar`.
