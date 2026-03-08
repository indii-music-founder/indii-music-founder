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
}

interface PlatformToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    igUserId?: string;
}

async function getTokenForUser(
    db: ReturnType<typeof getFirestore>,
    userId: string,
    platform: SocialPlatform
): Promise<PlatformToken | null> {
    try {
        const snap = await db.collection('users').doc(userId).collection('socialTokens').doc(platform).get();
        return snap.exists ? (snap.data() as PlatformToken) : null;
    } catch {
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
        return { success: true, postId: data.data?.id };
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
        const { id } = await createRes.json() as { id: string };

        const publishRes = await fetch(`${base}/${token.igUserId}/media_publish`, {
            method: 'POST',
            body: new URLSearchParams({ creation_id: id, access_token: token.accessToken }),
            signal: AbortSignal.timeout(15000),
        });
        if (!publishRes.ok) return { success: false, error: `IG publish ${publishRes.status}` };
        const { id: postId } = await publishRes.json() as { id: string };
        return { success: true, postId };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

async function deliverToTikTok(token: PlatformToken, post: ScheduledPostDoc): Promise<{ success: boolean; postId?: string; error?: string }> {
    if (!post.mediaUrl) return { success: false, error: 'TikTok requires video URL' };
    try {
        const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({
                post_info: { title: post.text?.substring(0, 150) || '', privacy_level: 'PUBLIC_TO_EVERYONE' },
                source_info: { source: 'PULL_FROM_URL', video_url: post.mediaUrl },
            }),
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return { success: false, error: `TikTok ${res.status}` };
        const data = await res.json() as { data?: { publish_id: string } };
        return { success: true, postId: data.data?.publish_id };
    } catch (e) {
        return { success: false, error: String(e) };
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
}, async (_event) => {
    const db = getFirestore();
    const now = Timestamp.now();

    try {
        // Use a transaction to atomically claim posts for delivery
        const pendingSnap = await db.collection('scheduledPosts')
            .where('status', '==', 'pending')
            .where('scheduledAt', '<=', now)
            .limit(20)
            .get();

        if (pendingSnap.empty) {
            logger.info('[deliverScheduledPosts] No pending posts to deliver.');
            return;
        }

        logger.info(`[deliverScheduledPosts] Processing ${pendingSnap.size} scheduled posts.`);

        for (const docSnap of pendingSnap.docs) {
            const post = docSnap.data() as ScheduledPostDoc;
            const postRef = docSnap.ref;

            // Atomic claim: mark as 'delivering' to prevent duplicate delivery
            const claimed = await db.runTransaction(async tx => {
                const fresh = await tx.get(postRef);
                if (fresh.data()?.status !== 'pending') return false;
                tx.update(postRef, { status: 'delivering', deliveryStartedAt: FieldValue.serverTimestamp() });
                return true;
            });

            if (!claimed) {
                logger.info(`[deliverScheduledPosts] Post ${docSnap.id} already claimed, skipping.`);
                continue;
            }

            const token = await getTokenForUser(db, post.userId, post.platform);
            if (!token) {
                await postRef.update({
                    status: 'failed',
                    deliveryError: `No OAuth token for ${post.platform}`,
                    deliveredAt: FieldValue.serverTimestamp(),
                });
                continue;
            }

            let result: { success: boolean; postId?: string; error?: string };

            switch (post.platform) {
                case 'twitter':
                    result = await deliverToTwitter(token, post.text || '');
                    break;
                case 'instagram':
                    result = await deliverToInstagram(token, post);
                    break;
                case 'tiktok':
                    result = await deliverToTikTok(token, post);
                    break;
                default:
                    result = { success: false, error: `Unsupported platform: ${post.platform}` };
            }

            await postRef.update({
                status: result.success ? 'delivered' : 'failed',
                platformPostId: result.postId || null,
                deliveryError: result.error || null,
                deliveredAt: FieldValue.serverTimestamp(),
            });

            logger.info(
                `[deliverScheduledPosts] Post ${docSnap.id} (${post.platform}): ${result.success ? 'delivered' : 'failed'} — ${result.error || result.postId}`
            );
        }
    } catch (error) {
        logger.error('[deliverScheduledPosts] Error during scheduled delivery:', error);
    }
});
