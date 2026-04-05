/**
 * telegramWebhook — Telegram Bot → indiiOS Relay Bridge
 *
 * HTTPS Cloud Function that receives Telegram Bot API webhook updates
 * and bridges them into the existing processRelayCommand pipeline via
 * Firestore. This means Telegram users get the same AI agent responses
 * as mobile controller users.
 *
 * Flow:
 *   Telegram → this webhook → Firestore write → processRelayCommand → Firestore response → this webhook → Telegram
 *
 * Commands:
 *   /start         — Welcome message + linking instructions
 *   /link <code>   — Link Telegram chat to indiiOS account
 *   /unlink        — Remove link
 *   /agent <id>    — Set default agent for this chat
 *   (any text)     — Forward to the linked indiiOS account's relay
 *
 * Architecture: Gen 1 HTTPS function with secrets
 * Timeout: 120s (webhook must respond within 60s to Telegram, but we need time to poll)
 * Memory: 256MB
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { telegramBotToken, telegramWebhookSecret } from "../config/secrets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            first_name: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
        };
        text?: string;
        date: number;
    };
}

interface TelegramLinkDoc {
    userId: string;
    linkedAt: admin.firestore.Timestamp;
    telegramUsername: string;
    defaultAgentId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const RESPONSE_POLL_INTERVAL_MS = 1500;
const RESPONSE_POLL_TIMEOUT_MS = 90_000;
const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;


// ---------------------------------------------------------------------------
// Cloud Function: HTTPS Webhook
// ---------------------------------------------------------------------------
export const telegramWebhook = functions
    .runWith({
        secrets: [telegramBotToken, telegramWebhookSecret],
        timeoutSeconds: 120,
        memory: "256MB",
     })
    .https.onRequest(async (req, res) => {
        // Only accept POST
        if (req.method !== "POST") {
            res.status(405).send("Method Not Allowed");
            return;
        }

        // Verify Telegram webhook secret token
        // Set via: setWebhook(url, { secret_token: TELEGRAM_WEBHOOK_SECRET })
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET || (() => {
            try { return telegramWebhookSecret.value(); } catch { return ""; }
        })();
        if (secret) {
            const incoming = req.headers['x-telegram-bot-api-secret-token'];
            if (incoming !== secret) {
                console.warn('[Telegram] Rejected request: invalid secret token');
                res.status(401).send("Unauthorized");
                return;
            }
        }

        const update: TelegramUpdate = req.body;

        // Ignore non-message updates (edits, callbacks, etc.)
        if (!update.message?.text || !update.message.chat) {
            res.status(200).send("OK");
            return;
        }

        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        const username = update.message.from.username || update.message.from.first_name;

        console.log(`[Telegram] Message from ${username} (chat ${chatId}): "${text.substring(0, 100)}"`);

        try {
            // ---------------------------------------------------------------
            // Route commands
            // ---------------------------------------------------------------
            if (text.startsWith("/start")) {
                await handleStart(chatId, username);
            } else if (text.startsWith("/link ")) {
                await handleLink(chatId, text, username);
            } else if (text === "/unlink") {
                await handleUnlink(chatId);
            } else if (text.startsWith("/agent ")) {
                await handleSetAgent(chatId, text);
            } else if (text.startsWith("/help")) {
                await handleHelp(chatId);
            } else {
                // Regular message — forward to relay
                await handleMessage(chatId, text, username);
            }
        } catch (err) {
            console.error(`[Telegram] Error handling message from chat ${chatId}:`, err);
            await sendTelegramMessage(chatId, "❌ An error occurred. Please try again.");
        }

        res.status(200).send("OK");
    });

// ---------------------------------------------------------------------------
// Command Handlers
// ---------------------------------------------------------------------------

/**
 * /start — Welcome message with instructions
 */
