# Vertex AI Endpoint Reference

> **Shared knowledge for all indii agents.** Use these endpoints when implementing or debugging AI features that route through Vertex AI / Google Cloud.

## Variables
Replace these in every endpoint:
- `{region}` → e.g., `us-central1` or `global` (use the model-specific location documented below; image and Omni use `global`, while Veo uses `us-central1`)
- `{project-id}` → `indii-music-founder`
- `{model}` → e.g., `gemini-3-pro-preview`, `gemini-3-flash-preview` (see `@/core/config/ai-models`)

---

## ⚡ Core Generative & Prediction Endpoints

### Standard Text & Multimodal Generation
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/publishers/google/models/{model}:generateContent
```
Use for: single prompts to Gemini models (text, images, documents).

### Streaming Generation (SSE / real-time chunks)
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/publishers/google/models/{model}:streamGenerateContent
```
Use for: chatbots, streaming UI responses. Returns Server-Sent Events.

### Batch Prediction Jobs
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/batchPredictionJobs
```
Use for: overnight audio analysis, bulk royalty processing, large async workloads.

---

## 🔍 Grounding & RAG Endpoints

### Prompt Augmentation
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}:augmentPrompt
```
Use for: injecting context from Vertex RAG data stores before sending to LLM.

### Context Retrieval
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}:retrieveContexts
```
Use for: querying vector databases / document stores for relevant content.

### Factuality Verification (Corroboration)
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}:corroborateContent
```
Use for: checking generated text against sources; returns factuality confidence score.

---

## 🎨 Creative Media Generation Endpoints

### Video Generation (Veo)
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/publishers/google/models/{veo-model}:predictLongRunning
```
Model: `veo-3.1-generate-001` (Location: `us-central1`)
Use for: Cinema Worldbuilder, indii Director, music video generation.

### Image Generation (Nano Banana)
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/publishers/google/models/{image-model}:generateContent
```
Models: `gemini-3-pro-image`, `gemini-3.1-flash-image` (Location: `global`)
Use for: album art, promotional assets, creative studio.

---

## 🛠️ Vertex Agent Builder / Reasoning Engine Endpoints

### Reasoning Engine REST
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/reasoningEngines/{engine-id}:query
```
Use for: querying deployed A2A swarm agents on Vertex Agent Builder.

### Reasoning Engine Real-Time Streaming (WebSocket)
```
wss://{region}-aiplatform.googleapis.com/ws/v1/projects/{project-id}/locations/{region}/reasoningEngines/{engine-id}
```
Use for: real-time streaming from deployed Vertex agents to the UI (preferred over polling).

---

## indii-Specific Notes

| Endpoint | indii usage | Default Location |
|---|---|---|
| `generateContent` (Text) | AI agents, chat | `global` |
| `generateContent` (Image) | Creative studio image gen | `global` |
| `predictLongRunning` (Veo Video) | Video generation | `us-central1` |
| `generateContent` (Omni) | Conversational media editing | `global` |
| `batchPredictionJobs` | Overnight audio analysis | `global` |

> ⚠️ **Routing Policy:** Gemini text and image models route through `global`. Veo 3.1 video models route through `us-central1`. Always respect each model's official lifecycle and model card requirements.
