# Vertex AI Endpoint Reference

> **Shared knowledge for all indii agents.** Use these endpoints when implementing or debugging AI features that route through Vertex AI / Google Cloud.

## Variables
Replace these in every endpoint:
- `{region}` → e.g., `us-central1` or `global` (use `global` for all preview models per AI model policy)
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
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/publishers/google/models/{veo-model}:generateVideos
```
Model: `veo-3.1-generate-preview`
Use for: Cinema Worldbuilder, indii Director, music video generation.

### Image Generation (Imagen)
```
POST https://{region}-aiplatform.googleapis.com/v1/projects/{project-id}/locations/{region}/publishers/google/models/{imagen-model}:predict
```
Model: `gemini-3-pro-image-preview`
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

| Endpoint | indii usage |
|---|---|
| `generateContent` / `streamGenerateContent` | AI agents, chat, creative tools |
| `batchPredictionJobs` | Overnight audio analysis, bulk royalty processing |
| `augmentPrompt` / `retrieveContexts` | RAG over artist catalog/contracts |
| `generateVideos` (Veo) | Cinema Worldbuilder, indii Director |
| `reasoningEngines` (REST + WSS) | A2A swarm agents deployed on Vertex |

> ⚠️ **Always use `global` endpoint for preview models.** Per the AI Model Policy, never route `gemini-3-*-preview` or `veo-3.1-generate-preview` through regional endpoints — use `global` as the region.
