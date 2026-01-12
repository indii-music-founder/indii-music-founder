## 2024-05-23 - [Persistence Gap in Agent Chat]
**Learning:** "The Amnesia Check" revealed that the AI's conversation history was entirely ephemeral. Messages were stored in the local Zustand state but were never synchronized with `SessionService` (Firestore/Electron), meaning a page refresh would wipe the context.
**Action:** Implemented persistence calls in `agentSlice.ts` (`addAgentMessage`, `updateAgentMessage`, `clearAgentHistory`) to trigger `SessionService.updateSession` asynchronously. Verified with `agentSlice.persistence.test.ts`.

## 2024-05-23 - [Token Budget Gap in Chat]
**Learning:** "The Context Gap" test revealed that `FirebaseAIService.chat` was bypassing `TokenUsageService.checkQuota`, allowing users to start potentially expensive chat sessions even if they exceeded their daily limit.
**Action:** Added `TokenUsageService.checkQuota(userId)` call to `chat` method. Verified with `Keeper_ContextGap.test.ts`.

## 2024-05-24 - [Infinite Context Leak in BaseAgent]
**Learning:** "The Elephant" test revealed that `BaseAgent` was blindly injecting the entire `context.chatHistoryString` AND the full `context` JSON (containing the history again) into the prompt. A 50k token history became a 100k+ token prompt, doubling costs and risking overflow.
**Action:** Implemented "Context Squeeze" in `BaseAgent.ts` to: 1) Strip `chatHistoryString` from the JSON context dump, and 2) Enforce a strict 32k char limit (~8k tokens) on the injected history string. Verified with `Keeper_ContextIntegrity.test.ts`.
