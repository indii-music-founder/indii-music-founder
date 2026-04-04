---
name: "Gemini API Developer"
description: "Best-practice guidance for writing correct, current Gemini API code using live documentation via the Gemini API Docs MCP tool."
---

# Gemini API Developer Skill

This skill pairs with the **Gemini API Docs MCP** tool (`gemini-api-docs` server) to ensure all Gemini API code generated is accurate, current, and follows SDK conventions. Together they achieve a **96.3% pass rate** on evaluation benchmarks with **63% fewer tokens** versus baseline prompting.

> **Reference:** [ai.google.dev/gemini-api/docs/coding-agents](https://ai.google.dev/gemini-api/docs/coding-agents)

---

## 1. Core Problem This Solves

Agent training data has a cutoff date. Gemini API surface area changes frequently — new models ship, parameter names evolve, SDK conventions shift. Without live documentation access, agents generate outdated code that silently fails at runtime.

**Solution:** Always query the `gemini-api-docs` MCP server before writing any Gemini API integration code.

---

## 2. When to Invoke

Invoke this skill whenever the task involves:

- Calling any `@google/genai`, `genkit`, or `firebase/genai` SDK method
- Referencing a Gemini model by name (e.g. `gemini-2.5-pro`, `gemini-2.0-flash`)
- Building a new AI feature, tool call, or prompt template
- Updating an existing service in `src/services/ai/` or `src/services/agent/`
- Generating DDEX metadata, audio analysis, or image/video generation calls
- Any task that touches `VITE_API_KEY` or Gemini model config

---

## 3. Standard Operating Procedure

### Step 1 — Query the MCP Before Writing

Before writing any Gemini API code, query the live docs:

```
// Example: look up current model IDs
gemini-api-docs: list_models()

// Example: check SDK method signature
gemini-api-docs: get_method("generateContent")

// Example: fetch a specific guide
gemini-api-docs: get_doc("function-calling")
```

### Step 2 — Resolve Model Names

Never hardcode a model name from memory. Always resolve current model IDs via the MCP:

| Use Case | Query |
|----------|-------|
| Primary reasoning | `gemini-api-docs: get_model("pro")` |
| Fast/utility tasks | `gemini-api-docs: get_model("flash")` |
| Embeddings | `gemini-api-docs: get_model("embedding")` |
| Long context | `gemini-api-docs: get_model("pro", context="long")` |

Map results to `src/core/config/ai-models.ts` — **always import model constants from there**, never inline.

### Step 3 — Validate SDK Method Signatures

Confirm parameter shapes from live docs before use. Key areas that change frequently:

- `GenerationConfig` fields (`responseModalities`, `thinkingConfig`, `speechConfig`)
- Tool/function calling schema (`FunctionDeclaration`, `Tool`)
- Safety settings enum values
- File upload / multimodal input shapes

### Step 4 — Check for Deprecations

Query the MCP for migration notes before using any method older than the last major SDK release:

```
gemini-api-docs: get_migration_notes("@google/genai")
```

---

## 4. indiiOS-Specific Patterns

### AI Service Layer

All Gemini calls in indiiOS route through the service layer. When updating:

| Service | Location |
|---------|----------|
| Gemini wrapper | `src/services/ai/AIService.ts` |
| Genkit flows | `src/services/ai/` |
| Model constants | `src/core/config/ai-models.ts` |
| Agent orchestration | `src/services/agent/` |

**Never** call the Gemini SDK directly from a component or module. Always go through the service layer.

### Environment Variables

```typescript
// CORRECT
const model = import.meta.env.VITE_API_KEY;

// VIOLATION — hardcoded key
const model = "AIza...";
```

### Genkit vs. @google/genai

- Use **Genkit** (`genkit`) for Firebase Functions / Cloud-side flows
- Use **`@google/genai`** for client-side and Electron-side calls
- Never mix SDK imports within the same service file

---

## 5. Quality Gates

Before marking any Gemini API task complete:

- [ ] Model name resolved via MCP (not from memory)
- [ ] SDK method signature verified against live docs
- [ ] No deprecated methods used
- [ ] All calls route through `src/services/ai/` — no direct SDK calls in components
- [ ] Model constant added to / imported from `src/core/config/ai-models.ts`
- [ ] No API keys hardcoded (see `docs/API_CREDENTIALS_POLICY.md`)
