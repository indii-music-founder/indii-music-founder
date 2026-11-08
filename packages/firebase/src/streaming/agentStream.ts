/**
 * Agent Streaming Service — Backend AI Gateway
 *
 * Cloud Function v2 - Server-Sent Events (SSE) support for agent response streaming.
 * This is the PRIMARY UNLOCKER for Phase 2 agent orchestration features.
 *
 * Architecture:
 * - Client: POST /api/agents/stream with { userId, agentId, input, context, costReservationId? }
 * - Auth: Firebase ID token + App Check (verified in HTTP headers)
 * - Backend: Uses Vertex AI via ADC (no API key in request)
 * - Response: SSE stream of tokens { token, index, timestamp } until completion
 *
 * Credentials Flow:
 * 1. Client sends Firebase ID token in Authorization header
 * 2. Function verifies token (admin SDK)
 * 3. Function checks email_verified === true
 * 4. Function enforces generation rate limits & claims cost reservation if present
 * 5. Function calls getVertexAIClient() to initialize Vertex AI
 * 6. Service account credentials are applied automatically (ADC)
 * 7. Response tokens streamed to client as they arrive
 * 8. On complete, reservation settled and usage recorded
 *
 * Error Handling:
 * - Pre-stream errors map HttpsError code to HTTP status (400, 401, 403, 429, 500)
 * - Mid-stream errors emit SSE error frame without crashing via headersSent check
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
import { arcjetKey } from "../config/secrets";
import { protectAuthenticatedApiRequest, protectAnonymousSignupRequest } from "../functions/security/arcjet";
import { enforceRateLimit, RATE_LIMITS } from "../lib/rateLimit";
import { claimOperationReservation, finalizeOperationReservation } from "../functions/billing/enforceOperationCost";
import { recordUsage } from "../functions/creative/gateway";

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
  costReservationId: z.string().optional(),
});

export type AgentStreamRequest = z.infer<typeof AgentStreamRequestSchema>;

function mapHttpsErrorCodeToHttpStatus(code: string): number {
  switch (code) {
    case "invalid-argument":
      return 400;
    case "unauthenticated":
      return 401;
    case "permission-denied":
      return 403;
    case "not-found":
      return 404;
    case "resource-exhausted":
      return 429;
    case "failed-precondition":
      return 412;
    default:
      return 500;
  }
}

/**
 * Stream Agent Response
 *
 * POST /api/agents/stream
 *
 * Streams agent response tokens in real-time using Server-Sent Events.
 * Enables UI to render tokens as they arrive (no waiting for full response).
 */
export const agentStreamResponse = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 600,
    memory: "1GiB",
    secrets: [arcjetKey],
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

    let activeReservationId: string | undefined;
    let reservationUserId: string | undefined;
    let reservationClaimed = false;

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

      const { userId, agentId, input, costReservationId } = validation.data;
      activeReservationId = costReservationId;
      reservationUserId = userId;

      // Verify user authentication (from Firebase ID token in Authorization header)
      const authToken = req.headers.authorization?.split("Bearer ")[1];
      if (!authToken) {
        throw new HttpsError("unauthenticated", "Missing authorization header");
      }

      let decodedToken: admin.auth.DecodedIdToken;
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

      // Verify email verification status
      if (decodedToken.email_verified !== true) {
        throw new HttpsError(
          "permission-denied",
          "Forbidden: Verify your email before using AI generation."
        );
      }

      // Verify App Check manually after CORS preflight has passed
      if (!(await validateAppCheckHttp(req, res))) {
        return;
      }

      const protection = await protectAuthenticatedApiRequest(req as never, {
        userId,
        policy: 'verified-free',
        operationId: `agent-stream:${userId}`,
      });
      if (!protection.allowed) {
        if (protection.retryAfterSeconds && typeof res.setHeader === 'function') {
          res.setHeader('Retry-After', String(protection.retryAfterSeconds));
        }
        res.status(protection.status).json({ error: protection.message });
        return;
      }

      // Rate limit check
      await enforceRateLimit(userId, "agentStreamResponse", RATE_LIMITS.generation);

      // Claim cost reservation if provided
      if (activeReservationId) {
        await claimOperationReservation({
          userId,
          operationId: activeReservationId,
          operationType: "agent_stream",
          claimId: `stream-${userId}-${Date.now()}`,
        });
        reservationClaimed = true;
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
          ],
          config: {
            temperature: 1.0,
          },
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

        // Finalize cost reservation
        if (activeReservationId && reservationClaimed) {
          try {
            await finalizeOperationReservation({
              userId,
              operationId: activeReservationId,
              outcome: "SETTLED",
              expectedType: "agent_stream",
            });
            reservationClaimed = false;
          } catch (resErr) {
            console.error("[AgentStream] Failed to settle reservation:", resErr);
          }
        }

        // Record usage
        try {
          await recordUsage(userId, "chat_tokens", tokenIndex);
        } catch (usageErr) {
          console.error("[AgentStream] Failed to record usage:", usageErr);
        }
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

      if (activeReservationId && reservationClaimed && reservationUserId) {
        try {
          await finalizeOperationReservation({
            userId: reservationUserId,
            operationId: activeReservationId,
            outcome: "VOIDED",
            expectedType: "agent_stream",
          });
          reservationClaimed = false;
        } catch (resErr) {
          console.error("[AgentStream] Failed to void reservation on error:", resErr);
        }
      }

      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      const errorCode = error instanceof HttpsError ? error.code : "internal";

      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: errorMessage, code: errorCode })}\n\n`);
        res.end();
        return;
      }

      const status = mapHttpsErrorCodeToHttpStatus(errorCode);
      res.status(status).json({
        error: errorMessage,
        code: errorCode,
      });
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
    region: "us-central1",
    secrets: [arcjetKey],
  },
  async (req: Request, res: Response) => {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const protection = await protectAnonymousSignupRequest(
      req as never,
      'agent-stream-health',
      'allow-low-risk-read'
    );
    if (!protection.allowed) {
      if (protection.retryAfterSeconds && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', String(protection.retryAfterSeconds));
      }
      res.status(protection.status).json({ error: protection.message });
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
