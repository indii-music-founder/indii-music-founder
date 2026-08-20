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

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { randomUUID } from 'node:crypto';
import { validateAppCheckV2 } from "../middleware/appCheck";
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
const ANALYTICS_PLATFORMS = ['spotify', 'tiktok', 'instagram'] as const;
type AnalyticsPlatform = typeof ANALYTICS_PLATFORMS[number];

function parseAnalyticsPlatform(value: unknown): AnalyticsPlatform {
    if (typeof value === 'string' && ANALYTICS_PLATFORMS.includes(value as AnalyticsPlatform)) {
        return value as AnalyticsPlatform;
    }
    throw new HttpsError('invalid-argument', 'platform must be spotify, tiktok, or instagram.');
}

// ── Helper: make authenticated assertion ─────────────────────────────────────
function assertAuth(request: CallableRequest): string {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }
    return request.auth.uid;
}

// ─────────────────────────────────────────────────────────────────────────────
// analyticsExchangeToken
// Exchange an OAuth authorization code for access + refresh tokens.
// ─────────────────────────────────────────────────────────────────────────────

export const analyticsExchangeToken = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 30, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);
        const { platform, code, redirectUri, codeVerifier, facebookPageId } = (request.data ?? {}) as {
            platform: string;
            code: string;
            redirectUri: string;
            codeVerifier?: string;
            facebookPageId?: string;
        };

        if (!platform || !code || !redirectUri) {
            throw new HttpsError("invalid-argument", "platform, code, and redirectUri are required.");
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

        throw new HttpsError("invalid-argument", `Unsupported platform: ${platform}`);
    });

/** Finalize one short-lived server-only Meta Page selection without reusing an OAuth code. */
export const analyticsFinalizeInstagramConnection = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 15, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);
        const { intentId, facebookPageId } = (request.data ?? {}) as { intentId?: string; facebookPageId?: string };
        if (!isSafeIdentifier(intentId) || !isSafeIdentifier(facebookPageId)) {
            throw new HttpsError('invalid-argument', 'intentId and facebookPageId are required safe identifiers.');
        }
        const intent = await consumePendingInstagramIntent(uid, intentId);
        const page = Array.isArray(intent.pages) && intent.pages.find(candidate => candidate.facebookPageId === facebookPageId);
        if (!page || !intent.accessToken || !Number.isFinite(intent.tokenExpiresIn)) {
            throw new HttpsError('failed-precondition', 'The selected Facebook Page is not available for this Instagram connection.');
        }
        const connection = connectionFromPage(intent.accessToken, intent.tokenExpiresIn, page);
        await storeInstagramConnection(uid, connection);
        return instagramConnectionResponse(connection);
    });

/** Return connection metadata only; OAuth tokens never leave the backend. */
export const analyticsGetConnectionStatus = onCall(
    { enforceAppCheck: false, timeoutSeconds: 15, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);
        const platform = parseAnalyticsPlatform((request.data as { platform?: unknown } | undefined)?.platform);
        const snapshot = await tokenPath(uid, platform).get();
        if (!snapshot.exists) {
            return { platform, connected: false, authorized: false, liveSyncOk: false, cacheOnly: false };
        }
        const token = snapshot.data() as StoredToken;
        const expiresAt = typeof token.expiresAt === 'number' ? token.expiresAt : undefined;
        if (!token.accessToken || !expiresAt || expiresAt <= Date.now()) {
            return {
                platform,
                connected: false,
                authorized: false,
                liveSyncOk: false,
                cacheOnly: false,
                reason: token.accessToken ? 'authorization_expired' : 'missing_access_token',
                ...(expiresAt ? { expiresAt } : {}),
            };
        }
        return {
            platform,
            connected: true,
            authorized: true,
            liveSyncOk: false,
            cacheOnly: false,
            expiresAt,
            ...(typeof token.igUserId === 'string' ? { igUserId: token.igUserId } : {}),
            ...(typeof token.facebookPageId === 'string' ? { facebookPageId: token.facebookPageId } : {}),
            ...(typeof token.instagramUsername === 'string' ? { instagramUsername: token.instagramUsername } : {}),
        };
    });

