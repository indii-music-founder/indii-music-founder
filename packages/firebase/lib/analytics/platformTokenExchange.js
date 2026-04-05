"use strict";
/**
 * platformTokenExchange — Cloud Functions
 *
 * Server-side OAuth token operations for analytics platform integrations.
 * Client secrets are NEVER exposed to the browser — all secret-dependent
 * operations go through these functions.
 *
 * Platforms:
 *   - Spotify  (Authorization Code + PKCE; secret needed only for refresh)
 *   - TikTok   (OAuth 2.0; secret required for exchange + refresh)
 *
 * YouTube uses the Firebase/Google OAuth token directly on the client via
 * the YouTube Analytics API — no server-side exchange needed.
 *
 * Token storage: Firestore `users/{uid}/analyticsTokens/{platform}`
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
exports.analyticsRevokeToken = exports.analyticsRefreshToken = exports.analyticsExchangeToken = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const secrets_1 = require("../config/secrets");
// ── Secrets (imported from centralized config/secrets.ts) ─────────────────────
const ALL_SECRETS = [
    secrets_1.spotifyClientId, secrets_1.spotifyClientSecret,
    secrets_1.tiktokClientKey, secrets_1.tiktokClientSecret,
    secrets_1.metaAppId, secrets_1.metaAppSecret,
];
// ── Firestore collection path ─────────────────────────────────────────────────
const tokenPath = (uid, platform) => admin.firestore().collection("users").doc(uid).collection("analyticsTokens").doc(platform);
// ── Helper: make authenticated assertion ─────────────────────────────────────
function assertAuth(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    return context.auth.uid;
}
// ─────────────────────────────────────────────────────────────────────────────
// analyticsExchangeToken
// Exchange an OAuth authorization code for access + refresh tokens.
// ─────────────────────────────────────────────────────────────────────────────
exports.analyticsExchangeToken = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', secrets: ALL_SECRETS, timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    var _a, _b, _c;
    const uid = assertAuth(context);
    const { platform, code, redirectUri, codeVerifier } = data;
    if (!platform || !code || !redirectUri) {
        throw new functions.https.HttpsError("invalid-argument", "platform, code, and redirectUri are required.");
    }
    let tokenRes;
    if (platform === "spotify") {
        tokenRes = await exchangeSpotifyCode(code, redirectUri, codeVerifier);
        await storeToken(uid, "spotify", {
            accessToken: tokenRes.access_token,
            refreshToken: tokenRes.refresh_token,
            expiresAt: Date.now() + ((_a = tokenRes.expires_in) !== null && _a !== void 0 ? _a : 3600) * 1000,
            scope: tokenRes.scope,
        });
        return { ok: true, expiresIn: tokenRes.expires_in };
    }
    if (platform === "tiktok") {
        tokenRes = await exchangeTikTokCode(code, redirectUri);
        await storeToken(uid, "tiktok", {
            accessToken: tokenRes.access_token,
            refreshToken: tokenRes.refresh_token,
            expiresAt: Date.now() + ((_b = tokenRes.expires_in) !== null && _b !== void 0 ? _b : 86400) * 1000,
            openId: tokenRes.open_id,
        });
        return { ok: true, expiresIn: tokenRes.expires_in };
    }
    if (platform === "instagram") {
        const igToken = await exchangeInstagramCode(code, redirectUri);
        // Exchange short-lived token for long-lived token (60 days)
        const longLived = await getInstagramLongLivedToken(igToken.access_token);
        await storeToken(uid, "instagram", {
            accessToken: longLived.access_token,
            refreshToken: longLived.access_token, // Instagram uses same token for refresh
            expiresAt: Date.now() + ((_c = longLived.expires_in) !== null && _c !== void 0 ? _c : 5183944) * 1000,
            igUserId: igToken.user_id,
        });
        return { ok: true, expiresIn: longLived.expires_in };
    }
    throw new functions.https.HttpsError("invalid-argument", `Unsupported platform: ${platform}`);
});
// ─────────────────────────────────────────────────────────────────────────────
// analyticsRefreshToken
// Refresh an expired access token using the stored refresh token.
// ─────────────────────────────────────────────────────────────────────────────
exports.analyticsRefreshToken = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', secrets: ALL_SECRETS, timeoutSeconds: 30 })
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
    const uid = assertAuth(context);
    const { platform } = data;
    if (!platform) {
        throw new functions.https.HttpsError("invalid-argument", "platform is required.");
    }
    const snap = await tokenPath(uid, platform).get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", `No token stored for platform: ${platform}`);
    }
    const stored = snap.data();
    if (!stored.refreshToken) {
        throw new functions.https.HttpsError("failed-precondition", "No refresh token available — user must re-authenticate.");
    }
    // Check if still valid (5-min buffer)
    if (stored.expiresAt && stored.expiresAt > Date.now() + 5 * 60 * 1000) {
        return { ok: true, accessToken: stored.accessToken, expiresAt: stored.expiresAt };
    }
    let newAccess;
    let newExpiry;
    let newRefresh;
    if (platform === "spotify") {
        const r = await refreshSpotifyToken(stored.refreshToken);
        newAccess = r.access_token;
        newExpiry = Date.now() + ((_a = r.expires_in) !== null && _a !== void 0 ? _a : 3600) * 1000;
        newRefresh = (_b = r.refresh_token) !== null && _b !== void 0 ? _b : stored.refreshToken; // Spotify may rotate
    }
    else if (platform === "tiktok") {
        const r = await refreshTikTokToken(stored.refreshToken);
        newAccess = r.access_token;
        newExpiry = Date.now() + ((_c = r.expires_in) !== null && _c !== void 0 ? _c : 86400) * 1000;
        newRefresh = (_d = r.refresh_token) !== null && _d !== void 0 ? _d : stored.refreshToken;
    }
    else if (platform === "instagram") {
        // Instagram long-lived tokens are refreshed via a GET request
        const r = await refreshInstagramLongLivedToken(stored.accessToken);
        newAccess = r.access_token;
        newExpiry = Date.now() + ((_e = r.expires_in) !== null && _e !== void 0 ? _e : 5183944) * 1000;
        newRefresh = r.access_token; // same token acts as refresh
    }
    else {
        throw new functions.https.HttpsError("invalid-argument", `Unsupported platform: ${platform}`);
    }
    await storeToken(uid, platform, Object.assign(Object.assign({}, stored), { accessToken: newAccess, refreshToken: newRefresh, expiresAt: newExpiry }));
    return { ok: true, accessToken: newAccess, expiresAt: newExpiry };
});
// ─────────────────────────────────────────────────────────────────────────────
// analyticsRevokeToken
// Disconnect a platform — deletes stored tokens from Firestore.
// ─────────────────────────────────────────────────────────────────────────────
exports.analyticsRevokeToken = functions
    .runWith({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true', secrets: ALL_SECRETS, timeoutSeconds: 15 })
    .https.onCall(async (data, context) => {
    const uid = assertAuth(context);
    const { platform } = data;
    if (!platform) {
        throw new functions.https.HttpsError("invalid-argument", "platform is required.");
    }
    // Best-effort revocation at the platform's API
    const snap = await tokenPath(uid, platform).get();
    if (snap.exists) {
        const stored = snap.data();
        if (platform === "spotify" && stored.accessToken) {
            await revokeSpotifyToken(stored.accessToken).catch(() => { });
        }
    }
    await tokenPath(uid, platform).delete();
    return { ok: true };
});
async function exchangeSpotifyCode(code, redirectUri, codeVerifier) {
    const params = new URLSearchParams(Object.assign({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: secrets_1.spotifyClientId.value() }, (codeVerifier
        ? { code_verifier: codeVerifier } // PKCE path
        : { client_secret: secrets_1.spotifyClientSecret.value() })));
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Spotify token exchange failed: ${err}`);
    }
    return res.json();
}
async function refreshSpotifyToken(refreshToken) {
    const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: secrets_1.spotifyClientId.value(),
        client_secret: secrets_1.spotifyClientSecret.value(),
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Spotify refresh failed: ${err}`);
    }
    return res.json();
}
async function revokeSpotifyToken(accessToken) {
    await fetch(`https://accounts.spotify.com/api/token`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => { });
}
async function exchangeTikTokCode(code, redirectUri) {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_key: secrets_1.tiktokClientKey.value(),
            client_secret: secrets_1.tiktokClientSecret.value(),
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
        }).toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `TikTok token exchange failed: ${err}`);
    }
    const body = await res.json();
    return body.data;
}
async function refreshTikTokToken(refreshToken) {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_key: secrets_1.tiktokClientKey.value(),
            client_secret: secrets_1.tiktokClientSecret.value(),
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }).toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `TikTok refresh failed: ${err}`);
    }
    const body = await res.json();
    return body.data;
}
/**
 * Exchange authorization code for short-lived Instagram token.
 * Short-lived tokens expire in 1 hour; we immediately upgrade to long-lived.
 */
