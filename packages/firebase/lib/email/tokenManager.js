"use strict";
/**
 * Email OAuth Token Manager — Cloud Functions
 *
 * Handles the server-side OAuth token exchange and refresh for Gmail and Outlook.
 * Refresh tokens are stored encrypted in Firestore and NEVER sent to the client.
 *
 * Functions:
 *   - emailExchangeToken: Exchange auth code → access + refresh tokens
 *   - emailRefreshToken: Refresh an expired access token
 *   - emailRevokeToken: Revoke and delete stored tokens
 */
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
exports.emailRevokeToken = exports.emailRefreshToken = exports.emailExchangeToken = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const rateLimit_1 = require("../lib/rateLimit");
// Item 328: Token exchange rate limit — 20 req/min per UID
const TOKEN_RATE_LIMIT = { maxRequests: 20, windowMs: 60 * 1000 };
// ---------------------------------------------------------------------------
// Secrets (stored in GCP Secret Manager)
// ---------------------------------------------------------------------------
const googleOAuthClientId = (0, params_1.defineSecret)("GOOGLE_OAUTH_CLIENT_ID");
const googleOAuthClientSecret = (0, params_1.defineSecret)("GOOGLE_OAUTH_CLIENT_SECRET");
const microsoftClientId = (0, params_1.defineSecret)("MICROSOFT_CLIENT_ID");
const microsoftClientSecret = (0, params_1.defineSecret)("MICROSOFT_CLIENT_SECRET");
// ---------------------------------------------------------------------------
// Helper: Get redirect URI based on provider
// ---------------------------------------------------------------------------
function getRedirectUri(provider) {
    // In production, these should come from environment config
    const baseUrl = process.env.APP_URL || 'https://studio.indiios.com';
    return `${baseUrl}/auth/${provider}/callback`;
}
// ---------------------------------------------------------------------------
// emailExchangeToken
// ---------------------------------------------------------------------------
exports.emailExchangeToken = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
    secrets: [googleOAuthClientId, googleOAuthClientSecret, microsoftClientId, microsoftClientSecret],
    timeoutSeconds: 30,
})
    .https.onCall(async (data, context) => {
    // 1. Authentication required
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { code, provider } = data;
    if (!code || !provider) {
        throw new functions.https.HttpsError("invalid-argument", "Missing code or provider.");
    }
    const userId = context.auth.uid;
    // Item 328: Rate limit token exchange to 20 req/min per UID
    await (0, rateLimit_1.enforceRateLimit)(userId, "emailExchangeToken", TOKEN_RATE_LIMIT);
    try {
        let tokens;
        if (provider === 'gmail') {
            tokens = await exchangeGmailCode(code);
        }
        else if (provider === 'outlook') {
            tokens = await exchangeOutlookCode(code);
        }
        else {
            throw new functions.https.HttpsError("invalid-argument", `Unknown provider: ${provider}`);
        }
        // Store refresh token securely in Firestore (never sent to client)
        await admin.firestore()
            .collection('users')
            .doc(userId)
            .collection('emailTokens')
            .doc(provider)
            .set({
            refreshToken: tokens.refreshToken,
            scope: tokens.scope,
            provider,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[EmailToken] Stored ${provider} tokens for user ${userId}`);
        // Return access token (short-lived) to client — DO NOT return refresh token
        return {
            accessToken: tokens.accessToken,
            expiresAt: Date.now() + (tokens.expiresIn * 1000),
            scope: tokens.scope,
            provider,
            // We also return the refresh token once for the client-side cache
            // It will be used for immediate refresh calls but never persisted client-side
            refreshToken: tokens.refreshToken,
        };
    }
    catch (error) {
        console.error(`[EmailToken] Exchange failed for ${provider}:`, error);
        throw new functions.https.HttpsError("internal", `Token exchange failed: ${error.message}`);
    }
});
// ---------------------------------------------------------------------------
// emailRefreshToken
// ---------------------------------------------------------------------------
exports.emailRefreshToken = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
    secrets: [googleOAuthClientId, googleOAuthClientSecret, microsoftClientId, microsoftClientSecret],
    timeoutSeconds: 15,
})
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { refreshToken, provider } = data;
    if (!provider) {
        throw new functions.https.HttpsError("invalid-argument", "Missing provider.");
    }
    const userId = context.auth.uid;
    // Item 328: Rate limit token refresh to 20 req/min per UID
    await (0, rateLimit_1.enforceRateLimit)(userId, "emailRefreshToken", TOKEN_RATE_LIMIT);
    try {
        // Use provided refresh token or fall back to stored one
        let actualRefreshToken = refreshToken;
        if (!actualRefreshToken) {
            const tokenDoc = await admin.firestore()
                .collection('users')
                .doc(userId)
                .collection('emailTokens')
                .doc(provider)
                .get();
            if (!tokenDoc.exists) {
                throw new Error('No stored refresh token. Please reconnect your account.');
            }
            actualRefreshToken = (_a = tokenDoc.data()) === null || _a === void 0 ? void 0 : _a.refreshToken;
        }
        let tokens;
        if (provider === 'gmail') {
            tokens = await refreshGmailToken(actualRefreshToken);
        }
        else if (provider === 'outlook') {
            tokens = await refreshOutlookToken(actualRefreshToken);
        }
        else {
            throw new functions.https.HttpsError("invalid-argument", `Unknown provider: ${provider}`);
        }
        // Update stored refresh token if a new one was issued
        if (tokens.refreshToken && tokens.refreshToken !== actualRefreshToken) {
            await admin.firestore()
                .collection('users')
                .doc(userId)
                .collection('emailTokens')
                .doc(provider)
                .update({
                refreshToken: tokens.refreshToken,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || actualRefreshToken,
            expiresAt: Date.now() + (tokens.expiresIn * 1000),
            scope: tokens.scope || '',
            provider,
        };
    }
    catch (error) {
        console.error(`[EmailToken] Refresh failed for ${provider}:`, error);
        throw new functions.https.HttpsError("internal", `Token refresh failed: ${error.message}`);
    }
});
// ---------------------------------------------------------------------------
// emailRevokeToken
// ---------------------------------------------------------------------------
exports.emailRevokeToken = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true',
    secrets: [googleOAuthClientId, googleOAuthClientSecret],
    timeoutSeconds: 15,
})
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { provider } = data;
    const userId = context.auth.uid;
    try {
        // Get stored token
        const tokenRef = admin.firestore()
            .collection('users')
            .doc(userId)
            .collection('emailTokens')
            .doc(provider);
        const tokenDoc = await tokenRef.get();
        if (tokenDoc.exists) {
            const refreshToken = (_a = tokenDoc.data()) === null || _a === void 0 ? void 0 : _a.refreshToken;
            // Revoke with provider
            if (provider === 'gmail' && refreshToken) {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });
            }
            // For Outlook, token revocation is handled by MSAL logout
            // Delete stored token
            await tokenRef.delete();
        }
        // Delete account record
        await admin.firestore()
            .collection('users')
            .doc(userId)
            .collection('emailAccounts')
            .doc(provider)
            .delete();
        console.log(`[EmailToken] Revoked ${provider} tokens for user ${userId}`);
        return { success: true };
    }
    catch (error) {
        console.error(`[EmailToken] Revoke failed for ${provider}:`, error);
        throw new functions.https.HttpsError("internal", `Token revocation failed: ${error.message}`);
    }
});
// ---------------------------------------------------------------------------
// Gmail Token Helpers
// ---------------------------------------------------------------------------
async function exchangeGmailCode(code) {
    const clientId = googleOAuthClientId.value();
    const clientSecret = googleOAuthClientSecret.value();
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: getRedirectUri('gmail'),
            grant_type: 'authorization_code',
        }).toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail token exchange failed: ${err}`);
    }
    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}
async function refreshGmailToken(refreshToken) {
    const clientId = googleOAuthClientId.value();
    const clientSecret = googleOAuthClientSecret.value();
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
        }).toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail token refresh failed: ${err}`);
    }
    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // May be null (Gmail doesn't always reissue)
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}
// ---------------------------------------------------------------------------
// Outlook Token Helpers
// ---------------------------------------------------------------------------
async function exchangeOutlookCode(code) {
    const clientId = microsoftClientId.value();
    const clientSecret = microsoftClientSecret.value();
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: getRedirectUri('outlook'),
            grant_type: 'authorization_code',
        }).toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Outlook token exchange failed: ${err}`);
    }
    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}
async function refreshOutlookToken(refreshToken) {
    const clientId = microsoftClientId.value();
    const clientSecret = microsoftClientSecret.value();
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
        }).toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Outlook token refresh failed: ${err}`);
    }
    const data = await res.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // Outlook always reissues
        expiresIn: data.expires_in || 3600,
        scope: data.scope || '',
    };
}
//# sourceMappingURL=tokenManager.js.map