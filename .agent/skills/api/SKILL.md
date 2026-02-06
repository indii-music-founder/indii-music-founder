---
name: API
description: Platinum-level expert on Gemini 3, Interactions API, Deep Research, Google GenAI SDK, and Agentic Workflows.
version: 2.0.0
last_updated: 2026-02-06
---

# Antigravity API Expert (Platinum Level)

**Comprehensive guidelines for Gemini 3, Interactions API, Agentic Workflows & SDK.**

---

## 1. Model Selection Matrix (CRITICAL)

| Use Case | Model ID | Context | Thinking | Notes |
|----------|----------|---------|----------|-------|
| **Complex Reasoning** | `gemini-3-pro-preview` | 1M/64k | `low`, `high` | Default: `high` |
| **Fast Tasks** | `gemini-3-flash-preview` | 1M/64k | `minimal`, `low`, `medium`, `high` | Default: dynamic |
| **Image Generation** | `gemini-3-pro-image-preview` | 65k/32k | N/A | "Nano Banana Pro" |
| **Video Generation** | `veo-3.1-generate-preview` | N/A | N/A | 4K/1080p + Audio |
| **Deep Research** | `deep-research-pro-preview-12-2025` | N/A | N/A | Background agent |
| **Computer Use** | `gemini-2.5-computer-use-preview-10-2025` | N/A | N/A | Browser automation |
| **TTS** | `gemini-2.5-pro-tts` | N/A | N/A | Audio synthesis |

---

## 2. Thinking Configuration (Gemini 3)

### 2.1 Thinking Level (`thinkingLevel`) — REQUIRED for Gemini 3

| Level | Model | Behavior |
|-------|-------|----------|
| `minimal` | Flash only | No thinking for most queries. Minimal latency. |
| `low` | Pro & Flash | Minimizes latency/cost. Simple instruction following. |
| `medium` | Flash only | Balanced thinking for most tasks. |
| `high` | Pro & Flash | **DEFAULT.** Maximizes reasoning depth. |

> **⚠️ CRITICAL:** Do NOT use `thinking_budget` for Gemini 3. It is deprecated (Gemini 2.5 only).

### 2.2 Thought Summaries

```python
# Enable human-readable thought blocks
config = types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(
        thinking_level="high",
        include_thoughts=True  # Returns synthesized thought summaries
    )
)
```

### 2.3 Temperature — MUST BE 1.0

Gemini 3's reasoning is calibrated for `temperature=1.0`. Lowering causes:

- Infinite loops
- Degraded reasoning
- Unexpected behavior in math/coding tasks

**Exception:** RAG/Grounding tasks → Set to `0.0` for maximum factuality.

---

## 3. Thought Signatures (CRITICAL)

Thought signatures are **encrypted representations** of the model's internal thought process. They preserve reasoning context across multi-turn interactions.

### 3.1 When Required

| Scenario | Validation | Consequence |
|----------|------------|-------------|
| **Function Calling** | **STRICT** (Current Turn) | 400 Error if missing |
| **Image Generation/Editing** | **STRICT** | 400 Error if missing |
| **Text/Chat** | Recommended | Degraded reasoning quality |
| **Minimal Thinking (Flash)** | **STRICT** | Still required even at `minimal` |

### 3.2 Handling Signatures

**SDK Auto-Handling (Recommended):**

```python
# Using chat features or appending full responses → automatic
chat = client.chats.create(model="gemini-3-pro-preview")
response = chat.send_message("Hello")
# Signatures handled automatically
```

**Manual Handling (REST/Custom):**

```python
# 1. Extract signature from response parts
thought_signature = response.candidates[0].content.parts[0].thought_signature

# 2. Include in next request EXACTLY as received
history = [
    {"role": "user", "parts": [{"text": "First message"}]},
    {"role": "model", "parts": [{"text": "Response", "thought_signature": thought_signature}]},
    {"role": "user", "parts": [{"function_response": {...}}]}
]
```

### 3.3 Parallel vs Sequential Function Calls

- **Parallel:** First `functionCall` part has signature. Send back: `FC1 + signature, FC2, FR1, FR2`
- **Sequential:** Each step's `functionCall` has its own signature.

### 3.4 Bypass for New Conversations

```python
# Starting fresh without prior context
thought_signature = "INCLUDE_THOUGHTS_NEW_CONVERSATION"
```

---

## 4. Media Resolution (Input Processing)

Control token allocation per input media via `media_resolution` (v1alpha API only).

### 4.1 Resolution Levels

| Level | Tokens/Image | Tokens/Video Frame | Use Case |
|-------|--------------|-------------------|----------|
| `media_resolution_low` | 280 | 70 | Thumbnails, quick classification |
| `media_resolution_medium` | 560 | 70 | PDFs, standard documents |
| `media_resolution_high` | 1120 | 280 | OCR, fine text, detailed editing |
| `media_resolution_ultra_high` | N/A | N/A | Global endpoint only |

### 4.2 Recommended Settings

| Media Type | Setting | Reason |
|------------|---------|--------|
| **Images** | `high` | Maximum quality for analysis |
| **PDFs** | `medium` | Quality saturates at medium |
| **Video (General)** | `low` or `medium` | Action recognition |
| **Video (Text-Heavy)** | `high` | OCR, on-screen text |

### 4.3 Code Example

```python
from google import genai
from google.genai import types

# Use v1alpha for media_resolution support
client = genai.Client(http_options={'api_version': 'v1alpha'})

response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents=[
        types.Part.from_image(image_bytes, media_resolution="media_resolution_high"),
        types.Part.from_text("Describe this image in detail.")
    ],
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="high"),
        temperature=1.0
    ),
)
```

