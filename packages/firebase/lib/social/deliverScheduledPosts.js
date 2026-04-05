"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverScheduledPosts = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
async function getTokenForUser(db, userId, platform) {
    try {
        const snap = await db.collection('users').doc(userId).collection('socialTokens').doc(platform).get();
        return snap.exists ? snap.data() : null;
    }
    catch (_a) {
        return null;
    }
}
async function deliverToTwitter(token, text) {
    var _a;
    try {
        const res = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok)
            return { success: false, error: `Twitter ${res.status}` };
        const data = await res.json();
        return { success: true, postId: (_a = data.data) === null || _a === void 0 ? void 0 : _a.id };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
}
async function deliverToInstagram(token, post) {
    var _a;
    if (!token.igUserId)
        return { success: false, error: 'Missing Instagram user ID' };
    const base = 'https://graph.facebook.com/v20.0';
    const caption = [post.text, (_a = post.hashtags) === null || _a === void 0 ? void 0 : _a.map(h => `#${h.replace('#', '')}`).join(' ')].filter(Boolean).join('\n\n');
    try {
        const params = new URLSearchParams({ access_token: token.accessToken, caption });
        if (post.mediaType === 'video' && post.mediaUrl) {
            params.set('media_type', 'REELS');
            params.set('video_url', post.mediaUrl);
        }
        else if (post.mediaUrl) {
            params.set('image_url', post.mediaUrl);
        }
        const createRes = await fetch(`${base}/${token.igUserId}/media?${params}`, { method: 'POST', signal: AbortSignal.timeout(30000) });
        if (!createRes.ok)
            return { success: false, error: `IG container ${createRes.status}` };
        const { id } = await createRes.json();
        const publishRes = await fetch(`${base}/${token.igUserId}/media_publish`, {
            method: 'POST',
            body: new URLSearchParams({ creation_id: id, access_token: token.accessToken }),
            signal: AbortSignal.timeout(15000),
        });
        if (!publishRes.ok)
            return { success: false, error: `IG publish ${publishRes.status}` };
        const { id: postId } = await publishRes.json();
        return { success: true, postId };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
}
async function deliverToTikTok(token, post) {
    var _a, _b;
    if (!post.mediaUrl)
        return { success: false, error: 'TikTok requires video URL' };
    try {
        const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({
                post_info: { title: ((_a = post.text) === null || _a === void 0 ? void 0 : _a.substring(0, 150)) || '', privacy_level: 'PUBLIC_TO_EVERYONE' },
                source_info: { source: 'PULL_FROM_URL', video_url: post.mediaUrl },
            }),
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok)
            return { success: false, error: `TikTok ${res.status}` };
        const data = await res.json();
        return { success: true, postId: (_b = data.data) === null || _b === void 0 ? void 0 : _b.publish_id };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
}
/**
 * Scheduled Cloud Function — runs every 5 minutes.
 * Delivers pending social posts whose scheduledAt time has passed.
 */
exports.deliverScheduledPosts = (0, scheduler_1.onSchedule)({
    schedule: 'every 5 minutes',
    timeoutSeconds: 300,
    memory: '512MiB',
    region: 'us-central1',
}, async (_event) => {
    var _a;
    const db = (0, firestore_1.getFirestore)();
    const now = firestore_1.Timestamp.now();
    try {
        // Use a transaction to atomically claim posts for delivery
        const pendingSnap = await db.collection('scheduledPosts')
            .where('status', '==', 'pending')
            .where('scheduledAt', '<=', now)
            .limit(20)
            .get();
        // Item 384: Retry failed posts with exponential backoff (up to 3 attempts)
        const retrySnap = await db.collection('scheduledPosts')
            .where('status', '==', 'failed')
            .where('retryCount', '<', 3)
            .where('nextRetryAt', '<=', now)
            .limit(10)
            .get();
        const allDocs = [...pendingSnap.docs, ...retrySnap.docs];
        if (allDocs.length === 0) {
            firebase_functions_1.logger.info('[deliverScheduledPosts] No pending posts to deliver.');
            return;
        }
        firebase_functions_1.logger.info(`[deliverScheduledPosts] Processing ${pendingSnap.size} pending + ${retrySnap.size} retry posts.`);
        for (const docSnap of allDocs) {
            const post = docSnap.data();
            const postRef = docSnap.ref;
            // Atomic claim: mark as 'delivering' to prevent duplicate delivery
            const claimed = await db.runTransaction(async (tx) => {
                var _a;
                const fresh = await tx.get(postRef);
                const freshStatus = (_a = fresh.data()) === null || _a === void 0 ? void 0 : _a.status;
                // Allow claiming pending posts or failed posts ready for retry
                if (freshStatus !== 'pending' && freshStatus !== 'failed')
                    return false;
                tx.update(postRef, { status: 'delivering', deliveryStartedAt: firestore_1.FieldValue.serverTimestamp() });
                return true;
            });
            if (!claimed) {
                firebase_functions_1.logger.info(`[deliverScheduledPosts] Post ${docSnap.id} already claimed, skipping.`);
                continue;
            }
            const token = await getTokenForUser(db, post.userId, post.platform);
            if (!token) {
                await postRef.update({
                    status: 'failed',
                    deliveryError: `No OAuth token for ${post.platform}`,
                    deliveredAt: firestore_1.FieldValue.serverTimestamp(),
                });
                continue;
            }
            let result;
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
            if (result.success) {
                await postRef.update({
                    status: 'delivered',
                    platformPostId: result.postId || null,
                    deliveryError: null,
                    deliveredAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            else {
                // Item 384: Exponential backoff retry — 2^retryCount minutes (2, 4, 8 min)
                const currentRetry = ((_a = post.retryCount) !== null && _a !== void 0 ? _a : 0) + 1;
                const backoffMs = Math.pow(2, currentRetry) * 60 * 1000;
                const nextRetry = new firestore_1.Timestamp(Math.floor((Date.now() + backoffMs) / 1000), 0);
                await postRef.update({
                    status: currentRetry >= 3 ? 'failed' : 'failed',
                    platformPostId: null,
                    deliveryError: result.error || null,
                    retryCount: currentRetry,
                    nextRetryAt: currentRetry < 3 ? nextRetry : firestore_1.FieldValue.delete(),
                    deliveredAt: currentRetry >= 3 ? firestore_1.FieldValue.serverTimestamp() : null,
                });
            }
            firebase_functions_1.logger.info(`[deliverScheduledPosts] Post ${docSnap.id} (${post.platform}): ${result.success ? 'delivered' : 'failed'} — ${result.error || result.postId}`);
        }
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        firebase_functions_1.logger.error({ message: '[deliverScheduledPosts] Error during scheduled delivery', errorCode: 'DELIVERY_FAILED', detail: errMsg });
    }
});
//# sourceMappingURL=deliverScheduledPosts.js.map