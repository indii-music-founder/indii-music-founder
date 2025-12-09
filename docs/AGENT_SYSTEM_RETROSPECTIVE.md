# Agent System Retrospective & Best Practices

**Date:** December 9, 2025
**Scope:** Agent Architecture Refactoring, Delegation, and Type Safety

## Executive Summary

This document summarizes the major refactoring of the Agent System, the introduction of new capabilities (Delegation, Structured RAG), and the lessons learned to prevent future regressions.

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

## 3. Future Development Guidelines

1. **New Agents:** Copy `definitions/GeneralistAgent.ts` as a template.
2. **New Tools:** Register in `tools.ts` and ensure strict parameter typing.
3. **Refactoring:** Run `tsc` frequently. The strict types will catch 90% of issues before runtime.
4. **Testing:** When testing agents, mock the **tools**, not just the AI response, to verify logic flows.
