/**
 * Agent Streaming Service — Backend AI Gateway
 *
 * Cloud Function v2 - Server-Sent Events (SSE) support for agent response streaming.
 * This is the PRIMARY UNLOCKER for Phase 2 agent orchestration features.
 *
 * Architecture:
 * - Client: POST /api/agents/stream with { userId, agentId, input, context }
 * - Auth: Firebase ID token + App Check (verified in HTTP headers)
 * - Backend: Uses Vertex AI via ADC (no API key in request)
 * - Response: SSE stream of tokens { token, index, timestamp } until completion
 *
 * Credentials Flow:
 * 1. Client sends Firebase ID token in Authorization header
 * 2. Function verifies token (admin SDK)
 * 3. Function calls getVertexAIClient() to initialize Vertex AI
 * 4. Service account credentials are applied automatically (ADC)
 * 5. Response tokens streamed to client as they arrive
 *
 * This design ensures:
 * - No API keys in frontend code or network traffic
 * - Streaming latency is minimized (direct backend-to-client SSE)
 * - Cost tracking can happen server-side before/after request
 *
 * NOTE: This function uses v2 API and coexists with v1 functions during migration.
 */

import { onRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import { z } from "zod";
import { FUNCTION_INTELLIGENCE_MODELS } from "../config/models";
import { getVertexAIClient } from "../lib/vertexClient";
import { validateAppCheckHttp } from "../middleware/appCheck";

interface StreamToken {
  token: string;
  index: number;
  timestamp: number;
}

export const AgentStreamRequestSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  agentId: z.string().min(1, "agentId is required"),
  input: z.string().min(1, "input is required"),
  context: z.record(z.unknown()).optional(),
});

export type AgentStreamRequest = z.infer<typeof AgentStreamRequestSchema>;

/**
 * Stream Agent Response
 *
 * POST /api/agents/stream
 *
 * Streams agent response tokens in real-time using Server-Sent Events.
 * Enables UI to render tokens as they arrive (no waiting for full response).
 *
 * Request:
 * {
 *   userId: string
 *   agentId: string
 *   input: string
 *   context?: Record<string, unknown>
 * }
 *
 * Response (SSE stream):
 * data: {"token":"Hello","index":0,"timestamp":1234567890}
 * data: {"token":" ","index":1,"timestamp":1234567891}
 * data: {"token":"world","index":2,"timestamp":1234567892}
 */
export const agentStreamResponse = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 600,
    memory: "1GiB"
  },
  async (req: Request, res: Response): Promise<void> => {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // Validate request method
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      // Parse request
      const body = req.body as unknown;
      if (!body || typeof body !== "object") {
        throw new HttpsError("invalid-argument", "Request body required");
      }

      // Zod Validation
      const validation = AgentStreamRequestSchema.safeParse(body);
      if (!validation.success) {
        throw new HttpsError(
          "invalid-argument",
          `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`
        );
      }

      const { userId, agentId, input } = validation.data;

      // Verify user authentication (from Firebase ID token in Authorization header)
      const authToken = req.headers.authorization?.split("Bearer ")[1];
      if (!authToken) {
        throw new HttpsError("unauthenticated", "Missing authorization header");
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(authToken);
      } catch (_error) {
        throw new HttpsError("unauthenticated", "Invalid ID token");
      }

      // Verify user ID matches token
      if (decodedToken.uid !== userId) {
        throw new HttpsError(
          "permission-denied",
          "User ID does not match authorization token"
        );
      }

      // Verify App Check manually after CORS preflight has passed
      if (!(await validateAppCheckHttp(req, res))) {
        return;
      }

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering

      // Log stream start
      console.info(
        `[AgentStream] Starting stream for user=${userId}, agent=${agentId}`
      );

      // Initialize Vertex AI client (ADC auth, no API key)
      const genai = getVertexAIClient();
      let tokenIndex = 0;

      try {
        // Stream agent response from Gemini API
        const stream = await genai.models.generateContentStream({
          model: FUNCTION_INTELLIGENCE_MODELS.TEXT.FAST,
          contents: [
            {
              role: "user",
              parts: [{ text: input }]
            }
          ]
        });

        // Stream tokens to client
        for await (const chunk of stream) {
          if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if ("text" in part && part.text) {
                const streamToken: StreamToken = {
                  token: part.text,
                  index: tokenIndex++,
                  timestamp: Date.now()
                };

                res.write(`data: ${JSON.stringify(streamToken)}\n\n`);
              }
            }
          }
        }

        // Send completion signal
        res.write(`data: ${JSON.stringify({ complete: true, totalTokens: tokenIndex })}\n\n`);
        res.end();
      } catch (error) {
        console.error("[AgentStream] API error:", error);
        throw new HttpsError(
          "internal",
          error instanceof Error ? error.message : "Failed to stream agent response"
        );
      }

      console.info(
        `[AgentStream] Completed stream for user=${userId}, tokenCount=${tokenIndex}`
      );
    } catch (error) {
      console.error("[AgentStream] Error:", error);

      if (error instanceof HttpsError) {
        res.status(error.code === "invalid-argument" ? 400 : 401).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: error instanceof Error ? error.message : "Internal server error"
        });
      }
    }
  }
);

/**
 * Health Check for Agent Streaming
 *
 * GET /api/agents/stream/health
 *
 * Verifies streaming endpoint is operational.
 */
export const agentStreamHealth = onRequest(
  {
    region: "us-central1"
  },
  (req: Request, res: Response) => {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    res.json({
      status: "healthy",
      service: "agentStreamResponse",
      timestamp: new Date().toISOString(),
      capabilities: ["sse", "streaming", "token-by-token-rendering"]
    });
  }
);
