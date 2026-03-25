/**
 * generateTelegramLinkCode — Creates a one-time code for linking Telegram
 *
 * Called from the indiiOS frontend (Settings → Integrations → Link Telegram).
 * Generates a random 8-character code, stores it in Firestore with a 10-minute TTL,
 * and returns the code to the user who then sends it to the Telegram bot via /link.
 *
 * Architecture: Gen 1 HTTPS Callable (requires Firebase Auth)
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const LINK_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const generateTelegramLinkCode = functions
    .runWith({ timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (_data, context) => {
        // Require authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "You must be signed in to generate a Telegram link code."
            );
        }

        const userId = context.auth.uid;
        const db = admin.firestore();

        // Generate a random 8-character alphanumeric code
        const code = crypto.randomBytes(4).toString("hex").toUpperCase();

        // Store the code with TTL
        await db.collection("telegram-link-codes").doc(code).set({
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + LINK_CODE_TTL_MS),
            used: false,
        });

        console.log(`[Telegram] Generated link code ${code} for user ${userId}`);

        return {
            code,
            expiresInMinutes: 10,
            instructions: "Send /link " + code + " to the indiiOS bot on Telegram",
        };
    });

/**
 * getTelegramLinkStatus — Check if the current user has a linked Telegram account
 *
 * Called from the frontend to show the linking status in Settings.
 */
export const getTelegramLinkStatus = functions
    .runWith({ timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (_data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "You must be signed in."
            );
        }

        const userId = context.auth.uid;
        const db = admin.firestore();

        // Find any link pointing to this user
        const linksSnap = await db.collection("telegram-links")
            .where("userId", "==", userId)
            .limit(1)
            .get();

        if (linksSnap.empty) {
            return { linked: false };
        }

        const linkData = linksSnap.docs[0].data();
        return {
            linked: true,
            telegramUsername: linkData.telegramUsername || "Unknown",
            linkedAt: linkData.linkedAt?.toDate?.()?.toISOString() || null,
            defaultAgentId: linkData.defaultAgentId || "conductor",
        };
    });