async function handleStart(chatId: number, username: string): Promise<void> {
    const message = [
        `🎵 Welcome to indiiOS, ${username}!`,
        "",
        "I'm your AI music assistant. Connect me to your indiiOS account to get started.",
        "",
        "**How to link:**",
        "1. Open indiiOS Studio → Settings → Integrations",
        "2. Click \"Link Telegram\" to get a code",
        "3. Send me: `/link YOUR_CODE`",
        "",
        "**Commands:**",
        "/link `<code>` — Connect to your indiiOS account",
        "/unlink — Disconnect your account",
        "/agent `<id>` — Switch AI agent (e.g. `/agent brand`)",
        "/help — Show this message",
        "",
        "Once linked, just type any message and I'll process it with your AI agents! 🚀",
    ].join("\n");

    await sendTelegramMessage(chatId, message);
}

/**
 * /help — Show commands
 */
async function handleHelp(chatId: number): Promise<void> {
    await handleStart(chatId, "there");
}

/**
 * /link <code> — Link Telegram chat to indiiOS account
 */
async function handleLink(chatId: number, text: string, username: string): Promise<void> {
    const code = text.replace("/link ", "").trim();

    if (!code || code.length < 6) {
        await sendTelegramMessage(chatId, "⚠️ Invalid code. Use `/link YOUR_CODE` with the code from indiiOS Studio.");
        return;
    }

    const db = admin.firestore();

    // Look up the link code
    const codeDoc = await db.collection("telegram-link-codes").doc(code).get();

    if (!codeDoc.exists) {
        await sendTelegramMessage(chatId, "❌ Code not found. Please generate a new one from indiiOS Studio.");
        return;
    }

    const codeData = codeDoc.data()!;

    // Check expiration
    const expiresAt = codeData.expiresAt?.toMillis?.() || 0;
    if (Date.now() > expiresAt) {
        await sendTelegramMessage(chatId, "⏰ Code expired. Please generate a new one from indiiOS Studio.");
        await codeDoc.ref.delete();
        return;
    }

    // Check if already used
    if (codeData.used) {
        await sendTelegramMessage(chatId, "⚠️ This code has already been used. Generate a new one.");
        return;
    }

    const userId = codeData.userId;

    // Create the link
    const batch = db.batch();

    batch.set(db.collection("telegram-links").doc(String(chatId)), {
        userId,
        linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        telegramUsername: username,
    });

    batch.update(codeDoc.ref, { used: true });

    await batch.commit();

    console.log(`[Telegram] ✅ Linked chat ${chatId} (${username}) → user ${userId}`);
    await sendTelegramMessage(chatId, "✅ Account linked! You can now send messages and I'll process them with your AI agents. 🎶");
}

/**
 * /unlink — Remove the link
 */
async function handleUnlink(chatId: number): Promise<void> {
    const db = admin.firestore();
    const linkDoc = await db.collection("telegram-links").doc(String(chatId)).get();

    if (!linkDoc.exists) {
        await sendTelegramMessage(chatId, "⚠️ No account linked to this chat.");
        return;
    }

    await linkDoc.ref.delete();
    console.log(`[Telegram] 🔗 Unlinked chat ${chatId}`);
    await sendTelegramMessage(chatId, "🔓 Account unlinked. Send /link to reconnect.");
}

/**
 * /agent <id> — Set the default agent for this chat
 */
async function handleSetAgent(chatId: number, text: string): Promise<void> {
    const agentId = text.replace("/agent ", "").trim().toLowerCase();

    if (!agentId) {
        await sendTelegramMessage(chatId, "⚠️ Usage: `/agent brand` or `/agent music` or `/agent conductor`");
        return;
    }

    const db = admin.firestore();
    const linkDoc = db.collection("telegram-links").doc(String(chatId));
    const link = await linkDoc.get();

    if (!link.exists) {
        await sendTelegramMessage(chatId, "⚠️ Please link your account first with /link");
        return;
    }

    await linkDoc.update({ defaultAgentId: agentId });
    await sendTelegramMessage(chatId, `🤖 Default agent set to **${agentId}**. All messages will be routed there.`);
}

/**
 * Handle a regular text message — forward to relay pipeline
 */
