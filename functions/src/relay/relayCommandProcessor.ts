/**
 * processRelayCommand — Server-Side Agent Relay
 *
 * Replaces the desktop-browser-dependent relay with a Cloud Function that
 * triggers on Firestore document creation. When the phone writes a command
 * to `users/{userId}/remote-relay-commands/{commandId}`, this function:
 *
 *   1. Marks the command as "processing"
 *   2. Sends a streaming indicator back to the phone
 *   3. Calls Gemini with the appropriate agent system prompt
 *   4. Writes the final response to `remote-relay-responses`
 *   5. Marks the command as "completed"
 *
 * The desktop browser is NO LONGER required for the relay to function.
 * The phone gets responses even if the desktop is closed.
 *
 * Architecture: Firestore onCreate trigger (V1 API, Gen 2 runtime)
 * Timeout: 540s (same as executeVideoJob)
 * Memory: 2GB
 * Region: us-central1 (default — Firestore triggers don't support multi-region)
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { getAgentPrompt, VALID_AGENT_IDS } from "./agentPrompts";
import { getGeminiApiKey } from "../config/secrets";
import { geminiApiKey } from "../config/secrets";
import { enforceRateLimit, RATE_LIMITS } from "../lib/rateLimit";
import { FUNCTION_AI_MODELS } from "../config/models";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_COMMAND_LENGTH = 10_000;
const PROCESSING_INDICATOR = "⏳ Processing your request...";

// ---------------------------------------------------------------------------
// Cloud Function: Firestore onCreate Trigger
// ---------------------------------------------------------------------------
export const processRelayCommand = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', 
        secrets: [geminiApiKey],
        timeoutSeconds: 540,
        memory: "2GB",
     })
    .firestore.document("users/{userId}/remote-relay-commands/{commandId}")
    .onCreate(async (snapshot, context) => {
        const { userId, commandId } = context.params;
        const data = snapshot.data();

        // ---------------------------------------------------------------
        // 1. Validate — only process "pending" commands
        // ---------------------------------------------------------------
        if (data.status !== "pending") {
            console.log(`[Relay] Skipping command ${commandId} — status is "${data.status}", not "pending".`);
            return;
        }

        const text = data.text;
        const targetAgentId: string | undefined = data.targetAgentId;

        if (!text || typeof text !== "string" || text.trim().length === 0) {
            console.error(`[Relay] Invalid command ${commandId} — empty text.`);
            await markFailed(userId, commandId, "Empty command text.");
            return;
        }

        if (text.length > MAX_COMMAND_LENGTH) {
            console.error(`[Relay] Command ${commandId} exceeds max length (${text.length} > ${MAX_COMMAND_LENGTH}).`);
            await markFailed(userId, commandId, `Command too long (${text.length} chars, max ${MAX_COMMAND_LENGTH}).`);
            return;
        }

        // Validate targetAgentId if provided
        if (targetAgentId && !VALID_AGENT_IDS.includes(targetAgentId)) {
            console.warn(`[Relay] Unknown agent "${targetAgentId}" for command ${commandId} — falling back to Conductor.`);
            // Don't fail — just route to Conductor
        }

        console.log(`[Relay] Processing command ${commandId} for user ${userId} → agent: ${targetAgentId || "auto (conductor)"}`);

        // ---------------------------------------------------------------
        // 2. Mark as processing + send streaming indicator
        // ---------------------------------------------------------------
        try {
            await admin.firestore()
                .collection("users").doc(userId)
                .collection("remote-relay-commands").doc(commandId)
                .update({ status: "processing" });

            await sendResponse(userId, commandId, PROCESSING_INDICATOR, undefined, true);
        } catch (err) {
            console.error(`[Relay] Failed to update status for ${commandId}:`, err);
            // Continue anyway — the response is more important than the status
        }

        // ---------------------------------------------------------------
        // 3. Rate Limiting
        // ---------------------------------------------------------------
        try {
            await enforceRateLimit(userId, "processRelayCommand", RATE_LIMITS.generation);
        } catch (rateLimitErr: unknown) {
            const msg = rateLimitErr instanceof Error ? rateLimitErr.message : "Rate limit exceeded";
            console.warn(`[Relay] Rate limited user ${userId}: ${msg}`);
            await markFailed(userId, commandId, `⚠️ ${msg}`);
            return;
        }

        // ---------------------------------------------------------------
        // 4. Call Gemini with the appropriate agent prompt
        // ---------------------------------------------------------------
        try {
            const { resolvedAgentId, prompt } = getAgentPrompt(targetAgentId);
            console.log(`[Relay] Using agent: ${resolvedAgentId} for command ${commandId}`);

            // Lazy import to reduce cold start
            const { GoogleGenAI } = await import("@google/genai");
            const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });

            const modelId = FUNCTION_AI_MODELS.TEXT.PRO;

            const result = await client.models.generateContent({
                model: modelId,
                contents: [{ role: "user", parts: [{ text: text.trim() }] }],
                config: {
                    systemInstruction: prompt,
                    temperature: 1.0,
                    maxOutputTokens: 4096,
                    thinkingConfig: { thinkingBudget: 2048 },
                },
            });

            // Extract text from response
            const responseText = result.text
                || result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join("\n")
                || "I processed your request but couldn't generate a response. Please try again.";

            // ---------------------------------------------------------------
            // 5. Send final response to phone
            // ---------------------------------------------------------------
            await sendResponse(userId, commandId, responseText, resolvedAgentId, false);
            await markCompleted(userId, commandId);

            console.log(`[Relay] ✅ Command ${commandId} completed (${responseText.length} chars, agent: ${resolvedAgentId})`);

        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[Relay] ❌ Gemini call failed for ${commandId}:`, errorMsg);
            await markFailed(userId, commandId, `❌ Agent error: ${errorMsg.substring(0, 200)}`);
        }
    });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a response document to Firestore.
 */
async function sendResponse(
    userId: string,
    commandId: string,
    text: string,
    agentId?: string,
    isStreaming = false
): Promise<void> {
    await admin.firestore()
        .collection("users").doc(userId)
        .collection("remote-relay-responses")
        .add({
            commandId,
            text,
            agentId: agentId || "generalist",
            isStreaming,
            isFinal: !isStreaming,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
}

/**
 * Mark a command as failed — sends error to phone, marks completed.
 */
async function markFailed(userId: string, commandId: string, errorMessage: string): Promise<void> {
    await sendResponse(userId, commandId, errorMessage, undefined, false);
    await markCompleted(userId, commandId);
}

/**
 * Mark a command as completed.
 */
async function markCompleted(userId: string, commandId: string): Promise<void> {
    try {
        await admin.firestore()
            .collection("users").doc(userId)
            .collection("remote-relay-commands").doc(commandId)
            .update({
                status: "completed",
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
    } catch (err) {
        console.error(`[Relay] Failed to mark ${commandId} as completed:`, err);
    }
}
