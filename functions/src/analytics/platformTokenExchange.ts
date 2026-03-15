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

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
    spotifyClientId,
    spotifyClientSecret,
    tiktokClientKey,
    tiktokClientSecret,
    metaAppId,
    metaAppSecret,
} from "../config/secrets";

// ── Secrets (imported from centralized config/secrets.ts) ─────────────────────
const ALL_SECRETS = [
    spotifyClientId, spotifyClientSecret,
    tiktokClientKey, tiktokClientSecret,
    metaAppId, metaAppSecret,
];

// ── Firestore collection path ─────────────────────────────────────────────────
const tokenPath = (uid: string, platform: string) =>
    admin.firestore().collection("users").doc(uid).collection("analyticsTokens").doc(platform);

// ── Helper: make authenticated assertion ─────────────────────────────────────
function assertAuth(context: functions.https.CallableContext): string {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    return context.auth.uid;
}

// ─────────────────────────────────────────────────────────────────────────────
// analyticsExchangeToken
// Exchange an OAuth authorization code for access + refresh tokens.
// ─────────────────────────────────────────────────────────────────────────────

export const analyticsExchangeToken = functions
    .runWith({ secrets: ALL_SECRETS, timeoutSeconds: 30 })
    .https.onCall(async (data: unknown, context) => {
        const uid = assertAuth(context);
        const { platform, code, redirectUri, codeVerifier } = data as {
            platform: string;
            code: string;
            redirectUri: string;
            codeVerifier?: string;
        };

        if (!platform || !code || !redirectUri) {
            throw new functions.https.HttpsError("invalid-argument", "platform, code, and redirectUri are required.");
        }

        let tokenRes: SpotifyTokenResponse | TikTokTokenResponse;

        if (platform === "spotify") {
            tokenRes = await exchangeSpotifyCode(code, redirectUri, codeVerifier);
            await storeToken(uid, "spotify", {
                accessToken: tokenRes.access_token,
                refreshToken: tokenRes.refresh_token,
                expiresAt: Date.now() + (tokenRes.expires_in ?? 3600) * 1000,
                scope: tokenRes.scope,
            });
            return { ok: true, expiresIn: tokenRes.expires_in };
        }

        if (platform === "tiktok") {
            tokenRes = await exchangeTikTokCode(code, redirectUri) as TikTokTokenResponse;
            await storeToken(uid, "tiktok", {
                accessToken: tokenRes.access_token,
                refreshToken: tokenRes.refresh_token,
                expiresAt: Date.now() + (tokenRes.expires_in ?? 86400) * 1000,
                openId: (tokenRes as TikTokTokenResponse).open_id,
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
                expiresAt: Date.now() + (longLived.expires_in ?? 5183944) * 1000,
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

export const analyticsRefreshToken = functions
    .runWith({ secrets: ALL_SECRETS, timeoutSeconds: 30 })
    .https.onCall(async (data: unknown, context) => {
        const uid = assertAuth(context);
        const { platform } = data as { platform: string };
        if (!platform) {
            throw new functions.https.HttpsError("invalid-argument", "platform is required.");
        }

        const snap = await tokenPath(uid, platform).get();
        if (!snap.exists) {
            throw new functions.https.HttpsError("not-found", `No token stored for platform: ${platform}`);
        }

        const stored = snap.data() as StoredToken;
        if (!stored.refreshToken) {
            throw new functions.https.HttpsError("failed-precondition", "No refresh token available — user must re-authenticate.");
        }

        // Check if still valid (5-min buffer)
        if (stored.expiresAt && stored.expiresAt > Date.now() + 5 * 60 * 1000) {
            return { ok: true, accessToken: stored.accessToken, expiresAt: stored.expiresAt };
        }

        let newAccess: string;
        let newExpiry: number;
        let newRefresh: string | undefined;

        if (platform === "spotify") {
            const r = await refreshSpotifyToken(stored.refreshToken);
            newAccess  = r.access_token;
            newExpiry  = Date.now() + (r.expires_in ?? 3600) * 1000;
            newRefresh = r.refresh_token ?? stored.refreshToken; // Spotify may rotate
        } else if (platform === "tiktok") {
            const r = await refreshTikTokToken(stored.refreshToken);
            newAccess  = r.access_token;
            newExpiry  = Date.now() + (r.expires_in ?? 86400) * 1000;
            newRefresh = r.refresh_token ?? stored.refreshToken;
        } else if (platform === "instagram") {
            // Instagram long-lived tokens are refreshed via a GET request
            const r = await refreshInstagramLongLivedToken(stored.accessToken);
            newAccess  = r.access_token;
            newExpiry  = Date.now() + (r.expires_in ?? 5183944) * 1000;
            newRefresh = r.access_token; // same token acts as refresh
        } else {
            throw new functions.https.HttpsError("invalid-argument", `Unsupported platform: ${platform}`);
        }

        await storeToken(uid, platform, {
            ...stored,
            accessToken: newAccess,
            refreshToken: newRefresh,
            expiresAt: newExpiry,
        });

        return { ok: true, accessToken: newAccess, expiresAt: newExpiry };
    });

// ─────────────────────────────────────────────────────────────────────────────
// analyticsRevokeToken
// Disconnect a platform — deletes stored tokens from Firestore.
// ─────────────────────────────────────────────────────────────────────────────

export const analyticsRevokeToken = functions
    .runWith({ secrets: ALL_SECRETS, timeoutSeconds: 15 })
    .https.onCall(async (data: unknown, context) => {
        const uid = assertAuth(context);
        const { platform } = data as { platform: string };
        if (!platform) {
            throw new functions.https.HttpsError("invalid-argument", "platform is required.");
        }

        // Best-effort revocation at the platform's API
        const snap = await tokenPath(uid, platform).get();
        if (snap.exists) {
            const stored = snap.data() as StoredToken;
            if (platform === "spotify" && stored.accessToken) {
                await revokeSpotifyToken(stored.accessToken).catch(() => { /* best-effort */ });
            }
        }

        await tokenPath(uid, platform).delete();
        return { ok: true };
    });

// ─────────────────────────────────────────────────────────────────────────────
// Platform-specific token operations
// ─────────────────────────────────────────────────────────────────────────────

interface SpotifyTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
}

interface TikTokTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    open_id: string;
    scope: string;
}

interface StoredToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
    openId?: string;
    [key: string]: unknown;
}

async function exchangeSpotifyCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
): Promise<SpotifyTokenResponse> {
    const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: spotifyClientId.value(),
        ...(codeVerifier
            ? { code_verifier: codeVerifier }                     // PKCE path
            : { client_secret: spotifyClientSecret.value() }),    // Auth code path
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Spotify token exchange failed: ${err}`);
    }
    return res.json() as Promise<SpotifyTokenResponse>;
}

async function refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokenResponse> {
    const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: spotifyClientId.value(),
        client_secret: spotifyClientSecret.value(),
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
    return res.json() as Promise<SpotifyTokenResponse>;
}

async function revokeSpotifyToken(accessToken: string): Promise<void> {
    await fetch(`https://accounts.spotify.com/api/token`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => { /* best-effort */ });
}

async function exchangeTikTokCode(code: string, redirectUri: string): Promise<TikTokTokenResponse> {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_key: tiktokClientKey.value(),
            client_secret: tiktokClientSecret.value(),
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
        }).toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `TikTok token exchange failed: ${err}`);
    }

    const body = await res.json() as { data: TikTokTokenResponse };
    return body.data;
}

