/**
 * Firebase Cloud Function: Deliver Scheduled Social Posts
 *
 * Runs every 5 minutes via Cloud Scheduler to find posts whose
 * `scheduledAt` timestamp has passed and deliver them to the
 * appropriate social platform via the platform API.
 *
 * Item 226: Scheduled Post Background Delivery.
 *
 * Architecture:
 * - Queries Firestore `scheduledPosts` collection for documents with
 *   status='pending' and scheduledAt <= now
 * - For each post, calls the appropriate platform API with the stored token
 * - Updates the document status to 'delivered' or 'failed'
 * - Implements idempotency: marks posts as 'delivering' before processing
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

type SocialPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube';

interface ScheduledPostDoc {
    userId: string;
    platform: SocialPlatform;
    text?: string;
    mediaUrl?: string;
    mediaType?: 'video' | 'image';
    hashtags?: string[];
    title?: string;
    description?: string;
    scheduledAt: Timestamp;
    status: 'pending' | 'delivering' | 'delivered' | 'failed';
    igUserId?: string;
    retryCount?: number;
    nextRetryAt?: Timestamp;
    deliveryStartedAt?: Timestamp;
    campaignId?: string;
    campaignPostId?: string;
    source?: string;
}

interface PlatformToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    igUserId?: string;
}

interface DeliveryResult {
    success: boolean;
    postId?: string;
    error?: string;
    terminal?: boolean;
}

const MAX_DELIVERY_ATTEMPTS = 3;
const STALE_DELIVERY_MINUTES = 10;

function validDeliveredPostId(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function requireDeliveredPostId(platform: string, value: unknown): DeliveryResult {
    return validDeliveredPostId(value)
        ? { success: true, postId: value }
        : { success: false, error: `${platform} accepted the request without returning a post ID` };
}

async function getTokenForUser(
    db: ReturnType<typeof getFirestore>,
    userId: string,
    platform: SocialPlatform
): Promise<PlatformToken | null> {
    try {
        const snap = await db.collection('users').doc(userId).collection('socialTokens').doc(platform).get();
        return snap.exists ? (snap.data() as PlatformToken) : null;
    } catch (err) {
        logger.warn(`[getTokenForUser] Failed to fetch social token for user ${userId} on ${platform}:`, err);
        return null;
    }
}

async function deliverToTwitter(token: PlatformToken, text: string): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
        const res = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return { success: false, error: `Twitter ${res.status}` };
        const data = await res.json() as { data?: { id: string } };
        return requireDeliveredPostId('Twitter', data.data?.id);
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

async function deliverToInstagram(token: PlatformToken, post: ScheduledPostDoc): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!token.igUserId) return { success: false, error: 'Missing Instagram user ID' };
    const base = 'https://graph.facebook.com/v20.0';
    const caption = [post.text, post.hashtags?.map(h => `#${h.replace('#', '')}`).join(' ')].filter(Boolean).join('\n\n');

    try {
        const params = new URLSearchParams({ access_token: token.accessToken, caption });
        if (post.mediaType === 'video' && post.mediaUrl) {
            params.set('media_type', 'REELS');
            params.set('video_url', post.mediaUrl);
        } else if (post.mediaUrl) {
            params.set('image_url', post.mediaUrl);
        }

        const createRes = await fetch(`${base}/${token.igUserId}/media?${params}`, { method: 'POST', signal: AbortSignal.timeout(30000) });
        if (!createRes.ok) return { success: false, error: `IG container ${createRes.status}` };
        const { id } = await createRes.json() as { id?: string };
        if (!validDeliveredPostId(id)) {
            return { success: false, error: 'Instagram created no publishable media container ID' };
        }

        const publishRes = await fetch(`${base}/${token.igUserId}/media_publish`, {
            method: 'POST',
            body: new URLSearchParams({ creation_id: id, access_token: token.accessToken }),
            signal: AbortSignal.timeout(15000),
        });
        if (!publishRes.ok) return { success: false, error: `IG publish ${publishRes.status}` };
        const { id: postId } = await publishRes.json() as { id?: string };
        return requireDeliveredPostId('Instagram', postId);
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

type DeliveryDatabase = ReturnType<typeof getFirestore>;
type DeliveryDocumentReference = FirebaseFirestore.DocumentReference;

function timestampMillis(value: unknown): number | null {
    if (!value || typeof value !== 'object') return null;
    if ('toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
        return (value as { toMillis: () => number }).toMillis();
    }
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().getTime();
    }
    return null;
}

function campaignPostStatus(delivered: boolean, terminalFailure: boolean): 'EXECUTING' | 'DONE' | 'FAILED' {
    if (delivered) return 'DONE';
    return terminalFailure ? 'FAILED' : 'EXECUTING';
}

async function persistDeliveryOutcome(
    db: DeliveryDatabase,
    postRef: DeliveryDocumentReference,
    post: ScheduledPostDoc,
    result: DeliveryResult,
    now: Timestamp,
    forceTerminalFailure = false,
    deliveryStartedBefore?: number,
): Promise<boolean> {
    const delivered = result.success && validDeliveredPostId(result.postId);
    const retryCount = delivered
        ? (post.retryCount ?? 0)
        : forceTerminalFailure || result.terminal
            ? MAX_DELIVERY_ATTEMPTS
            : (post.retryCount ?? 0) + 1;
    const terminalFailure = !delivered && retryCount >= MAX_DELIVERY_ATTEMPTS;
    const nextRetryAt = new Timestamp(
        Math.floor((now.toMillis() + Math.pow(2, retryCount) * 60_000) / 1000),
        0,
    );
    const deliveryError = result.error || 'The platform did not confirm delivery.';
    const queueUpdate = delivered ? {
        status: 'delivered',
        platformPostId: result.postId,
        deliveryError: FieldValue.delete(),
        nextRetryAt: FieldValue.delete(),
        deliveryStartedAt: FieldValue.delete(),
        failedAt: FieldValue.delete(),
        deliveredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    } : {
        status: 'failed',
        platformPostId: null,
        deliveryError,
        retryCount,
        nextRetryAt: terminalFailure ? FieldValue.delete() : nextRetryAt,
        deliveryStartedAt: FieldValue.delete(),
        deliveredAt: FieldValue.delete(),
        failedAt: terminalFailure ? FieldValue.serverTimestamp() : FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    return db.runTransaction(async transaction => {
        const queueSnapshot = await transaction.get(postRef);
        if (!queueSnapshot.exists) return false;
        const currentQueue = queueSnapshot.data() as ScheduledPostDoc;
        if (currentQueue.status !== 'delivering') return false;
        if (deliveryStartedBefore !== undefined) {
            const currentStartedAt = timestampMillis(currentQueue.deliveryStartedAt);
            if (currentStartedAt === null || currentStartedAt > deliveryStartedBefore) return false;
        }

        const campaignRef = post.campaignId
            ? db.collection('campaigns').doc(post.campaignId)
            : null;
        const campaignSnapshot = campaignRef ? await transaction.get(campaignRef) : null;

        transaction.update(postRef, queueUpdate);

        if (!campaignRef || !campaignSnapshot?.exists || !post.campaignPostId) return true;

        const campaign = campaignSnapshot.data();
        if (campaign?.userId !== post.userId) {
            logger.error(`[deliverScheduledPosts] Refusing cross-owner campaign update for queue ${postRef.id}.`);
            return true;
        }
        const campaignPosts = Array.isArray(campaign?.posts) ? campaign.posts : [];
        let matched = false;
        const visiblePostStatus = campaignPostStatus(delivered, terminalFailure);
        const visiblePosts = campaignPosts.map((campaignPost: unknown) => {
            if (!campaignPost || typeof campaignPost !== 'object') return campaignPost;
            const typedPost = campaignPost as Record<string, unknown>;
            if (typedPost.id !== post.campaignPostId) return campaignPost;
            matched = true;
            const nextPost: Record<string, unknown> = {
                ...typedPost,
                postId: postRef.id,
                status: visiblePostStatus,
            };
            if (delivered) delete nextPost.errorMessage;
            else nextPost.errorMessage = terminalFailure
                ? deliveryError
                : `Retry scheduled: ${deliveryError}`;
            return nextPost;
        });

        if (!matched) {
            logger.error(`[deliverScheduledPosts] Campaign ${post.campaignId} has no post ${post.campaignPostId}; queue state remains authoritative.`);
            return true;
        }

        const visibleStatuses = visiblePosts.map((campaignPost: unknown) => (
            campaignPost && typeof campaignPost === 'object'
                ? (campaignPost as { status?: unknown }).status
                : undefined
        ));
        const visibleCampaignStatus = visibleStatuses.length > 0 && visibleStatuses.every(status => status === 'DONE')
            ? 'DONE'
            : visibleStatuses.some(status => status === 'FAILED')
                ? 'FAILED'
                : 'EXECUTING';

        transaction.update(campaignRef, {
            posts: visiblePosts,
            status: visibleCampaignStatus,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
    });
}

async function deliverPost(post: ScheduledPostDoc, token: PlatformToken, postId: string): Promise<DeliveryResult> {
    switch (post.platform) {
        case 'twitter':
            return deliverToTwitter(token, post.text || '');
        case 'instagram':
            return deliverToInstagram(token, post);
        case 'tiktok':
            return {
                success: false,
                terminal: true,
                error: 'TikTok posting is unavailable until creator consent, video.publish OAuth, and asynchronous publish-status verification are connected.',
            };
        case 'youtube':
            return {
                success: false,
                terminal: true,
                error: 'YouTube posting is unavailable until a youtube.upload OAuth connection is connected.',
            };
        default: {
            const unsupportedPlatform = (post as { platform: string }).platform;
            logger.warn(`[deliverScheduledPosts] Unsupported platform encountered: ${unsupportedPlatform} for post ${postId}`);
            return { success: false, error: `Unsupported social platform: ${unsupportedPlatform}` };
        }
    }
}

export interface ScheduledDeliveryDependencies {
    db?: DeliveryDatabase;
    now?: Timestamp;
    getToken?: typeof getTokenForUser;
    dispatch?: typeof deliverPost;
}

/**
 * Production scheduled-delivery handler. Exported so regression tests can
 * exercise the same query, claim, persistence, and aggregate-state path used
 * by Cloud Scheduler without invoking the scheduler wrapper itself.
 */
