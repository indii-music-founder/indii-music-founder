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
import { randomUUID } from 'node:crypto';
import { validateAppCheckV1 } from "../middleware/appCheck";
import {
    spotifyClientId,
    spotifyClientSecret,
    tiktokClientKey,
    tiktokClientSecret,
    metaAppId,
    metaAppSecret,
} from "../config/secrets";
import {
    MetaInstagramConnectionError,
    type FacebookInstagramConnection,
    type InstagramPageOption,
    resolveFacebookInstagramConnection,
} from './instagramGraphConnection';

// ── Secrets (imported from centralized config/secrets.ts) ─────────────────────
const ALL_SECRETS = [
    spotifyClientId, spotifyClientSecret,
    tiktokClientKey, tiktokClientSecret,
    metaAppId, metaAppSecret,
];

// ── Firestore collection path ─────────────────────────────────────────────────
const tokenPath = (uid: string, platform: string) =>
    admin.firestore().collection("users").doc(uid).collection("analyticsTokens").doc(platform);
const pendingInstagramIntentPath = (uid: string, intentId: string) =>
    admin.firestore().collection('users').doc(uid).collection('serverSocialConnectionIntents').doc(intentId);
const PENDING_INSTAGRAM_INTENT_TTL_MS = 10 * 60 * 1000;

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
    .runWith({ enforceAppCheck: false,  secrets: ALL_SECRETS, timeoutSeconds: 30  })
    .https.onCall(async (data: unknown, context) => {
        validateAppCheckV1(context);
        const uid = assertAuth(context);
        const { platform, code, redirectUri, codeVerifier, facebookPageId } = data as {
            platform: string;
            code: string;
            redirectUri: string;
            codeVerifier?: string;
            facebookPageId?: string;
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
            let resolution;
            try {
                resolution = await resolveFacebookInstagramConnection({
                    code,
                    redirectUri,
                    appId: metaAppId.value(),
                    appSecret: metaAppSecret.value(),
                });
            } catch (error) {
                if (error instanceof MetaInstagramConnectionError) throw metaConnectionError(error);
                throw error;
            }
            if (!facebookPageId && resolution.pages.length > 1) {
                const intentId = await createPendingInstagramIntent(uid, resolution.accessToken, resolution.expiresIn, resolution.pages);
                return { ok: true, requiresPageSelection: true, intentId, pages: resolution.pages };
            }
            const selectedPage = facebookPageId
                ? resolution.pages.find(page => page.facebookPageId === facebookPageId)
                : resolution.pages[0];
            if (!selectedPage) {
                throw metaConnectionError(new MetaInstagramConnectionError(
                    'INVALID_FACEBOOK_PAGE_SELECTION',
                    'The selected Facebook Page is not linked to an authorized Instagram professional account.',
                    resolution.pages,
                ));
            }
            const connection = connectionFromPage(resolution.accessToken, resolution.expiresIn, selectedPage);
            await storeInstagramConnection(uid, connection);
            return instagramConnectionResponse(connection);
        }

        throw new functions.https.HttpsError("invalid-argument", `Unsupported platform: ${platform}`);
    });

/** Finalize one short-lived server-only Meta Page selection without reusing an OAuth code. */
export const analyticsFinalizeInstagramConnection = functions
    .runWith({ enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 15 })
    .https.onCall(async (data: unknown, context) => {
        validateAppCheckV1(context);
        const uid = assertAuth(context);
        const { intentId, facebookPageId } = data as { intentId?: string; facebookPageId?: string };
        if (!isSafeIdentifier(intentId) || !isSafeIdentifier(facebookPageId)) {
            throw new functions.https.HttpsError('invalid-argument', 'intentId and facebookPageId are required safe identifiers.');
        }
        const intent = await consumePendingInstagramIntent(uid, intentId);
        const page = Array.isArray(intent.pages) && intent.pages.find(candidate => candidate.facebookPageId === facebookPageId);
        if (!page || !intent.accessToken || !Number.isFinite(intent.tokenExpiresIn)) {
            throw new functions.https.HttpsError('failed-precondition', 'The selected Facebook Page is not available for this Instagram connection.');
        }
        const connection = connectionFromPage(intent.accessToken, intent.tokenExpiresIn, page);
        await storeInstagramConnection(uid, connection);
        return instagramConnectionResponse(connection);
    });

/** Return connection metadata only; OAuth tokens never leave the backend. */
export const analyticsGetConnectionStatus = functions
    .runWith({ enforceAppCheck: false, timeoutSeconds: 15 })
    .https.onCall(async (data: unknown, context) => {
        validateAppCheckV1(context);
        const uid = assertAuth(context);
        const platform = (data as { platform?: unknown }).platform;
        if (platform !== 'instagram') {
            throw new functions.https.HttpsError('invalid-argument', 'Only Instagram connection status is available from this endpoint.');
        }
        const snapshot = await tokenPath(uid, platform).get();
        if (!snapshot.exists) return { connected: false };
        const token = snapshot.data() as StoredToken;
        const expiresAt = typeof token.expiresAt === 'number' ? token.expiresAt : undefined;
        if (!token.accessToken || !expiresAt || expiresAt <= Date.now()) {
            return { connected: false, ...(expiresAt ? { expiresAt } : {}) };
        }
        return {
            connected: true,
            expiresAt,
            ...(typeof token.igUserId === 'string' ? { igUserId: token.igUserId } : {}),
            ...(typeof token.facebookPageId === 'string' ? { facebookPageId: token.facebookPageId } : {}),
            ...(typeof token.instagramUsername === 'string' ? { instagramUsername: token.instagramUsername } : {}),
        };
    });