async function refreshTikTokToken(refreshToken: string): Promise<TikTokTokenResponse> {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_key: tiktokClientKey.value(),
            client_secret: tiktokClientSecret.value(),
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }).toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `TikTok refresh failed: ${err}`);
    }
    const body = await res.json() as { data: TikTokTokenResponse };
    return body.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instagram Graph API token operations
// ─────────────────────────────────────────────────────────────────────────────

interface InstagramShortLivedToken {
    access_token: string;
    token_type: string;
    user_id: string;
}

interface InstagramLongLivedToken {
    access_token: string;
    token_type: string;
    expires_in: number;
}

/**
 * Exchange authorization code for short-lived Instagram token.
 * Short-lived tokens expire in 1 hour; we immediately upgrade to long-lived.
 */
async function exchangeInstagramCode(
    code: string,
    redirectUri: string,
): Promise<InstagramShortLivedToken> {
    const params = new URLSearchParams({
        client_id:     metaAppId.value(),
        client_secret: metaAppSecret.value(),
        grant_type:    "authorization_code",
        redirect_uri:  redirectUri,
        code,
    });

    const res = await fetch("https://api.instagram.com/oauth/access_token", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    params.toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Instagram token exchange failed: ${err}`);
    }
    return res.json() as Promise<InstagramShortLivedToken>;
}

/**
 * Exchange a short-lived Instagram token for a long-lived token (valid 60 days).
 * Long-lived tokens can be refreshed before expiry via refreshInstagramLongLivedToken.
 */
async function getInstagramLongLivedToken(shortLivedToken: string): Promise<InstagramLongLivedToken> {
    const params = new URLSearchParams({
        grant_type:    "ig_exchange_token",
        client_secret: metaAppSecret.value(),
        access_token:  shortLivedToken,
    });

    const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);

    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Instagram long-lived token exchange failed: ${err}`);
    }
    return res.json() as Promise<InstagramLongLivedToken>;
}

/**
 * Refresh a long-lived Instagram token (must be done within 60 days of expiry).
 * Refreshed tokens are valid for another 60 days.
 */
async function refreshInstagramLongLivedToken(accessToken: string): Promise<InstagramLongLivedToken> {
    const params = new URLSearchParams({
        grant_type:   "ig_refresh_token",
        access_token: accessToken,
    });

    const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);

    if (!res.ok) {
        const err = await res.text();
        throw new functions.https.HttpsError("internal", `Instagram token refresh failed: ${err}`);
    }
    return res.json() as Promise<InstagramLongLivedToken>;
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function storeToken(uid: string, platform: string, token: StoredToken): Promise<void> {
    await tokenPath(uid, platform).set({
        ...token,
        platform,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