/** Thorough connection health audit for Instagram connection & scope inspection. */
export const auditInstagramConnectionCallable = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 15, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);
        const snapshot = await tokenPath(uid, 'instagram').get();
        if (!snapshot.exists) {
            return {
                status: 'RECONNECT_REQUIRED',
                connected: false,
                permissions: [],
                missingPermissions: [
                    'instagram_basic',
                    'instagram_content_publish',
                    'instagram_manage_comments',
                    'instagram_manage_messages',
                    'pages_show_list',
                    'pages_read_engagement',
                ],
                lastCheckedAt: Date.now(),
            };
        }
        const token = snapshot.data() as StoredToken;
        const expiresAt = typeof token.expiresAt === 'number' ? token.expiresAt : undefined;
        const isExpired = !!expiresAt && expiresAt <= Date.now();

        const requiredScopes = [
            'instagram_basic',
            'instagram_content_publish',
            'instagram_manage_comments',
            'instagram_manage_messages',
            'pages_show_list',
            'pages_read_engagement',
        ];

        let activePermissions: string[] = Array.isArray(token.permissions) ? (token.permissions as string[]) : [];

        if (token.accessToken && !isExpired && activePermissions.length === 0) {
            try {
                const res = await fetch(`https://graph.facebook.com/v23.0/me/permissions?access_token=${encodeURIComponent(token.accessToken)}`);
                if (res.ok) {
                    const body = await res.json() as { data?: Array<{ permission?: string; status?: string }> };
                    activePermissions = (body.data ?? [])
                        .filter(p => p.status === 'granted' && p.permission)
                        .map(p => p.permission!);
                    // Update stored permissions array
                    await tokenPath(uid, 'instagram').set({ permissions: activePermissions }, { merge: true });
                }
            } catch (e) {
                logger.warn('[auditInstagramConnectionCallable] Permission check failed:', e);
            }
        }

        const missingPermissions = requiredScopes.filter(scope => !activePermissions.includes(scope));

        let status: 'HEALTHY' | 'RECONNECT_REQUIRED' | 'MISSING_PERMISSIONS' | 'EXPIRED' = 'HEALTHY';
        if (isExpired) status = 'EXPIRED';
        else if (missingPermissions.length > 0 && activePermissions.length > 0) status = 'MISSING_PERMISSIONS';
        else if (!token.accessToken) status = 'RECONNECT_REQUIRED';

        return {
            status,
            connected: status === 'HEALTHY' || status === 'MISSING_PERMISSIONS',
            igUserId: typeof token.igUserId === 'string' ? token.igUserId : undefined,
            facebookPageId: typeof token.facebookPageId === 'string' ? token.facebookPageId : undefined,
            instagramUsername: typeof token.instagramUsername === 'string' ? token.instagramUsername : undefined,
            permissions: activePermissions,
            missingPermissions,
            expiresAt,
            lastCheckedAt: Date.now(),
        };
    });

// ─────────────────────────────────────────────────────────────────────────────
// analyticsRefreshToken
// Refresh an expired access token using the stored refresh token.
// ─────────────────────────────────────────────────────────────────────────────

