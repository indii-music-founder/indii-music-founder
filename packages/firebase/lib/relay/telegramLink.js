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
exports.getTelegramLinkStatus = exports.generateTelegramLinkCode = void 0;
/**
 * generateTelegramLinkCode — Creates a one-time code for linking Telegram
 *
 * Called from the indiiOS frontend (Settings → Integrations → Link Telegram).
 * Generates a random 8-character code, stores it in Firestore with a 10-minute TTL,
 * and returns the code to the user who then sends it to the Telegram bot via /link.
 *
 * Architecture: Gen 1 HTTPS Callable (requires Firebase Auth)
 */
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const LINK_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
exports.generateTelegramLinkCode = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', timeoutSeconds: 30, memory: "128MB" })
    .https.onCall(async (_data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be signed in to generate a Telegram link code.");
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
exports.getTelegramLinkStatus = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', timeoutSeconds: 15, memory: "128MB" })
    .https.onCall(async (_data, context) => {
    var _a, _b, _c;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
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
        linkedAt: ((_c = (_b = (_a = linkData.linkedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString()) || null,
        defaultAgentId: linkData.defaultAgentId || "conductor",
    };
});
//# sourceMappingURL=telegramLink.js.map