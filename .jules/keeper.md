# Keeper 📚 - Memory & Persistence Journal

## Philosophy
- Intelligence is 10% compute, 90% context
- A goldfish has no place in an AI app; remember the user's name
- If it isn't saved to disk, it didn't happen
- The Context Window is expensive real estate; treat it like gold

## Critical Learnings

## 2026-01-20 - Dual Write Persistence Verified
**Learning:** The `SessionService` implements a critical "Dual Write" pattern where chat history is sent to both Firestore (Cloud) and `electronAPI` (Local File System). This ensures that if the cloud is unreachable or for offline-first support, the local state is preserved.
**Action:** Always mock `window.electronAPI` when testing `SessionService` to ensure this contract is not broken by future refactors. The test `src/services/agent/SessionService.test.ts` now guards this.

## 2026-05-21 - Cold Boot Verification
**Learning:** To verify "Cold Boot" persistence in backend tests (`electron/`), we must instantiate the Store class *twice*: once to write, and once to read (new instance), pointing to the same file path. This proves that the data is not just in memory but successfully serialized and deserialized.
**Action:** Use `electron/services/HistoryStore.test.ts` as the pattern for testing offline persistence.
