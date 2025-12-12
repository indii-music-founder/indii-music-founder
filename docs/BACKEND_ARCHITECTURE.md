# Backend Architecture & Vertex AI Strategy

**Last Updated:** 2025-12-03
**Status:** Production Ready

## 1. Current Architecture

The system uses a hybrid approach, with a strategic shift towards backend processing for heavy AI tasks:

* **Frontend (Client-Side)**:
  * **Text/Chat**: Uses `GoogleGenerativeAI` SDK (Gemini API) directly from the browser for low-latency interactions.
  * **Lightweight Image Ops**: Some remix/style extraction tasks still run client-side (transitioning).
* **Backend (Firebase Functions)**:
  * **Video Generation**: Uses `Vertex AI API` via Google Cloud REST endpoint.
  * **Image Generation**: Migrated to `generateImage` Cloud Function using Vertex AI.
  * **Agent Execution**: Specialized agents (Creative Director, Road Manager, Brand Manager) run on server-side functions.

## 2. Strategic Decision: Image Generation Migration

**Decision:** **MIGRATE IMAGE GENERATION TO BACKEND (VERTEX AI).** (Completed)

### Rationale: The "1 Million User" Scale

When scaling from 1 user to 1,000 or 1,000,000 users, client-side generation fails for several critical reasons:

1. **Rate Limiting (The "Thundering Herd"):**
    * *Client-Side:* 1,000 users hitting the API simultaneously will trigger Google's global rate limiters (429 Too Many Requests). The app becomes unusable for everyone.
    * *Backend:* We can implement **Request Queueing** (e.g., Cloud Tasks). If 1,000 requests come in, we process them at our provisioned rate (e.g., 50 per second) without dropping them.

2. **Cost & Quota Management:**
    * *Client-Side:* Impossible to strictly enforce per-user cost limits securely.
    * *Backend:* We can check a user's subscription tier (Free vs. Pro) in Firestore *before* incurring the cost of the generation. We can stop abuse instantly.

3. **Security:**
    * *Client-Side:* Requires exposing API keys or proxy keys. High risk of leakage.
    * *Backend:* Uses IAM Service Accounts. Zero key exposure.

4. **Observability:**
    * *Backend:* We can log every generation request, success rate, and latency to BigQuery for analytics.

### Implementation Status

* **Cloud Function:** `generateImage` in `functions/src/index.ts` is live.
* **Logic:** Auth Check -> Vertex AI Call -> Response.
* **Client:** `ImageGenerationService.ts` uses `httpsCallable` for generation.

## 3. Backend Service Map

| Service | Function Name | Trigger | Model | Scaling Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Video** | `generateVideo` | HTTPS | `veo-3.1-generate-preview` | Async Queue (Long running) |
| **Audio** | `generateSpeech` | Callable | `gemini-2.5-pro-tts-preview` | Stateless |
| **Image** | `generateImage` | Callable | `gemini-3-pro-image-preview` | Stateless / Auto-scaling |
| **Director** | `creativeDirectorAgent` | HTTPS | `gemini-3-pro-preview` | Stateless |
| **Brand** | `analyzeBrand`, `generateBrandAsset` | Callable | `gemini-3-pro-preview` | Stateless |
| **Road** | `generateItinerary`, `checkLogistics` | Callable | `gemini-3-pro-preview` | Stateless |
| **Campaign** | `executeCampaign` | Callable | `gemini-3-pro-preview` | Stateless |

## 4. Code Standards

* **Runtime**: Node.js 22
* **Framework**: Firebase Functions (Gen 2 preferred for concurrency).
* **Auth**: `google-auth-library` for backend-to-backend; Firebase Auth for client-to-backend.
