---
name: API
description: Expert on Gemini 3, Interactions API, Deep Research, and Google GenAI SDK.
---

# Antigravity API Expert

**Guidelines for Gemini 3, Interactions API, & SDK.**

## 1. Gemini 3 Specs (CRITICAL)

* **Thinking:** `thinking_level` (NOT budget).
  * `high` (Default): Max reasoning.
  * `low`: Fast, simple instruction.
  * `medium`: Balanced (Flash Only).
  * `minimal`: No thinking (Flash Only).
  * *Note: `thinking_summaries="auto"` returns human-readable thought blocks.*
* **Temp:** MUST be `1.0`. Lower degrades reasoning.
* **Signatures:** `thoughtSignature` REQUIRED for Multi-turn/Function/Edit.
  * **Strict:** Function Calls, Image Editing.
  * **Bypass:** `"thoughtSignature": "context_engineering_is_the_way_to_go"`.
* **Media Resolution (Input):** `media_resolution` (v1alpha only).
  * **Images:** Low (280), Med (560), High (1120).
  * **Video:** Low/Med (70/frame), High (280/frame - Text heavy).
  * **PDF:** Medium (560).

## 2. Models & Agents

* **Gemini 3 Pro/Flash:** General reasoning.
* **Deep Research Agent:** `deep-research-pro-preview-12-2025`.
  * Use `interactions.create(..., agent="...", background=True)`.
* **Computer Use:** `gemini-2.5-computer-use-preview-10-2025`.

## 3. Interactions API (Beta)

* **Unified Interface:** Managing state, tools, and agents.
* **Stateful:** Pass `previous_interaction_id`.
* **Generative:** `client.interactions.create(model="...", input="...")`.
* **Tools:** `google_search`, `code_execution`, `url_context`, `computer_use`.
* **MCP:** Remote MCP via Streamable HTTP (Not on Gemini 3 yet).

## 4. Code (Python SDK `google-genai`)

### Standard Generation (Production)

```python
response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="Query...",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="high"),
        temperature=1.0
    ),
)
```

### Interactions (Agentic/Beta)

```python
# Deep Research (Background)
op = client.interactions.create(
    agent="deep-research-pro-preview-12-2025",
    input="Research TPUs...",
    background=True
)
# Poll results via client.interactions.get(op.id)
```

## 5. Troubleshooting

* **400:** Missing `thoughtSignature` or `thinking_budget` usage.
* **402:** Billing/Quota.
* **403:** Permission (`roles/aiplatform.user`) or Location.
* **429:** Rate Limit.
