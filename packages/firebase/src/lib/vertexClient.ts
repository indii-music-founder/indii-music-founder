/**
 * Shared Vertex AI Client (ADC Gateway)
 *
 * Singleton pattern for Vertex AI access via the @google/genai SDK with ADC auth.
 * No API keys required — uses Cloud Functions service account credentials automatically.
 *
 * This is the unified entry point for all backend AI operations:
 * - Text generation (chat, streaming)
 * - Image generation (Imagen, editing)
 * - Audio synthesis (TTS)
 * - Video generation (Veo)
 * - Audio analysis (YAMNet)
 *
 * Architecture:
 * - Client sends request to Cloud Function (Firebase Auth + App Check)
 * - Function uses getVertexAIClient() to initialize
 * - SDK uses Application Default Credentials (service account)
 * - Credentials are never exposed to frontend
 *
 * Pattern: new GoogleGenAI({ vertexai: true, project, location })
 *
 * Eliminates:
 * - API key expiration risk
 * - Unintended key leaks via network traffic
 * - Client-side credential management complexity
 */

import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;

/**
 * Get or create the Vertex AI client.
 * Lazy initialization — created on first use, reused thereafter.
 * ADC (Application Default Credentials) auth is automatic in Cloud Functions.
 */
export function getVertexAIClient(): GoogleGenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'indii-v-1-1';
  const location = process.env.VITE_VERTEX_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

  cachedClient = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: location,
  });

  console.info(`[VertexClient] Initialized Vertex AI SDK for project=${projectId}, location=${location}`);
  return cachedClient;
}

/**
 * Reset the client (for testing or if credentials change).
 */
export function resetVertexAIClient(): void {
  cachedClient = null;
}
