/**
 * facebookAdsExecutor — Layer 3 (Execution)
 *
 * Deterministic, WRITE-ONLY bridge to the Meta Marketing API.
 *
 * ── Why write-only ──────────────────────────────────────────────────────────
 * Meta rate-limits and bans ad accounts that are polled aggressively for
 * insights. Read traffic (spend, clicks, conversions) is NOT this module's job:
 * it arrives through Airbyte -> ClickHouse and is served by
 * `campaignMetricsCallable`. This module only mutates ad state (publish a
 * creative, pause a loser) and is structurally prevented from doing anything
 * else — see `assertWriteEndpoint`, which rejects any path not on the
 * publish/pause allowlist, and `graphWrite`, which only ever issues POST.
 *
 * Layer 2 (the agent swarm) decides *what* to publish and *when* to pause.
 * This file decides nothing; it executes and writes an audit record.
 *
 * Token + Page ID come from the user's stored Meta connection
 * (`users/{uid}/analyticsTokens/instagram`, written by `platformTokenExchange`).
 * Neither is ever hardcoded — Meta mints and rotates both.
 */

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';

import { META_GRAPH_API_BASE } from '../analytics/instagramGraphConnection';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Firestore platform key holding the Meta connection.
 *
 * The Facebook Login flow in `platformTokenExchange` resolves one Meta identity
 * (long-lived user token + the selected Facebook Page) and stores it under the
 * `instagram` platform doc. Ads and Instagram publishing share that identity —
 * there is no separate "meta" doc to read.
 */
const META_PLATFORM_KEY = 'instagram';

/**
 * Graph endpoints this executor is permitted to touch. Every entry must be a
 * state-mutating write. Adding a read endpoint here is a policy violation —
 * analytics reads belong in the ClickHouse path.
 */
const WRITE_ENDPOINT_ALLOWLIST: readonly RegExp[] = [
    /^act_\d+\/adimages$/,    // upload creative image, returns a hash
    /^act_\d+\/advideos$/,    // upload creative video
    /^act_\d+\/adcreatives$/, // assemble the creative object
    /^\d+$/,                  // POST /{ad-id} — status mutations (pause/resume)
] as const;

/** Meta rejects writes on an expired token; fail fast with a reconnect hint. */
const TOKEN_EXPIRY_GRACE_MS = 60_000;

/**
 * `users/{uid}/settings/marketingSwarm`. The Swarm Command Center's Halt
 * button writes `isActive: false` here, and every spend-increasing write below
 * checks it first — that check is what makes the button a kill switch rather
 * than a browser-local boolean.
 */
const SWARM_SETTING_ID = 'marketingSwarm';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FacebookAdsErrorCode =
    | 'SWARM_HALTED'
    | 'META_NOT_CONNECTED'
    | 'META_TOKEN_EXPIRED'
    | 'META_PAGE_MISSING'
    | 'FORBIDDEN_ENDPOINT'
    | 'GRAPH_WRITE_FAILED'
    | 'ASSET_UPLOAD_FAILED';

export class FacebookAdsExecutorError extends Error {
    constructor(
        readonly code: FacebookAdsErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'FacebookAdsExecutorError';
    }
}

export interface AdCreativePayload {
    /** Internal creative name — shows in Ads Manager, not to fans. */
    name: string;
    /** Primary ad copy. */
    body: string;
    /** Publicly reachable image URL. Meta fetches it server-side. */
    imageUrl?: string;
    /** Publicly reachable video URL. Meta fetches it server-side. */
    videoUrl?: string;
    /** Destination the ad clicks through to (smart link, store, pre-save). */
    linkUrl: string;
}

export type PushAdCreativeResult =
    | { success: true; creativeId: string }
    | { success: false; code: FacebookAdsErrorCode; error: string };

export type PauseAdResult =
    | { success: true; adId: string }
    | { success: false; code: FacebookAdsErrorCode; error: string };

