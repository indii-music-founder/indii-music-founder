---
name: Google API Expert & Gemini 3 Architect
description: Comprehensive guide and instructions for integrating Google Cloud, Vertex AI, and Gemini 3 models into the indiiOS ecosystem.
---

# Google API Expert & Gemini 3 Architect Skill

This skill provides deep knowledge and operational strictures for working with Google APIs, specifically focusing on the Gemini 3 era of Generative AI, Vertex AI integration, and Firebase services within the indiiOS architecture.

## 1. Core Principles & Mandates

### 1.1 The "Unified SDK" Mandate

We strictly use the **Unified Google Gen AI SDK** for all new implementations.

- **Node.js**: `@google/genai` (Do not use `@google/generative-ai` for new features).
- **Python**: `google-genai`

### 1.2 The "No Hardcoding" Rule (Zero Tolerance)

- NEVER hardcode API keys or Project IDs.
- **Client-Side**: Use `import.meta.env.VITE_FIREBASE_*` (safely exposed).
- **Server-Side (Functions)**: Use `process.env.*` or Firebase Config.
- **Service Account Keys**: Must be loaded from secure environment paths, never committed.

### 1.3 Model Version Discipline

We operate exclusively on **Gemini 3 Preview** models. Legacy models (1.5, 2.0) are BANNED and will cause runtime crashes.

---

## 2. Model Configuration & capabilities

**Source of Truth**: `src/core/config/ai-models.ts`

| Capability | Model ID | Config Constant | Recommended Thinking |
| :--- | :--- | :--- | :--- |
| **Complex Agent** | `gemini-3-pro-preview` | `AI_MODELS.TEXT.AGENT` | `HIGH` |
| **Fast / Routing** | `gemini-3-flash-preview` | `AI_MODELS.TEXT.FAST` | `MEDIUM` |
| **Image Gen** | `gemini-3-pro-image-preview` | `AI_MODELS.IMAGE.GENERATION` | N/A |
| **Video Gen** | `veo-3.1-generate-preview` | `AI_MODELS.VIDEO.GENERATION` | N/A |
| **TTS Pro** | `gemini-2.5-pro-tts` | `AI_MODELS.AUDIO.PRO` | N/A |

### 2.1 Thinking Configuration (Cortex V5)

Gemini 3 models support "Thinking" (Reasoning) levels. This must be configured in the request options.

```typescript
// Example: Configuring High Reasoning
const config = {
  model: 'gemini-3-pro-preview',
  config: {
    thinkingConfig: { includeThoughts: true, thinkingLevel: "HIGH" }
  }
};
// Note: Thinking output comes in the `candidates[0].content.parts` as a 'thought' part.
```

---

## 3. Implementation Patterns (Node.js)

### 3.1 Basic Generation (Text) with `@google/genai`

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { AI_MODELS } from '@/core/config/ai-models';

// Note: In indiiOS, we often use generic wrappers like FirebaseAIService.
// But for direct SDK usage:

import { Client } from '@google/genai';

const client = new Client({ apiKey: process.env.GOOGLE_GENAI_API_KEY });

async function generateContent() {
  const response = await client.models.generateContent({
    model: AI_MODELS.TEXT.AGENT,
    config: {
        thinkingConfig: { includeThoughts: true, thinkingLevel: "HIGH" }
    },
    contents: [{ role: 'user', parts: [{ text: 'Architect a solution for...' }] }]
  });

  return response.text();
}
```

### 3.2 Structured Output (JSON)

Crucial for agent reliability. Enforce schemas.

```typescript
const response = await client.models.generateContent({
    model: AI_MODELS.TEXT.FAST,
    config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: 'object',
            properties: {
                steps: { type: 'array', items: { type: 'string' } },
                reasoning: { type: 'string' }
            }
        }
    },
    contents: [...]
});
```

---

## 4. Multimodal Inputs

### 4.1 Images & PDFs

PDFs are treated as images in Gemini 3.

- **Small Files**: Base64 encoded inline data.
- **Large/Many Files (>10)**: Upload to Google Cloud Storage (GCS) and pass `gs://` URI.

```typescript
// Image Part
const imagePart = {
    inlineData: {
        mimeType: 'image/jpeg',
        data: base64String
    }
};

// GCS URI Part
const filePart = {
    fileData: {
        mimeType: 'application/pdf',
        fileUri: 'gs://my-bucket/doc.pdf'
    }
};
```

### 4.2 Video Generation (Veo)

Video generation is an async long-running operation.

1. **Trigger**: Call generation endpoint.
2. **Poll**: Wait for operation completion (can take 60-600s).
3. **Timeout**: Use `calculateVideoTimeout(durationString)` from config.

---

## 5. Firebase Integration (Authentication & Rules)

### 5.1 Auth & Headers

When making requests from the client (Electron/React) to Cloud Functions, you must include the Auth token to identify the user.

```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const token = await auth.currentUser?.getIdToken();

// Headers
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};
```

### 5.2 Storage Rules

When experimenting with new file types (e.g., `.wav` for audio persistence), ensure `storage.rules` allows the write.

```text
// storage.rules
match /users/{userId}/audio/{fileName} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

---

## 6. Troubleshooting & Common Errors

| Error | Cause | Fix |
| :--- | :--- | :--- |
| `403 Forbidden` | API Key missing or scopes invalid. | Check `.env` or `gcloud auth application-default login`. |
| `429 Resource Exhausted` | Quota limit hit. | Implement exponential backoff. Switch to `flash` model if possible. |
| `400 Invalid Argument` | Unsupported model or parameter combination. | Verify model ID in `ai-models.ts`. Check if `thinking_level` is supported for that model. |
| `500 Internal Error` | Service disruption or "Forbidden Model". | Check if you logic accidentally used `gemini-pro` (banned). |

## 7. Resources & Documentation

- **Unified SDK Repo**: [googleapis/google-genai-sdk](https://github.com/googleapis/google-genai-sdk)
- **Gemini API Docs**: [ai.google.dev](https://ai.google.dev)
- **Firebase Docs**: [firebase.google.com/docs](https://firebase.google.com/docs)
