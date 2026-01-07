## 2024-05-23 - [Persistence Gap in Agent Chat]
**Learning:** "The Amnesia Check" revealed that the AI's conversation history was entirely ephemeral. Messages were stored in the local Zustand state but were never synchronized with `SessionService` (Firestore/Electron), meaning a page refresh would wipe the context.
**Action:** Implemented persistence calls in `agentSlice.ts` (`addAgentMessage`, `updateAgentMessage`, `clearAgentHistory`) to trigger `SessionService.updateSession` asynchronously. Verified with `agentSlice.persistence.test.ts`.