interface MetaConnection {
    accessToken: string;
    facebookPageId: string;
}

interface StoredMetaToken {
    accessToken?: unknown;
    expiresAt?: unknown;
    facebookPageId?: unknown;
}

interface GraphImageUploadResponse {
    images?: Record<string, { hash?: string }>;
}

interface GraphCreativeResponse {
    id?: string;
}

interface GraphErrorResponse {
    error?: { message?: string; type?: string; code?: number };
}

/**
 * Injectable for tests. Defaults to global fetch (Node 22 runtime).
 */
export type GraphFetch = (url: string, init: RequestInit) => Promise<Response>;

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function db(): admin.firestore.Firestore {
    return admin.firestore();
}

/**
 * Structurally enforces the write-only contract. Called on every request.
 */
function assertWriteEndpoint(path: string): void {
    const normalized = path.replace(/^\/+/, '');
    if (!WRITE_ENDPOINT_ALLOWLIST.some(pattern => pattern.test(normalized))) {
        throw new FacebookAdsExecutorError(
            'FORBIDDEN_ENDPOINT',
            `Refusing Graph call to "${normalized}". This executor is write-only; ` +
            `read analytics through the ClickHouse pipeline instead.`,
        );
    }
}

/**
 * Refuses spend-increasing writes while the artist has the swarm halted.
 *
 * Fails closed on a read error: if we cannot prove the swarm is allowed to
 * spend, it does not spend. An unset document means never configured, which
 * is the enabled default.
 */
async function assertSwarmActive(userId: string): Promise<void> {
    let isActive: unknown;
    try {
        const snapshot = await db()
            .collection('users').doc(userId)
            .collection('settings').doc(SWARM_SETTING_ID)
            .get();
        isActive = snapshot.exists ? snapshot.data()?.isActive : true;
    } catch (error) {
        logger.error('[facebookAdsExecutor] Halt-state read failed; refusing to spend', {
            userId, error: error instanceof Error ? error.message : String(error),
        });
        throw new FacebookAdsExecutorError(
            'SWARM_HALTED',
            'Could not confirm the swarm is active, so no ad was published.',
        );
    }

    if (isActive === false) {
        throw new FacebookAdsExecutorError(
            'SWARM_HALTED',
            'The marketing swarm is halted. Reactivate it to publish ads.',
        );
    }
}

/**
 * Loads the caller's Meta credentials. Throws rather than returning a partial
 * connection — a write with a missing Page ID would silently post to nothing.
 */
async function loadMetaConnection(userId: string): Promise<MetaConnection> {
    const snapshot = await db()
        .collection('users').doc(userId)
        .collection('analyticsTokens').doc(META_PLATFORM_KEY)
        .get();

    if (!snapshot.exists) {
        throw new FacebookAdsExecutorError(
            'META_NOT_CONNECTED',
            'No Meta account connected. Connect Facebook/Instagram in Settings first.',
        );
    }

    const data = (snapshot.data() ?? {}) as StoredMetaToken;
    const accessToken = typeof data.accessToken === 'string' ? data.accessToken : '';
    const facebookPageId = typeof data.facebookPageId === 'string' ? data.facebookPageId : '';
    const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : null;

    if (!accessToken) {
        throw new FacebookAdsExecutorError(
            'META_NOT_CONNECTED',
            'Stored Meta connection has no access token. Reconnect the account.',
        );
    }
    if (expiresAt !== null && expiresAt - TOKEN_EXPIRY_GRACE_MS <= Date.now()) {
        throw new FacebookAdsExecutorError(
            'META_TOKEN_EXPIRED',
            'The Meta access token has expired. Reconnect the account to resume ad delivery.',
        );
    }
    if (!facebookPageId) {
        throw new FacebookAdsExecutorError(
            'META_PAGE_MISSING',
            'The Meta connection has no Facebook Page. Reconnect and select the Page to advertise from.',
        );
    }

    return { accessToken, facebookPageId };
}

