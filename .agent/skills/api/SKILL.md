---
name: API
description: Master guide for Gemini 3, Interactions API, Deep Research, and Google GenAI SDK (v1.55+/v1.33+).
---

# Antigravity API Expert: Gemini 3 & Interactions

> **Guidance:** This is the authoritative reference for the **Gemini 3** model family and the **Google GenAI SDK** (`google-genai`). Legacy libraries (`google-generativeai`) are deprecated.

## 1. Quick Start: The New SDKs

**Do not** use `google-generativeai`. Use the unified **Google GenAI SDK**.

### Installation

| Language | Package | Version Req | Command |
| :--- | :--- | :--- | :--- |
| **Python** | `google-genai` | `1.55.0+` | `pip install -q -U google-genai` |
| **Node.js** | `@google/genai` | `1.33.0+` | `npm install @google/genai` |
| **Go** | `google.golang.org/genai` | latest | `go get google.golang.org/genai` |

### Basic Client Setup

**Python**

```python
from google import genai
client = genai.Client() # Auto-reads GEMINI_API_KEY
```

**JavaScript**

```javascript
import { GoogleGenAI } from "@google/genai";
const client = new GoogleGenAI({}); // Auto-reads GEMINI_API_KEY
```

---

## 2. Gemini 3 Configuration (CRITICAL)

### 2.1 Thinking Level (`thinking_level`)

Gemini 3 models think before speaking. **Legacy `thinking_budget` is BANNED.**

| Level | Description | Supported Models |
| :--- | :--- | :--- |
| `minimal` | No thinking. Max speed/throughput. | **Flash Only** |
| `low` | Light reasoning. Fast chat/instruction. | All Thinking Models |
| `medium` | Balanced reasoning. | **Flash Only** |
| `high` | (Default) Deepest reasoning. | All Thinking Models |

**Configuration Example (Python):**

```python
config=types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(thinking_level="low"),
    temperature=1.0 # MUST BE 1.0
)
```

### 2.2 Media Resolution (`media_resolution`)

Control token usage vs. fidelity. *Note: Currently strictly enforced in v1alpha.*

| Setting | Images (Tokens) | Video (Tokens/Frame) | Use Case |
| :--- | :--- | :--- | :--- |
| `low` | 280 | 70 | Previews, fast scanning. |
| `medium` | 560 | 70 | Standard web, Docs/PDFs. |
| `high` | 1120 | 280 | **OCR**, Fine details, Dense text. |

### 2.3 Thought Signatures (The Continuity Key)

**Protocol:** You MUST pass back `thoughtSignature` from the response to the next request to maintain reasoning context.

* **Strict Validation:** Function Calls, Image Generation/Editing.
* **Parallel Function Calls:** Only the *first* function call in a parallel block contains the signature. Return it with the first call.
* **Bypass:** If injecting external context or migrating models, use: `"thoughtSignature": "context_engineering_is_the_way_to_go"`

---

## 3. The Interactions API (Beta)

**Purpose:** Unified state management, agent orchestration, and long-running tasks.

### 3.1 Standard Interaction & State

**Python**

```python
# Turn 1
i1 = client.interactions.create(
    model="gemini-3-flash-preview", 
    input="Hi, I'm Phil.",
    store=True # Default: Retains history for using previous_interaction_id
)

# Turn 2 (Stateful)
i2 = client.interactions.create(
    model="...", 
    input="Who am I?", 
    previous_interaction_id=i1.id
)
```

### 3.2 Agents & Async (Deep Research)

Use `agent` instead of `model`. Usage `background=True` for long tasks.

**Python**

```python
# Start
op = client.interactions.create(
    agent="deep-research-pro-preview-12-2025",
    input="Research timelines for Quantum Computing in 2026.",
    background=True
)

# Poll / Stream
while True:
    status = client.interactions.get(op.id)
    if status.status == "completed":
        print(status.outputs[-1].text)
        break
    time.sleep(5)
```

---

## 4. Multimodal Generation & Tools

### 4.1 Image Generation (Nano Banana Pro)

Model: `gemini-3-pro-image-preview`
**Note:** Editing requires `thoughtSignature` continuity.

```python
interaction = client.interactions.create(
    model="gemini-3-pro-image-preview",
    input="Cyberpunk Tokyo in rain.",
    response_modalities=["IMAGE"],
    generation_config={
        "image_config": {"aspect_ratio": "16:9", "image_size": "2k"}
    }
)
```

### 4.2 Built-in Tools

* `google_search` - Grounding.
* `code_execution` - Python sandbox.
* `url_context` - Read external URLs.
* `computer_use` - Browser automation (Model: `gemini-2.5-computer-use-preview-10-2025`).

### 4.3 Remote MCP (Streamable HTTP)

**Constraint:** Interactions API supports Remote MCP (Model Context Protocol), but strictly for Streamable HTTP (Not SSE).

* *Note: Remote MCP does not work with Gemini 3 models yet (Coming Soon).*

```python
mcp_server = {
    "type": "mcp_server",
    "name": "weather_service",
    "url": "https://.../mcp" # Must be Streamable HTTP
}
```

### 4.4 Structured Output (Pydantic/Zod)

Use `response_format` with a schema.

```python
interaction = client.interactions.create(
    ...,
    response_format=Result.model_json_schema()
)
```

---

## 5. Migration Guide (Legacy -> GenAI SDK)

| Feature | Legacy (`google-generativeai`) | New (`google-genai`) |
| :--- | :--- | :--- |
| **Package** | `pip install google-generativeai` | `pip install google-genai` |
| **Import** | `import google.generativeai as genai` | `from google import genai` |
| **Client** | `genai.GenerativeModel(...)` | `client = genai.Client()` |
| **Generate** | `model.generate_content(...)` | `client.models.generate_content(...)` |
| **Chat** | `model.start_chat(...)` | `client.interactions.create(...)` or `chats` |

---

## 6. Model IDs Reference

* **Reasoning:** `gemini-3-pro-preview`, `gemini-3-flash-preview`
* **Images:** `gemini-3-pro-image-preview` (Nano Banana Pro)
* **Video Gen:** `veo-3.1-generate-preview` (Coming soon)
* **Agents:** `deep-research-pro-preview-12-2025`
* **Computer Use:** `gemini-2.5-computer-use-preview-10-2025`
