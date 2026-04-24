# Phase 2: AI Orchestration & Memory Refactor Worksheet

**Objective:** Complete the transition to the new Phase 2 Agent Orchestration and Always-On Memory architecture. This requires finalizing the integration of the unified `FirebaseAIService` via the `GenAI` facade, deprecating the legacy `AIService`, strictly enforcing the new type contracts (`ReflectionResult`, `ContextFrame`), and building out the persistent memory hierarchy.

---

## 🏗 CURRENT ARCHITECTURE STATE
- **Facade Pattern:** `GenAI.ts` acts as the stable API boundary, delegating to `FirebaseAIService`.
- **Core Engine:** `FirebaseAIService` handles App Check, dynamic config (Remote Config), rate limiting, circuit breaking, and fallbacks to the raw `@google/genai` SDK when App Check is missing.
- **Generators:** High-level tasks (Text, Structured Data, Multimodal) are decoupled into `HighLevelAPI.ts`, using prompt sanitization and semantic caching.
- **Legacy Components:** `AIService.ts` is currently a legacy wrapper pointing to `GenAI` but must be fully deprecated.

---

## 📋 STEP-BY-STEP EXECUTION WORKSHEET

### Step 1: Deprecate & Strip Legacy `AIService`
*Goal: Remove all dependencies on the old AI service implementation to standardize around `GenAI`.*
- [ ] **Audit Callers:** Run a global regex search for `import .* from .*AIService` and `import .* from .*AIService.ts`.
- [ ] **Migrate Imports:** Refactor all identified callers to import the `GenAI` singleton from `packages/renderer/src/services/ai/GenAI.ts`.
- [ ] **Update Method Signatures:** Ensure legacy callers using `generateContent` or `chat` map cleanly to the new `GenAI.generateText()` or `GenAI.chat()` generator functions.
- [ ] **Delete Legacy File:** Once all callers are migrated, delete `packages/renderer/src/services/ai/AIService.ts`.

### Step 2: Reconcile Type Contracts (`ReflectionResult` & `ContextFrame`)
*Goal: Ensure the Agent Orchestration layer types match the new AI service outputs perfectly without casting errors.*
- [ ] **Audit `types.ts`:** Verify `packages/renderer/src/services/ai/types.ts` strictly exports bridging types for the `FirebaseAIService`.
- [ ] **Define `ContextFrame`:** Ensure `ContextFrame` includes properties for temporal tracking, entity tags, importance decay, and the raw payload.
- [ ] **Define `ReflectionResult`:** Ensure `ReflectionResult` captures the model's self-evaluation metrics (`shouldIterate`, `feedback`, `confidenceScore`).
- [ ] **Fix TypeScript Errors:** Run `npx tsc --noEmit` and resolve any cross-file type mismatches resulting from the type updates.

### Step 3: Implement Phase 2 Persistent Memory Hierarchy
*Goal: Build the 5-layer persistent memory service as detailed in the Advanced Improvements Roadmap.*
- [ ] **Create `PersistentMemoryService.ts`:**
  - **Scratchpad:** Session-local volatile state (`~5KB`).
  - **Session:** IndexedDB storage for recent decisions (24-hour window).
  - **CORE Vault:** Firestore-backed persistent long-term storage for learned patterns and preferences.
  - **Captain's Logs:** Firestore append-only log for auditability.
  - **RAG Index:** Semantic search layer over past work.
- [ ] **Create `MemoryIndexService.ts`:**
  - Implement basic semantic similarity search capabilities for RAG context retrieval.
- [ ] **Update Zustand Store (`agent.ts` slice):**
  - Integrate `AgentMemorySlice` to track current memory context, streaming state, and past decisions.

### Step 4: Implement Multi-Turn Reflection & Orchestration
*Goal: Enable the agent to evaluate its own outputs and iterate.*
- [ ] **Create `ReflectionLoop.ts`:**
  - Implement the `evaluate(response, context)` method to yield a `ReflectionResult`.
  - Wire logic that triggers automatic re-generation if `shouldIterate` is true and confidence is low.
- [ ] **Create `ContextStackService.ts`:**
  - Manage the multi-turn state. Ensure past reflections are pushed to the context stack.
- [ ] **Update `OrchestrationService.ts` / `BaseAgent.ts`:**
  - Plumb `ReflectionLoop` and `PersistentMemoryService` into the primary agent execution loop.

### Step 5: Implement Streaming & UI Integration
*Goal: Provide real-time token streaming to the UI.*
- [ ] **Create `AgentStreamingService.ts`:**
  - Handle SSE (Server-Sent Events) payload consumption.
- [ ] **Create UI Components:**
  - **`StreamingAgentCard.tsx`:** Renders live tokens with cursor blink and typing indicators.
  - **`ReflectionPanel.tsx`:** Displays the agent's internal reasoning, iteration count, and decision log.
  - **`MemoryBrowserPanel.tsx`:** A read-only UI for inspecting the 5 layers of memory.
- [ ] **Implement React Hooks:**
  - `useAgentStream.ts`
  - `useMemoryQuery.ts`
  - `useContextStack.ts`

### Step 6: Platinum Quality & CI Verification
*Goal: Ensure zero regressions and 100% test coverage for the new architecture.*
- [ ] **Write Unit Tests:**
  - `PersistentMemoryService.test.ts`
  - `AgentStreamingService.test.ts`
  - `ReflectionLoop.test.ts`
- [ ] **Run Platinum Checks:**
  - Execute `/plat` workflow to ensure no Seven Anti-Patterns exist.
  - Verify `npm run typecheck`, `npm run lint`, and `npm test` are 100% green.
  - Test UI in the browser to confirm streaming and memory persistence behave correctly.

---

## 🔒 SECURITY & SANITIZATION (REMINDERS)
- **Fallback Client:** Always ensure the `@google/genai` Fallback Client strictly respects the `InputSanitizer`.
- **API Keys:** Never hardcode API keys. Rely exclusively on `VITE_FIREBASE_APP_CHECK_KEY` and `VITE_API_KEY` mapped from `.env`.
- **RAG Context:** Ensure any data fetched from the CORE Vault or RAG Index is stripped of PII before being injected into the `ContextFrame`.
