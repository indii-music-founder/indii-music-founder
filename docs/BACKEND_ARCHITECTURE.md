# Backend Architecture & Vertex AI Strategy

**Last Updated:** 2025-12-01
**Status:** Production Ready

## 1. Current Architecture

The system currently uses a hybrid approach:

* **Frontend (Client-Side)**:
  * **Text/Chat**: Uses `GoogleGenerativeAI` SDK (Gemini API) directly from the browser.
  * **Image Generation**: Uses `GoogleGenerativeAI` SDK (Gemini API) directly from the browser.
* **Backend (Firebase Functions)**:
  * **Video Generation**: Uses `Vertex AI API` via Google Cloud REST endpoint.
  * **Creative Director Agent**: Uses `@mastra/core` wrapping `Vertex AI` (via AI SDK).

## 2. Strategic Decision: Image Generation Migration

**Decision:** **MIGRATE IMAGE GENERATION TO BACKEND (VERTEX AI).**

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

### Implementation Plan

1. **Create Cloud Function:** `generateImage` in `functions/src/index.ts`.
2. **Logic:**
    * Auth Check (Firebase Auth).
    * Quota Check (Firestore).
    * Call Vertex AI (`gemini-3-pro-image-preview`).
    * Log Result.
3. **Client Update:** Update `ImageService.ts` to call this function.

## 3. Backend Service Map

| Service | Function Name | Trigger | Model | Scaling Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Video** | `generateVideo` | HTTPS | `veo-3.1-generate-preview` | Async Queue (Long running) |
| **Image** | `generateImage` | HTTPS | `gemini-3-pro-image-preview` | **Migrate to Backend** |
| **Agent** | `creativeDirectorAgent` | HTTPS | `gemini-3-pro-preview` | Stateless / Auto-scaling |

## 4. Code Standards

* **Runtime**: Node.js 22
* **Framework**: Firebase Functions (Gen 2 preferred for concurrency).
* **Auth**: `google-auth-library` for backend-to-backend; Firebase Auth for client-to-backend.
