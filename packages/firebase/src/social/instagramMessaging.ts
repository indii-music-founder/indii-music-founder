/**
 * Instagram Messaging & Comment Automation Functions (Messenger API)
 *
 * Implements direct messaging via `POST /{ig_user_id}/messages` and
 * comment management & replies via `POST /{comment_id}/replies` and `GET /{media_id}/comments`
 * for Instagram Business/Creator professional accounts.
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { metaAppId, metaAppSecret, arcjetKey } from '../config/secrets';

const ALL_SECRETS = [metaAppId, metaAppSecret, arcjetKey];
const META_GRAPH_API_BASE = 'https://graph.facebook.com/v23.0';

interface StoredSocialToken {
    accessToken?: string;
    igUserId?: string;
    facebookPageId?: string;
    expiresAt?: number;
    [key: string]: unknown;
}

function assertAuth(request: CallableRequest): string {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required.');
    }
    return request.auth.uid;
}

async function getStoredInstagramToken(uid: string): Promise<StoredSocialToken> {
    const db = admin.firestore();
    // Read from socialTokens or analyticsTokens
    const socialSnap = await db.collection('users').doc(uid).collection('socialTokens').doc('instagram').get();
    if (socialSnap.exists) {
        const token = socialSnap.data() as StoredSocialToken;
        if (token.accessToken && token.igUserId) return token;
    }

    const analyticsSnap = await db.collection('users').doc(uid).collection('analyticsTokens').doc('instagram').get();
    if (analyticsSnap.exists) {
        const token = analyticsSnap.data() as StoredSocialToken;
        if (token.accessToken && token.igUserId) return token;
    }

    throw new HttpsError('failed-precondition', 'No connected Instagram Business account found. Connect your account in Social Settings.');
}

/** Send Direct Message to an Instagram User via Messenger API */
export const sendInstagramMessageCallable = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 30, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);

        const { recipientIgUserId, messageText, mediaUrl } = (request.data ?? {}) as {
            recipientIgUserId?: string;
            messageText?: string;
            mediaUrl?: string;
        };

        if (!recipientIgUserId || (!messageText && !mediaUrl)) {
            throw new HttpsError('invalid-argument', 'recipientIgUserId and either messageText or mediaUrl are required.');
        }

        const token = await getStoredInstagramToken(uid);
        if (token.expiresAt && token.expiresAt <= Date.now()) {
            throw new HttpsError('failed-precondition', 'Instagram authorization expired. Please reconnect your account.');
        }

        const bodyPayload: Record<string, unknown> = {
            recipient: { id: recipientIgUserId },
            message: mediaUrl
                ? { attachment: { type: 'image', payload: { url: mediaUrl } } }
                : { text: messageText },
        };

        try {
            const url = `${META_GRAPH_API_BASE}/${token.igUserId}/messages?access_token=${encodeURIComponent(token.accessToken!)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                const errText = await res.text();
                logger.error(`[sendInstagramMessageCallable] Meta API error ${res.status}:`, errText);
                throw new HttpsError('internal', `Failed to send Instagram message: ${res.status}`);
            }

            const data = await res.json() as { message_id?: string; recipient_id?: string };
            return {
                ok: true,
                messageId: data.message_id,
                recipientId: data.recipient_id ?? recipientIgUserId,
                sentAt: Date.now(),
            };
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            logger.error('[sendInstagramMessageCallable] Exception:', e);
            throw new HttpsError('internal', `Failed to deliver Instagram DM: ${String(e)}`);
        }
    },
);

/** Reply to a comment on an Instagram media post */
export const replyInstagramCommentCallable = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 30, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);

        const { commentId, replyText } = (request.data ?? {}) as {
            commentId?: string;
            replyText?: string;
        };

        if (!commentId || !replyText) {
            throw new HttpsError('invalid-argument', 'commentId and replyText are required.');
        }

        const token = await getStoredInstagramToken(uid);
        if (token.expiresAt && token.expiresAt <= Date.now()) {
            throw new HttpsError('failed-precondition', 'Instagram authorization expired. Please reconnect your account.');
        }

        try {
            const params = new URLSearchParams({
                access_token: token.accessToken!,
                message: replyText,
            });
            const url = `${META_GRAPH_API_BASE}/${encodeURIComponent(commentId)}/replies`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                const errText = await res.text();
                logger.error(`[replyInstagramCommentCallable] Meta API error ${res.status}:`, errText);
                throw new HttpsError('internal', `Failed to reply to comment: ${res.status}`);
            }

            const data = await res.json() as { id?: string };
            return {
                ok: true,
                replyCommentId: data.id,
                repliedAt: Date.now(),
            };
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            logger.error('[replyInstagramCommentCallable] Exception:', e);
            throw new HttpsError('internal', `Failed to reply to Instagram comment: ${String(e)}`);
        }
    },
);

/** Fetch comments on an Instagram media post */
export const getInstagramMediaCommentsCallable = onCall(
    { enforceAppCheck: false, secrets: ALL_SECRETS, timeoutSeconds: 30, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        validateAppCheckV2(request);
        const uid = assertAuth(request);

        const { mediaId } = (request.data ?? {}) as { mediaId?: string };
        if (!mediaId) {
            throw new HttpsError('invalid-argument', 'mediaId is required.');
        }

        const token = await getStoredInstagramToken(uid);
        if (token.expiresAt && token.expiresAt <= Date.now()) {
            throw new HttpsError('failed-precondition', 'Instagram authorization expired. Please reconnect your account.');
        }

        try {
            const fields = 'id,text,timestamp,username,from,like_count,like_count,replies{id,text,timestamp,username}';
            const url = `${META_GRAPH_API_BASE}/${encodeURIComponent(mediaId)}/comments?fields=${fields}&access_token=${encodeURIComponent(token.accessToken!)}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

            if (!res.ok) {
                const errText = await res.text();
                logger.error(`[getInstagramMediaCommentsCallable] Meta API error ${res.status}:`, errText);
                throw new HttpsError('internal', `Failed to fetch comments: ${res.status}`);
            }

            const data = await res.json() as {
                data?: Array<{
                    id: string;
                    text: string;
                    timestamp: string;
                    username?: string;
                    from?: { id: string; username?: string };
                    like_count?: number;
                }>;
            };

            const comments = (data.data ?? []).map(c => ({
                id: c.id,
                text: c.text,
                timestamp: c.timestamp,
                username: c.username || c.from?.username || 'instagram_user',
                fromId: c.from?.id || '',
                likeCount: c.like_count ?? 0,
            }));

            return { ok: true, comments };
        } catch (e) {
            if (e instanceof HttpsError) throw e;
            logger.error('[getInstagramMediaCommentsCallable] Exception:', e);
            throw new HttpsError('internal', `Failed to fetch Instagram comments: ${String(e)}`);
        }
    },
);