---

## 5. Interactions API (Beta)

Unified interface for stateful, tool-enabled, and agentic workflows.

### 5.1 Core Concepts

```python
from google import genai

client = genai.Client()

# Create an interaction (stateful)
interaction = client.interactions.create(
    model="gemini-3-pro-preview",
    input="Search for the latest AI news and summarize.",
    tools=["google_search", "url_context"]
)

# Continue the interaction (pass previous ID)
followup = client.interactions.create(
    model="gemini-3-pro-preview",
    input="Now focus on the Gemini announcements.",
    previous_interaction_id=interaction.id
)
```

### 5.2 Available Tools

| Tool | Description |
|------|-------------|
| `google_search` | Web search grounding ($14/1k queries) |
| `code_execution` | Run Python code in sandbox |
| `url_context` | Fetch and process URL content |
| `computer_use` | Browser automation (2.5 only) |

### 5.3 Background Agents (Deep Research)

```python
# Long-running background research
operation = client.interactions.create(
    agent="deep-research-pro-preview-12-2025",
    input="Comprehensive analysis of TPU v5 architecture",
    background=True
)

# Poll for results
while not operation.done:
    time.sleep(30)
    operation = client.operations.get(operation.id)

print(operation.result)
```

---

## 6. Grounding with Structured Outputs (NEW)

Combine Google Search grounding with JSON schema outputs for downstream processing.

```python
response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="Find the 2025 World Series champion and their stadium location.",
    config=types.GenerateContentConfig(
        tools=[{"google_search": {}}],
        response_mime_type="application/json",
        response_schema={
            "type": "object",
            "properties": {
                "team": {"type": "string"},
                "stadium": {"type": "string"},
                "city": {"type": "string"}
            },
            "required": ["team", "stadium", "city"]
        }
    ),
)
```

---

## 7. Production Code Templates

### 7.1 Standard Generation (Production)

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="Explain quantum computing to a 10-year-old.",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="high"),
        temperature=1.0,
        max_output_tokens=8192,
    ),
)

# Access thinking (if include_thoughts=True)
for part in response.candidates[0].content.parts:
    if hasattr(part, 'thought') and part.thought:
        print(f"Thought: {part.thought}")
    if part.text:
        print(f"Response: {part.text}")
```

### 7.2 Function Calling with Signatures

```python
from google import genai
from google.genai import types

client = genai.Client()

# Define tools
get_weather = types.FunctionDeclaration(
    name="get_weather",
    description="Get weather for a location",
    parameters={
        "type": "object",
        "properties": {
            "location": {"type": "string", "description": "City name"}
        },
        "required": ["location"]
    }
)

# Initial request
response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="What's the weather in Tokyo?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(function_declarations=[get_weather])]
    ),
)

# Extract function call and signature
fc = response.candidates[0].content.parts[0]
signature = fc.thought_signature  # MUST capture this

# Execute function and respond
function_response = {"temperature": "22°C", "condition": "Sunny"}

# Include signature in history
history = [
    {"role": "user", "parts": [{"text": "What's the weather in Tokyo?"}]},
    {"role": "model", "parts": [{"function_call": fc.function_call, "thought_signature": signature}]},
    {"role": "user", "parts": [{"function_response": {"name": "get_weather", "response": function_response}}]}
]

final_response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents=history,
    config=types.GenerateContentConfig(
        tools=[types.Tool(function_declarations=[get_weather])]
    ),
)
```

### 7.3 TypeScript/Node.js

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: "Explain quantum computing.",
    config: {
        thinkingConfig: { thinkingLevel: "high" },
        temperature: 1.0,
    },
});

console.log(response.text);
```

---

## 8. Error Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| **400** | Missing `thoughtSignature` | Include signature from previous response |
| **400** | Using `thinking_budget` | Replace with `thinking_level` |
| **400** | Interleaved FC/FR order | Use `FC1+sig, FC2, FR1, FR2` not `FC1+sig, FR1, FC2, FR2` |
| **402** | Billing/Quota exceeded | Check Cloud billing console |
| **403** | Missing permission | Grant `roles/aiplatform.user` |
| **403** | Wrong location | Use `global` for preview models |
| **429** | Rate limit | Implement exponential backoff |

---

## 9. Best Practices for Gemini 3

1. **Instruction Placement:** For long-context, place specific instructions at the **END** of the prompt (after data).
2. **Structured Prompts:** Use standardized XML tags and explicitly define ambiguous terms.
3. **Output Verbosity:** Gemini 3 is more verbose by default. If responses are too long, specify conciseness in the prompt.
4. **Multimodal Coherence:** Reference specific modalities clearly in instructions.
5. **Version Pinning:** Use `gemini-3-pro-preview` explicitly, not `gemini-pro`.
6. **Agentic System Instructions:** Use the official Gemini 3 agentic system instruction template for coding agents.

---

## 10. SDK Reference

| Language | Package | Install |
|----------|---------|---------|
| Python | `google-genai` | `pip install google-genai` |
| Node.js | `@google/genai` | `npm install @google/genai` |
| Go | `google.golang.org/genai` | `go get google.golang.org/genai` |
| Java | `com.google.genai` | Maven/Gradle |

---

## 11. Pricing Reference (Feb 2026)

| Model | Input | Output |
|-------|-------|--------|
| `gemini-3-pro-preview` | $2/1M (<200k), $4/1M (>200k) | $12/1M (<200k), $18/1M (>200k) |
| `gemini-3-flash-preview` | $0.50/1M | $3/1M |
| `gemini-3-pro-image-preview` | $2/1M text | $0.134/image (1K-2K), $0.24/image (4K) |
| Google Search Grounding | $14/1k queries | — |
