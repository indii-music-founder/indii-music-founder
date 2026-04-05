"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processRelayCommand = void 0;
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
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const agentPrompts_1 = require("./agentPrompts");
const secrets_1 = require("../config/secrets");
const secrets_2 = require("../config/secrets");
const rateLimit_1 = require("../lib/rateLimit");
const models_1 = require("../config/models");
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_COMMAND_LENGTH = 10000;
const PROCESSING_INDICATOR = "⏳ Processing your request...";
// ---------------------------------------------------------------------------
// Cloud Function: Firestore onCreate Trigger
// ---------------------------------------------------------------------------
exports.processRelayCommand = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
    secrets: [secrets_2.geminiApiKey],
    timeoutSeconds: 540,
    memory: "2GB",
})
    .firestore.document("users/{userId}/remote-relay-commands/{commandId}")
    .onCreate(async (snapshot, context) => {
    var _a, _b, _c, _d;
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
    const targetAgentId = data.targetAgentId;
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
    if (targetAgentId && !agentPrompts_1.VALID_AGENT_IDS.includes(targetAgentId)) {
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
    }
    catch (err) {
        console.error(`[Relay] Failed to update status for ${commandId}:`, err);
        // Continue anyway — the response is more important than the status
    }
    // ---------------------------------------------------------------
    // 3. Rate Limiting
    // ---------------------------------------------------------------
    try {
        await (0, rateLimit_1.enforceRateLimit)(userId, "processRelayCommand", rateLimit_1.RATE_LIMITS.generation);
    }
    catch (rateLimitErr) {
        const msg = rateLimitErr instanceof Error ? rateLimitErr.message : "Rate limit exceeded";
        console.warn(`[Relay] Rate limited user ${userId}: ${msg}`);
        await markFailed(userId, commandId, `⚠️ ${msg}`);
        return;
    }
    // ---------------------------------------------------------------
    // 4. Call Gemini with the appropriate agent prompt
    // ---------------------------------------------------------------
    try {
        const { resolvedAgentId, prompt } = (0, agentPrompts_1.getAgentPrompt)(targetAgentId);
        console.log(`[Relay] Using agent: ${resolvedAgentId} for command ${commandId}`);
        // Lazy import to reduce cold start
        const { GoogleGenAI } = await Promise.resolve().then(() => __importStar(require("@google/genai")));
        const client = new GoogleGenAI({ apiKey: (0, secrets_1.getGeminiApiKey)() });
        const modelId = models_1.FUNCTION_AI_MODELS.TEXT.PRO;
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
            || ((_d = (_c = (_b = (_a = result.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d.map((p) => p.text).filter(Boolean).join("\n"))
            || "I processed your request but couldn't generate a response. Please try again.";
        // ---------------------------------------------------------------
        // 5. Send final response to phone
        // ---------------------------------------------------------------
        await sendResponse(userId, commandId, responseText, resolvedAgentId, false);
        await markCompleted(userId, commandId);
        console.log(`[Relay] ✅ Command ${commandId} completed (${responseText.length} chars, agent: ${resolvedAgentId})`);
    }
    catch (err) {
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
async function sendResponse(userId, commandId, text, agentId, isStreaming = false) {
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
async function markFailed(userId, commandId, errorMessage) {
    await sendResponse(userId, commandId, errorMessage, undefined, false);
    await markCompleted(userId, commandId);
}
/**
 * Mark a command as completed.
 */
async function markCompleted(userId, commandId) {
    try {
        await admin.firestore()
            .collection("users").doc(userId)
            .collection("remote-relay-commands").doc(commandId)
            .update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        console.error(`[Relay] Failed to mark ${commandId} as completed:`, err);
    }
}
//# sourceMappingURL=relayCommandProcessor.js.map