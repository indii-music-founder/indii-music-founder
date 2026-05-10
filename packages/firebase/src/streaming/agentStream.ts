/**
 * Agent Streaming Service
 *
 * Cloud Function v2 - Server-Sent Events (SSE) support for agent response streaming.
 * This is the PRIMARY UNLOCKER for Phase 2 agent orchestration features.
 *
 * NOTE: This function uses v2 API and coexists with v1 functions during migration.
 */

import { onRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

interface StreamToken {
  token: string;
  index: number;
  timestamp: number;
}

interface AgentStreamRequest {
  userId: string;
  agentId: string;
  input: string;
  context?: Record<string, unknown>;
}

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
    timeoutSeconds: 600, // 10 minutes for long-running agent tasks
    memory: "1GiB",
    secrets: ["GEMINI_API_KEY"]
  },
  async (req: Request, res: Response): Promise<void> => {
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

      const {
        userId,
        agentId,
        input
      } = body as Partial<AgentStreamRequest>;

      // Validate required fields
      if (!userId || !agentId || !input) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required fields: userId, agentId, input"
        );
      }

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

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering

      // Log stream start
      console.info(
        `[AgentStream] Starting stream for user=${userId}, agent=${agentId}`
      );

      // Initialize Gemini API client
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new HttpsError(
          "internal",
          "GEMINI_API_KEY not configured"
        );
      }

      const genai = new GoogleGenAI({ apiKey });
      let tokenIndex = 0;

      try {
        // Stream agent response from Gemini API
        const stream = await genai.models.generateContentStream({
          model: "gemini-2.5-flash",
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