export async function deliverScheduledPostsHandler(
    dependencies: ScheduledDeliveryDependencies = {},
): Promise<void> {
    const db = dependencies.db ?? getFirestore();
    const now = dependencies.now ?? Timestamp.now();
    const getToken = dependencies.getToken ?? getTokenForUser;
    const dispatch = dependencies.dispatch ?? deliverPost;
    const staleCutoff = Timestamp.fromMillis(now.toMillis() - STALE_DELIVERY_MINUTES * 60_000);

    try {
        const [pendingSnap, retrySnap, staleSnap] = await Promise.all([
            db.collection('scheduledPosts')
                .where('status', '==', 'pending')
                .where('scheduledAt', '<=', now)
                .limit(20)
                .get(),
            // Keep a single range field in the Firestore query; terminal
            // retryCount filtering is enforced again during the claim.
            db.collection('scheduledPosts')
                .where('status', '==', 'failed')
                .where('nextRetryAt', '<=', now)
                .limit(30)
                .get(),
            db.collection('scheduledPosts')
                .where('status', '==', 'delivering')
                .where('deliveryStartedAt', '<=', staleCutoff)
                .limit(20)
                .get(),
        ]);

        const processingErrors: Error[] = [];
        let resolvedStaleClaims = 0;

        // A process crash after a platform accepted a post but before the
        // receipt persisted is ambiguous. Do not auto-redeliver and risk a
        // duplicate public post; fail it visibly for manual review.
        for (const staleDocument of staleSnap.docs) {
            try {
                const stalePost = staleDocument.data() as ScheduledPostDoc;
                const persisted = await persistDeliveryOutcome(
                    db,
                    staleDocument.ref,
                    stalePost,
                    { success: false, error: 'Delivery outcome is unknown after the worker stopped; manual review is required before retrying.' },
                    now,
                    true,
                    staleCutoff.toMillis(),
                );
                if (persisted) resolvedStaleClaims += 1;
            } catch (error) {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                processingErrors.push(normalizedError);
                logger.error({
                    message: `[deliverScheduledPosts] Stale post ${staleDocument.id} could not be finalized`,
                    errorCode: 'STALE_DELIVERY_FAILED',
                    detail: normalizedError.message,
                });
            }
        }

        const allDocs = [...pendingSnap.docs, ...retrySnap.docs];
        if (allDocs.length === 0) {
            logger.info(`[deliverScheduledPosts] No due posts. Resolved ${resolvedStaleClaims} stale delivery claim(s).`);
            if (processingErrors.length > 0) {
                const failureSummary = processingErrors.map(error => error.message).join('; ');
                throw new Error(`${processingErrors.length} scheduled post(s) could not be finalized: ${failureSummary}`);
            }
            return;
        }

        logger.info(`[deliverScheduledPosts] Processing ${pendingSnap.size} pending + ${retrySnap.size} retry posts; ${resolvedStaleClaims} stale claim(s) resolved.`);

        for (const docSnap of allDocs) {
            try {
                const postRef = docSnap.ref;
                const claimedPost = await db.runTransaction(async transaction => {
                    const fresh = await transaction.get(postRef);
                    if (!fresh.exists) return null;
                    const freshPost = fresh.data() as ScheduledPostDoc;
                    const scheduledAt = timestampMillis(freshPost.scheduledAt);
                    const nextRetryAt = timestampMillis(freshPost.nextRetryAt);
                    const canClaimPending = freshPost.status === 'pending'
                        && scheduledAt !== null
                        && scheduledAt <= now.toMillis();
                    const canClaimRetry = freshPost.status === 'failed'
                        && (freshPost.retryCount ?? 0) < MAX_DELIVERY_ATTEMPTS
                        && nextRetryAt !== null
                        && nextRetryAt <= now.toMillis();
                    if (!canClaimPending && !canClaimRetry) return null;

                    transaction.update(postRef, {
                        status: 'delivering',
                        deliveryStartedAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    return freshPost;
                });

                if (!claimedPost) {
                    logger.info(`[deliverScheduledPosts] Post ${docSnap.id} is no longer claimable, skipping.`);
                    continue;
                }

                const token = await getToken(db, claimedPost.userId, claimedPost.platform);
                const result = token
                    ? await dispatch(claimedPost, token, docSnap.id)
                    : { success: false, error: `No OAuth token for ${claimedPost.platform}` };

                const persisted = await persistDeliveryOutcome(db, postRef, claimedPost, result, now);
                if (!persisted) {
                    logger.warn(`[deliverScheduledPosts] Post ${docSnap.id} changed after claim; its newer state was preserved.`);
                    continue;
                }
                logger.info(
                    `[deliverScheduledPosts] Post ${docSnap.id} (${claimedPost.platform}): ${result.success ? 'delivered' : 'failed'} — ${result.error || result.postId}`
                );
            } catch (error) {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                processingErrors.push(normalizedError);
                logger.error({
                    message: `[deliverScheduledPosts] Post ${docSnap.id} could not be finalized`,
                    errorCode: 'POST_DELIVERY_FAILED',
                    detail: normalizedError.message,
                });
            }
        }

        if (processingErrors.length > 0) {
            const failureSummary = processingErrors.map(error => error.message).join('; ');
            throw new Error(`${processingErrors.length} scheduled post(s) could not be finalized: ${failureSummary}`);
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error({ message: '[deliverScheduledPosts] Error during scheduled delivery', errorCode: 'DELIVERY_FAILED', detail: errMsg });
        throw error;
    }
}

/**
 * Scheduled Cloud Function — runs every 5 minutes.
 * Delivers pending social posts whose scheduledAt time has passed.
 */
export const deliverScheduledPosts = onSchedule({
    schedule: 'every 5 minutes',
    timeoutSeconds: 300,
    memory: '512MiB',
    region: 'us-central1',
}, async () => deliverScheduledPostsHandler());
