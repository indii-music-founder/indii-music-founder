## 2024-05-23 - [Persistence Gap in Agent Chat]
**Learning:** "The Amnesia Check" revealed that the AI's conversation history was entirely ephemeral. Messages were stored in the local Zustand state but were never synchronized with `SessionService` (Firestore/Electron), meaning a page refresh would wipe the context.
**Action:** Implemented persistence calls in `agentSlice.ts` (`addAgentMessage`, `updateAgentMessage`, `clearAgentHistory`) to trigger `SessionService.updateSession` asynchronously. Verified with `agentSlice.persistence.test.ts`.

## 2024-05-23 - [Token Budget Gap in Chat]
**Learning:** "The Context Gap" test revealed that `FirebaseAIService.chat` was bypassing `TokenUsageService.checkQuota`, allowing users to start potentially expensive chat sessions even if they exceeded their daily limit.
**Action:** Added `TokenUsageService.checkQuota(userId)` call to `chat` method. Verified with `Keeper_ContextGap.test.ts`.