async function handleMessage(chatId: number, text: string, username: string): Promise<void> {
    const db = admin.firestore();

    // Look up the link
    const linkDoc = await db.collection("telegram-links").doc(String(chatId)).get();

    if (!linkDoc.exists) {
        await sendTelegramMessage(chatId, [
            "⚠️ Your Telegram isn't linked to an indiiOS account yet.",
            "",
            "Send /start for instructions on how to link.",
        ].join("\n"));
        return;
    }

    const linkData = linkDoc.data() as TelegramLinkDoc;
    const userId = linkData.userId;
    const targetAgentId = linkData.defaultAgentId || "conductor";

    // Send typing indicator
    await sendTelegramAction(chatId, "typing");

    // Write command to the relay path (same as mobile controller)
    const commandRef = await db
        .collection("users").doc(userId)
        .collection("remote-relay-commands")
        .add({
            text,
            targetAgentId,
            status: "pending",
            source: "telegram",
            telegramChatId: chatId,
            telegramUsername: username,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

    const commandId = commandRef.id;
    console.log(`[Telegram] 📝 Created relay command ${commandId} for user ${userId} (agent: ${targetAgentId})`);

    // Poll for the response
    const responseText = await pollForResponse(userId, commandId);

    // Send response back to Telegram
    if (responseText) {
        // Split long messages (Telegram max is 4096 chars)
        const chunks = splitMessage(responseText, MAX_TELEGRAM_MESSAGE_LENGTH);
        for (const chunk of chunks) {
            await sendTelegramMessage(chatId, chunk);
        }
    } else {
        await sendTelegramMessage(chatId, "⏰ Response timed out. The agent may still be processing — check indiiOS Studio for the full response.");
    }
}

// ---------------------------------------------------------------------------
// Telegram API Helpers
// ---------------------------------------------------------------------------

/**
 * Send a text message via the Telegram Bot API.
 */
async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
    const token = getTelegramToken();
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Telegram] Failed to send message to chat ${chatId}: ${response.status} ${errorBody}`);
    }
}

/**
 * Send a chat action (typing indicator) via the Telegram Bot API.
 */
async function sendTelegramAction(chatId: number, action: string): Promise<void> {
    const token = getTelegramToken();
    const url = `https://api.telegram.org/bot${token}/sendChatAction`;

    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            action,
        }),
    }).catch(() => { /* non-critical */ });
}

/**
 * Get the Telegram Bot Token from secrets.
 */
function getTelegramToken(): string {
    const envKey = process.env.TELEGRAM_BOT_TOKEN;
    if (envKey && envKey.trim().length > 0) return envKey;

    try {
        const secret = telegramBotToken.value();
        if (secret && secret.trim().length > 0) return secret;
    } catch {
        if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
    }

    throw new Error("Telegram Bot Token not found. Please set TELEGRAM_BOT_TOKEN secret.");
}

// ---------------------------------------------------------------------------
// Response Polling
// ---------------------------------------------------------------------------

/**
 * Poll Firestore for the relay response to a command.
 * Returns the response text, or null if timed out.
 */
async function pollForResponse(userId: string, commandId: string): Promise<string | null> {
    const db = admin.firestore();
    const startTime = Date.now();

    while (Date.now() - startTime < RESPONSE_POLL_TIMEOUT_MS) {
        // Check for a final response
        const responsesSnap = await db
            .collection("users").doc(userId)
            .collection("remote-relay-responses")
            .where("commandId", "==", commandId)
            .where("isFinal", "==", true)
            .limit(1)
            .get();

        if (!responsesSnap.empty) {
            const responseData = responsesSnap.docs[0].data();
            return responseData.text || null;
        }

        // Wait before polling again
        await sleep(RESPONSE_POLL_INTERVAL_MS);
    }

    console.warn(`[Telegram] ⏰ Timed out waiting for response to command ${commandId}`);
    return null;
}

/**
 * Split a long message into chunks that fit Telegram's max length.
 */
function splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }

        // Try to break at a newline
        let breakPoint = remaining.lastIndexOf("\n", maxLength);
        if (breakPoint < maxLength * 0.5) {
            // No good newline break — break at space
            breakPoint = remaining.lastIndexOf(" ", maxLength);
        }
        if (breakPoint < maxLength * 0.3) {
            // No good break point — hard break
            breakPoint = maxLength;
        }

        chunks.push(remaining.substring(0, breakPoint));
        remaining = remaining.substring(breakPoint).trimStart();
    }

    return chunks;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
