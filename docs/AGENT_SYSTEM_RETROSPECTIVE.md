# Agent System Retrospective & Best Practices

**Date:** December 24, 2025
**Scope:** Agent Architecture, Gemini 3 Migration, Native RAG (File Search), and Model Safety

## Executive Summary

This document summarizes the major refactoring and upgrades of the Agent System in December 2025. Key accomplishments include the successful migration to Gemini 3 models, the implementation of a native RAG solution using the Gemini Files API, and the introduction of strict runtime model enforcement to prevent regressions.

## 1. Major Changes

### 1.1 Decoupled Configuration

- **Old State:** A single `agentConfig.ts` file contained all agent definitions, leading to massive merge conflicts and difficult maintenance.
- **New State:** Agents are defined in individual files within `src/services/agent/definitions/`.
- **Guideline:** Always create a new file in `definitions/` for a new agent. Do not modify `AgentService.ts` to add agent logic.

### 1.2 Type Safety

- **Old State:** Loose typing allowed invalid tools and configurations.
- **New State:** A strict `AgentConfig` interface and Zod schemas enforce valid configurations at compile time.
- **Guideline:** All agents must explicitly type their configuration using `AgentConfig`.

### 1.3 Agent-to-Agent Delegation

- **Capability:** Agents can now strictly delegate sub-tasks to other specialized agents using the `delegate_task` tool.
- **Mechanism:** The `BaseAgent` and `AgentService` have been updated to handle recursive agent calls.

### 1.4 Gemini 3 Model Policy

- **Standardization:** The system now exclusively uses `gemini-3-pro-preview` for complex reasoning/agents and `gemini-3-flash-preview` for fast routing and simple tasks.
- **Enforcement:** Runtime validation in `ai-models.ts` ensures that legacy models (Gemini 1.5/2.0) are completely blocked, preventing application crashes and ensuring consistency.

### 1.5 Native RAG (File Search) Migration

- **Architecture:** We moved away from the legacy Semantic Retriever (Corpus API) due to instability.
- **Implementation:** The system now uses the Gemini Files API, leveraging the model's Long Context Window (up to 2M tokens) for RAG rather than chunking/vector-search.
- **Constraint:** `gemini-3-flash-preview` currently requires inline text fallback for files, as it rejects `fileData` with 400 errors.

### 1.6 Image Generation V3

- **SDK:** Transitioned from Vertex AI to the Generative Language API (AI Studio) for image synthesis using `gemini-3-pro-image-preview`.
- **Optimization:** Models now support native aspect ratio control and generation config within the standard `generateContent` flow.

## 2. Lessons Learned & Anti-Patterns (The "Don't Do This" List)

### 2.1 AI Service Response Handling

**Problem:** Many services were accessing raw API responses directly (e.g., `response.candidates[0].content...`). This is brittle and broke when we introduced a response wrapper.
**Solution:**

- **Text:** ALWAYS use `response.text()` to get the text output.
- **Function Calls:** ALWAYS use `response.functionCalls()` to get tool calls.
- **Raw Data (Images/Video):** Only access `response.response.candidates` if you specifically need non-text/non-function data (like `inlineData` for images). Wrappers should eventually cover this too.

### 2.2 Test Mocks

**Problem:** Tests were failing because mocks returned simple strings or raw objects, while the refactored code expected the `AIService` wrapper methods (`text()`, `functionCalls()`).
**Solution:** When mocking `AI.generateContent`, ensure the mock returns an object complying with the `GenerateContentResult` interface (or at least having the methods you call).

```typescript
// Correct Mock Pattern
vi.spyOn(AI, 'generateContent').mockResolvedValue({
  text: () => "Mock response",
  functionCalls: () => [],
  response: { ...rawResponse } 
} as any);
```

### 2.3 Circular Dependencies

**Problem:** `BaseAgent` needs `AgentService` (for delegation), and `AgentService` needs `BaseAgent` (for execution).
**Solution:** Use dynamic/lazy imports (`await import(...)`) for the dependency that causes the cycle, typically inside the method that needs it, rather than at the top level.

### 2.4 Model Selection Discipline

**Problem:** Using deprecated models (like Gemini 1.5) leads to subtle failures or outright crashes due to API differences (e.g., thinking levels).
**Solution:** NEVER hardcode model strings. Always use the central `AI_MODELS` configuration.

### 2.5 RAG API Limitations

**Problem:** `gemini-3-flash-preview` throws `400 Bad Request` when passed `fileData` URIs.
**Solution:** Implement an "Inline Fallback" in `GeminiRetrievalService` that reads text files and injects them directly into the prompt context for models that don't yet support the native Files API path.

## 3. Future Development Guidelines

1. **New Agents:** Copy `definitions/GeneralistAgent.ts` as a template.
2. **New Tools:** Register in `tools.ts` and ensure strict parameter typing.
3. **Model Usage:** Always import from `@/core/config/ai-models`. Hardcoding strings is a terminal violation.
4. **Refactoring:** Run `tsc` frequently. The strict types will catch 90% of issues before runtime.
5. **Testing:** When testing agents, mock the **tools**, not just the AI response, to verify logic flows.
