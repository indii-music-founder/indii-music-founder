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
import { FUNCTION_INTELLIGENCE_MODELS } from "../config/models";
import { checkOperationBudget } from "../functions/billing/enforceOperationCost";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_COMMAND_LENGTH = 10_000;
const PROCESSING_INDICATOR = "⏳ Processing your request...";

/**
 * Conservative fixed cost estimate (USD) charged against the user's budget for
 * each relay command. Relay commands are text-only Gemini calls; 0.02 USD is a
 * deliberate over-estimate so the kill-switch trips before real spend does.
 */
const RELAY_COMMAND_COST_ESTIMATE_USD = 0.02;

/**
 * Markers that indicate a command is handled exclusively by the desktop client
 * (e.g. image generation). The cloud relay is text-only, so any command
 * starting with one of these markers must be left untouched for the desktop.
 */
const DESKTOP_ONLY_MARKERS = ["[GENERATE_IMAGE]"] as const;

// User-facing messages — these MUST NOT leak internal endpoint names or other
// implementation identifiers (see Change 4).
const RATE_LIMIT_USER_MESSAGE =
    "⚠️ You're sending messages a little fast — give it a few seconds and try again.";
const BUDGET_LIMIT_USER_MESSAGE =
    "⚠️ You've reached your usage limit for now. Please try again later.";

// ---------------------------------------------------------------------------
// Cloud Function: Firestore onCreate Trigger
// ---------------------------------------------------------------------------
export const processRelayCommand = functions
    .runWith({ enforceAppCheck: true, 
        secrets: [geminiApiKey],
        timeoutSeconds: 540,
        memory: "2GB",
     })
    .firestore.document("users/{userId}/remote-relay-commands/{commandId}")
    .onCreate(async (snapshot, context) => {
        const { userId, commandId } = context.params;
        const data = snapshot.data();

        const text = data.text;
        const targetAgentId: string | undefined = data.targetAgentId;

        // ---------------------------------------------------------------
        // 1. Validate command text
        // ---------------------------------------------------------------
        if (!text || typeof text !== "string" || text.trim().length === 0) {
            console.error(`[Relay] Invalid command ${commandId} — empty text.`);
            await markFailed(userId, commandId, "Empty command text.");
            return;
        }

        const trimmedText = text.trim();

        // ---------------------------------------------------------------
        // 1a. Capability partition — skip desktop-only commands
        //
        // Image generation (and any other desktop-only marker) is handled
        // by the desktop client, not this text-only cloud relay. If a command
        // is desktop-only, RETURN IMMEDIATELY without claiming or processing
        // it — leaving the doc "pending" so the desktop can pick it up. This
        // prevents the cloud function from breaking image requests.
        // ---------------------------------------------------------------
        if (DESKTOP_ONLY_MARKERS.some((marker) => trimmedText.startsWith(marker))) {
            console.log(`[Relay] Skipping command ${commandId} — desktop-only marker detected; leaving for desktop client.`);
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

        // ---------------------------------------------------------------
        // 2. Atomic claim (idempotency / exactly-once)
        //
        // onCreate can be delivered more than once. Use a transaction to flip
        // pending → processing only if the doc is still "pending". If another
        // delivery already claimed it (processing/completed), abort without
        // processing. This guarantees exactly-once execution and only sends
        // the streaming indicator AFTER a successful claim.
        // ---------------------------------------------------------------
        const commandRef = admin.firestore()
            .collection("users").doc(userId)
            .collection("remote-relay-commands").doc(commandId);

        let claimed = false;
        try {
            claimed = await admin.firestore().runTransaction(async (tx) => {
                const fresh = await tx.get(commandRef);
                const status = fresh.exists ? fresh.data()?.status : undefined;
                if (status !== "pending") {
                    return false;
                }
                tx.update(commandRef, { status: "processing" });
                return true;
            });
        } catch (err) {
            console.error(`[Relay] Failed to claim command ${commandId}:`, err);
            return;
        }

        if (!claimed) {
            console.log(`[Relay] Skipping command ${commandId} — already claimed (duplicate delivery or non-pending status).`);
            return;
        }

        console.log(`[Relay] Processing command ${commandId} for user ${userId} → agent: ${targetAgentId || "auto (conductor)"}`);

        // Send the streaming indicator now that we own the command.
        try {
            await sendResponse(userId, commandId, PROCESSING_INDICATOR, undefined, true);
        } catch (err) {
            console.error(`[Relay] Failed to send streaming indicator for ${commandId}:`, err);
            // Continue anyway — the response is more important than the indicator.
        }

        // ---------------------------------------------------------------
        // 3. Cost kill-switch — verify budget BEFORE any Gemini call
        //
        // Reuse the shared budget logic (daily/monthly ledgers, user tier,
        // and the $500/month runaway kill-switch). Fail-secure: a blocked or
        // failed check prevents the (paid) Gemini call entirely.
        // ---------------------------------------------------------------
        const budget = await checkOperationBudget({
            userId,
            estimatedCost: RELAY_COMMAND_COST_ESTIMATE_USD,
            operationType: "agent_stream",
            metadata: { commandId },
        });
        if (!budget.allowed) {
            console.warn(`[Relay] Budget check blocked command ${commandId} for user ${userId}: ${budget.reason ?? "no reason provided"}`);
            await markFailed(userId, commandId, BUDGET_LIMIT_USER_MESSAGE);
            return;
        }

        // ---------------------------------------------------------------
        // 4. Rate limiting — counted ONLY for real, billable calls.
        //
        // Runs after the atomic claim and budget check, immediately before the
        // Gemini call, so skipped/duplicate/budget-blocked commands never
        // increment the 10/min counter.
        // ---------------------------------------------------------------
        try {
            await enforceRateLimit(userId, "processRelayCommand", RATE_LIMITS.generation);
        } catch (rateLimitErr: unknown) {
            const detail = rateLimitErr instanceof Error ? rateLimitErr.message : "Rate limit exceeded";
            // Keep the detailed reason in server logs only — never surface it to the user.
            console.warn(`[Relay] Rate limited user ${userId} on command ${commandId}: ${detail}`);
            await markFailed(userId, commandId, RATE_LIMIT_USER_MESSAGE);
            return;
        }

        // ---------------------------------------------------------------
        // 5. Call Gemini with the appropriate agent prompt
        // ---------------------------------------------------------------
        try {
            const { resolvedAgentId, prompt } = getAgentPrompt(targetAgentId);
            console.log(`[Relay] Using agent: ${resolvedAgentId} for command ${commandId}`);

            // Lazy import to reduce cold start
            const { GoogleGenAI } = await import("@google/genai");
            const client = new GoogleGenAI({ apiKey: getGeminiApiKey() });

            const modelId = FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO;

            const result = await client.models.generateContent({
                model: modelId,
                contents: [{ role: "user", parts: [{ text: trimmedText }] }],
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
            // 6. Send final response to phone
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
