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

const clientsCache = new Map<string, GoogleGenAI>();

/**
 * Get or create the Vertex AI client.
 * Lazy initialization — cached by project and location, reused thereafter.
 * ADC (Application Default Credentials) auth is automatic in Cloud Functions.
 */
export function getVertexAIClient(projectOverride?: string, locationOverride?: string): GoogleGenAI {
  const projectId = projectOverride || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'indii-v-1-1';
  const location = locationOverride || process.env.VITE_VERTEX_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

  const cacheKey = `${projectId}:${location}`;
  if (clientsCache.has(cacheKey)) {
    return clientsCache.get(cacheKey)!;
  }

  const client = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: location,
  });

  clientsCache.set(cacheKey, client);
  console.info(`[VertexClient] Initialized Vertex AI SDK for project=${projectId}, location=${location}`);
  return client;
}

/**
 * Reset the client (for testing or if credentials change).
 */
export function resetVertexAIClient(): void {
  clientsCache.clear();
}