async function exchangeInstagramCode(code, redirectUri) {
    const params = new URLSearchParams({
        client_id: secrets_1.metaAppId.value(),
        client_secret: secrets_1.metaAppSecret.value(),
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
    });
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Instagram token exchange failed: ${err}`);
    }
    return res.json();
}
/**
 * Exchange a short-lived Instagram token for a long-lived token (valid 60 days).
 * Long-lived tokens can be refreshed before expiry via refreshInstagramLongLivedToken.
 */
async function getInstagramLongLivedToken(shortLivedToken) {
    const params = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: secrets_1.metaAppSecret.value(),
        access_token: shortLivedToken,
    });
    const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);
    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Instagram long-lived token exchange failed: ${err}`);
    }
    return res.json();
}
/**
 * Refresh a long-lived Instagram token (must be done within 60 days of expiry).
 * Refreshed tokens are valid for another 60 days.
 */
async function refreshInstagramLongLivedToken(accessToken) {
    const params = new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: accessToken,
    });
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);
    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Instagram token refresh failed: ${err}`);
    }
    return res.json();
}
// ── Firestore helpers ─────────────────────────────────────────────────────────
async function storeToken(uid, platform, token) {
    await tokenPath(uid, platform).set(Object.assign(Object.assign({}, token), { platform, updatedAt: admin.firestore.FieldValue.serverTimestamp(), connectedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
}
//# sourceMappingURL=platformTokenExchange.js.map