export const analyticsRefreshToken = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 30, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);
        const platform = parseAnalyticsPlatform((request.data as { platform?: unknown } | undefined)?.platform);

        const snap = await tokenPath(uid, platform).get();
        if (!snap.exists) {
            throw new HttpsError("not-found", `No token stored for platform: ${platform}`);
        }

        const stored = snap.data() as StoredToken;
        if (!stored.refreshToken) {
            throw new HttpsError("failed-precondition", "No refresh token available — user must re-authenticate.");
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
            throw new HttpsError(
                'failed-precondition',
                'Instagram Graph access requires reconnecting before the Facebook token expires.',
            );
        } else {
            throw new HttpsError('invalid-argument', 'Unsupported analytics platform.');
        }

        // The provider may rotate the refresh token. Two concurrent refreshes
        // (overlapping scheduled syncs + a user-triggered refresh) would both
        // read the old token; the loser's write could store an already-
        // invalidated credential last and permanently disconnect the account.
        // Compare-and-swap the rotated token inside a transaction: if another
        // refresh already rotated it while this call was in flight, keep the
        // newer stored token and only update the short-lived access token.
        const tokenRef = tokenPath(uid, platform);
        const refreshTokenWon = await admin.firestore().runTransaction(async (tx) => {
            const fresh = await tx.get(tokenRef);
            if (!fresh.exists) return false;
            const current = fresh.data() as StoredToken;
            const update: Record<string, unknown> = {
                accessToken: newAccess,
                expiresAt: newExpiry,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (current.refreshToken === stored.refreshToken) {
                update.refreshToken = newRefresh;
                tx.update(tokenRef, update);
                return true;
            }
            console.warn(`[analyticsRefreshToken] Concurrent refresh already rotated ${platform} tokens — keeping the newer stored refresh token.`);
            tx.update(tokenRef, update);
            return false;
        });

        // Mirror the same outcome to socialTokens (ISSUE-766 dual-write).
        // When another refresh won the rotation, the stored credential stays
        // authoritative — writing our stale token anywhere would break the
        // posting path too. Only the short-lived access token is refreshed
        // on both copies in that case.
        if (refreshTokenWon) {
            await storeToken(uid, platform, {
                ...stored,
                accessToken: newAccess,
                refreshToken: newRefresh,
                expiresAt: newExpiry,
            });
        } else {
            const postingPlatforms = ['instagram', 'tiktok', 'youtube'];
            if (postingPlatforms.includes(platform)) {
                await admin.firestore()
                    .collection('users')
                    .doc(uid)
                    .collection('socialTokens')
                    .doc(platform)
                    .set({
                        accessToken: newAccess,
                        expiresAt: newExpiry,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
            }
        }

        return { ok: true, accessToken: newAccess, expiresAt: newExpiry };
    });

// ─────────────────────────────────────────────────────────────────────────────
// analyticsRevokeToken
// Disconnect a platform — deletes stored tokens from Firestore.
// ─────────────────────────────────────────────────────────────────────────────

export const analyticsRevokeToken = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 15, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);
        const platform = parseAnalyticsPlatform((request.data as { platform?: unknown } | undefined)?.platform);

        // Best-effort revocation at the platform's API
        const snap = await tokenPath(uid, platform).get();
        if (snap.exists) {
            const stored = snap.data() as StoredToken;
            if (platform === "spotify" && stored.accessToken) {
                await revokeSpotifyToken(stored.accessToken).catch((err: unknown) => {
                    logger.warn(`[analyticsRevokeToken] Spotify token revocation failed for user ${uid}:`, err);
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

function metaConnectionError(error: MetaInstagramConnectionError): HttpsError {
    const status = error.code === 'META_TOKEN_EXCHANGE_FAILED' ? 'internal' : 'failed-precondition';
    return new HttpsError(status, error.message, {
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
        throw new HttpsError('not-found', 'Instagram Page selection has expired or was already used. Reconnect Instagram and try again.');
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
        throw new HttpsError("internal", `Spotify token exchange failed: ${err}`);
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
        throw new HttpsError("internal", `Spotify refresh failed: ${err}`);
    }
    return res.json() as Promise<SpotifyTokenResponse>;
}

async function revokeSpotifyToken(accessToken: string): Promise<void> {
    await fetch(`https://accounts.spotify.com/api/token`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
    }).catch((err: unknown) => {
        logger.warn('[revokeSpotifyToken] Network request failed for Spotify token deletion:', err);
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
        throw new HttpsError("internal", `TikTok token exchange failed: ${err}`);
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
        throw new HttpsError("internal", `TikTok refresh failed: ${err}`);
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