/**
 * Single choke point for Graph traffic. POST only, allowlisted paths only.
 * The access token travels in the body, never the query string, so it cannot
 * leak into proxy or gateway access logs.
 */
async function graphWrite<T>(
    path: string,
    accessToken: string,
    params: Record<string, string>,
    fetcher: GraphFetch,
): Promise<T> {
    assertWriteEndpoint(path);

    const body = new URLSearchParams({ ...params, access_token: accessToken });
    const response = await fetcher(`${META_GRAPH_API_BASE}/${path.replace(/^\/+/, '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    const raw: unknown = await response.json().catch(() => ({}));

    if (!response.ok) {
        const graphError = (raw as GraphErrorResponse).error;
        throw new FacebookAdsExecutorError(
            'GRAPH_WRITE_FAILED',
            graphError?.message
                ? `Meta rejected the write: ${graphError.message}`
                : `Meta rejected the write with HTTP ${response.status}.`,
        );
    }

    return raw as T;
}

/**
 * Uploads the creative image and returns Meta's content hash.
 * Meta keys uploaded images by filename, so the hash is read positionally.
 */
async function uploadImage(
    adAccountId: string,
    imageUrl: string,
    accessToken: string,
    fetcher: GraphFetch,
): Promise<string> {
    const uploaded = await graphWrite<GraphImageUploadResponse>(
        `act_${adAccountId}/adimages`,
        accessToken,
        { url: imageUrl },
        fetcher,
    );

    const firstImage = Object.values(uploaded.images ?? {})[0];
    if (!firstImage?.hash) {
        throw new FacebookAdsExecutorError(
            'ASSET_UPLOAD_FAILED',
            'Meta accepted the image upload but returned no image hash.',
        );
    }
    return firstImage.hash;
}

function errorToResult(error: unknown): { code: FacebookAdsErrorCode; error: string } {
    if (error instanceof FacebookAdsExecutorError) {
        return { code: error.code, error: error.message };
    }
    return {
        code: 'GRAPH_WRITE_FAILED',
        error: error instanceof Error ? error.message : 'Unknown Meta execution failure.',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit trail
// ─────────────────────────────────────────────────────────────────────────────

export type MarketingAgentAction =
    | 'launched_ad'
    | 'paused_ad'
    | 'generated_creative'
    | 'vision_qc_failed';

/**
 * Writes one action to both audit surfaces:
 *   - `timelineExecutionLogs`            — global, server-only audit trail
 *   - `users/{uid}/marketingAgentLogs`   — the owner-readable feed the Swarm
 *                                          Command Center subscribes to
 *
 * Best-effort: an audit failure must never roll back a successful ad write,
 * because the ad is already live on Meta at that point.
 */
export async function recordAgentAction(input: {
    userId: string;
    agentName: string;
    actionType: MarketingAgentAction;
    message: string;
    status: 'success' | 'pending' | 'failed';
    metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
    const { userId, agentName, actionType, message, status, metadata = {} } = input;
    const executedAt = admin.firestore.FieldValue.serverTimestamp();

    try {
        await Promise.all([
            db().collection('timelineExecutionLogs').add({
                userId,
                agentId: agentName,
                type: 'marketing_swarm',
                action: actionType,
                instruction: message,
                metadata,
                status: status === 'success' ? 'completed' : status,
                executedAt,
            }),
            db().collection('users').doc(userId).collection('marketingAgentLogs').add({
                agentName,
                actionType,
                message,
                status,
                metadata,
                timestamp: new Date().toISOString(),
                createdAt: executedAt,
            }),
        ]);
    } catch (error) {
        logger.error('[facebookAdsExecutor] Audit write failed', {
            userId, actionType, error: error instanceof Error ? error.message : String(error),
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — writes only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publishes an ad creative to the user's Meta ad account.
 *
 * Two Graph writes: upload the asset, then assemble the creative around it.
 * Both are audited. Returns a discriminated result instead of throwing, so the
 * orchestration layer can decide whether to retry or surface to the artist.
 */
export async function pushAdCreative(
    userId: string,
    adAccountId: string,
    payload: AdCreativePayload,
    fetcher: GraphFetch = fetch,
): Promise<PushAdCreativeResult> {
    try {
        if (!payload.imageUrl && !payload.videoUrl) {
            throw new FacebookAdsExecutorError(
                'ASSET_UPLOAD_FAILED',
                'An ad creative needs either an image or a video.',
            );
        }

        // Halt check precedes every Graph write. Pausing is exempt (see pauseAd):
        // a halted swarm must still be able to stop ads that are already live.
        await assertSwarmActive(userId);

        const { accessToken, facebookPageId } = await loadMetaConnection(userId);

        const imageHash = payload.imageUrl
            ? await uploadImage(adAccountId, payload.imageUrl, accessToken, fetcher)
            : undefined;

        const creative = await graphWrite<GraphCreativeResponse>(
            `act_${adAccountId}/adcreatives`,
            accessToken,
            {
                name: payload.name,
                object_story_spec: JSON.stringify({
                    page_id: facebookPageId,
                    link_data: {
                        ...(imageHash ? { image_hash: imageHash } : {}),
                        link: payload.linkUrl,
                        message: payload.body,
                    },
                }),
            },
            fetcher,
        );

        if (!creative.id) {
            throw new FacebookAdsExecutorError(
                'GRAPH_WRITE_FAILED',
                'Meta accepted the creative but returned no creative ID.',
            );
        }

        await recordAgentAction({
            userId,
            agentName: 'Media Buyer',
            actionType: 'launched_ad',
            message: `Published ad creative "${payload.name}" to Meta.`,
            status: 'success',
            metadata: { creativeId: creative.id, adAccountId },
        });

        return { success: true, creativeId: creative.id };
    } catch (error) {
        const failure = errorToResult(error);
        logger.error('[facebookAdsExecutor] pushAdCreative failed', { userId, ...failure });

        await recordAgentAction({
            userId,
            agentName: 'Media Buyer',
            actionType: 'launched_ad',
            message: `Failed to publish "${payload.name}": ${failure.error}`,
            status: 'failed',
            metadata: { adAccountId, code: failure.code },
        });

        return { success: false, ...failure };
    }
}

/**
 * Pauses a running ad — the swarm's response to a creative whose CPA has run
 * past the campaign's bound. Pausing is a write, so it belongs here.
 *
 * Deliberately not gated on `assertSwarmActive`: pausing only ever reduces
 * spend, and refusing it while the swarm is halted would strand live ads
 * exactly when the artist has asked everything to stop.
 */
export async function pauseAd(
    userId: string,
    adId: string,
    reason: string,
    fetcher: GraphFetch = fetch,
): Promise<PauseAdResult> {
    try {
        const { accessToken } = await loadMetaConnection(userId);

        await graphWrite<Record<string, unknown>>(adId, accessToken, { status: 'PAUSED' }, fetcher);

        await recordAgentAction({
            userId,
            agentName: 'Media Buyer',
            actionType: 'paused_ad',
            message: `Paused ad ${adId}. ${reason}`,
            status: 'success',
            metadata: { adId },
        });

        return { success: true, adId };
    } catch (error) {
        const failure = errorToResult(error);
        logger.error('[facebookAdsExecutor] pauseAd failed', { userId, adId, ...failure });

        await recordAgentAction({
            userId,
            agentName: 'Media Buyer',
            actionType: 'paused_ad',
            message: `Failed to pause ad ${adId}: ${failure.error}`,
            status: 'failed',
            metadata: { adId, code: failure.code },
        });

        return { success: false, ...failure };
    }
}