// ─────────────────────────────────────────────────────────────────────────────
// analyticsRefreshToken
// Refresh an expired access token using the stored refresh token.
// ─────────────────────────────────────────────────────────────────────────────

export const analyticsRefreshToken = functions
    .runWith({ enforceAppCheck: false,  secrets: ALL_SECRETS, timeoutSeconds: 30  })
    .https.onCall(async (data: unknown, context) => {
        validateAppCheckV1(context);
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
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Instagram Graph access requires reconnecting before the Facebook token expires.',
            );
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
    .runWith({ enforceAppCheck: false,  secrets: ALL_SECRETS, timeoutSeconds: 15  })
    .https.onCall(async (data: unknown, context) => {
        validateAppCheckV1(context);
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
                await revokeSpotifyToken(stored.accessToken).catch((err: unknown) => {
                    functions.logger.warn(`[analyticsRevokeToken] Spotify token revocation failed for user ${uid}:`, err);
                });
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

interface PendingInstagramIntent {
    platform: 'instagram';
    accessToken: string;
    tokenExpiresIn: number;
    pages: InstagramPageOption[];
    expiresAt: admin.firestore.Timestamp;
}

function isSafeIdentifier(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function metaConnectionError(error: MetaInstagramConnectionError): functions.https.HttpsError {
    const status = error.code === 'META_TOKEN_EXCHANGE_FAILED' ? 'internal' : 'failed-precondition';
    return new functions.https.HttpsError(status, error.message, {
        code: error.code,
        pages: error.pages,
    });
}

async function createPendingInstagramIntent(
    uid: string,
    accessToken: string,
    tokenExpiresIn: number,
    pages: InstagramPageOption[],
): Promise<string> {
    const intentId = randomUUID();
    await pendingInstagramIntentPath(uid, intentId).create({
        platform: 'instagram',
        accessToken,
        tokenExpiresIn,
        pages,
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + PENDING_INSTAGRAM_INTENT_TTL_MS),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return intentId;
}

async function consumePendingInstagramIntent(uid: string, intentId: string): Promise<PendingInstagramIntent> {
    const intentRef = pendingInstagramIntentPath(uid, intentId);
    const intent = await admin.firestore().runTransaction(async transaction => {
        const snapshot = await transaction.get(intentRef);
        if (!snapshot.exists) return undefined;
        const candidate = snapshot.data() as PendingInstagramIntent;
        if (candidate.platform !== 'instagram' || !candidate.expiresAt || candidate.expiresAt.toMillis() <= Date.now()) {
            transaction.delete(intentRef);
            return undefined;
        }
        transaction.delete(intentRef);
        return candidate;
    });
    if (!intent) {
        throw new functions.https.HttpsError('not-found', 'Instagram Page selection has expired or was already used. Reconnect Instagram and try again.');
    }
    return intent;
}

function connectionFromPage(
    accessToken: string,
    expiresIn: number,
    page: InstagramPageOption,
): FacebookInstagramConnection {
    return {
        accessToken,
        expiresIn,
        facebookPageId: page.facebookPageId,
        igUserId: page.instagramBusinessAccountId,
        ...(page.instagramUsername ? { instagramUsername: page.instagramUsername } : {}),
    };
}

async function storeInstagramConnection(uid: string, connection: FacebookInstagramConnection): Promise<void> {
    await storeToken(uid, 'instagram', {
        accessToken: connection.accessToken,
        expiresAt: Date.now() + connection.expiresIn * 1000,
        igUserId: connection.igUserId,
        facebookPageId: connection.facebookPageId,
        ...(connection.instagramUsername ? { instagramUsername: connection.instagramUsername } : {}),
    });
}

function instagramConnectionResponse(connection: FacebookInstagramConnection) {
    return {
        ok: true,
        expiresIn: connection.expiresIn,
        facebookPageId: connection.facebookPageId,
        ...(connection.instagramUsername ? { instagramUsername: connection.instagramUsername } : {}),
    };
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
    }).catch((err: unknown) => {
        functions.logger.warn('[revokeSpotifyToken] Network request failed for Spotify token deletion:', err);
    });
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

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function storeToken(uid: string, platform: string, token: StoredToken): Promise<void> {
    const tokenData = {
        ...token,
        platform,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await tokenPath(uid, platform).set(tokenData, { merge: true });

    // Dual-write to socialTokens for platforms that support posting (ISSUE-766 Layer 1 fix)
    const postingPlatforms = ['instagram', 'tiktok', 'youtube'];
    if (postingPlatforms.includes(platform)) {
        const socialTokenPath = admin.firestore()
            .collection('users')
            .doc(uid)
            .collection('socialTokens')
            .doc(platform);
        await socialTokenPath.set(tokenData, { merge: true });
    }
}
