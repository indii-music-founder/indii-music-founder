/**
 * InstagramPlatformService
 *
 * Renderer service facade for Instagram Business Platform features:
 * - Connection health & permission scope auditing
 * - Direct messaging via Messenger API
 * - Media comment fetching & automated replies
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import type { InstagramConnectionHealth, InstagramCommentItem } from '@indii/shared';

export async function auditInstagramConnection(): Promise<InstagramConnectionHealth> {
    const fn = httpsCallable<void, InstagramConnectionHealth>(functions, 'auditInstagramConnectionCallable');
    const res = await fn();
    return res.data;
}

export async function sendInstagramMessage(params: {
    recipientIgUserId: string;
    messageText?: string;
    mediaUrl?: string;
}): Promise<{ ok: boolean; messageId?: string; recipientId: string; sentAt: number }> {
    const fn = httpsCallable<
        { recipientIgUserId: string; messageText?: string; mediaUrl?: string },
        { ok: boolean; messageId?: string; recipientId: string; sentAt: number }
    >(functions, 'sendInstagramMessageCallable');
    const res = await fn(params);
    return res.data;
}

export async function replyInstagramComment(params: {
    commentId: string;
    replyText: string;
}): Promise<{ ok: boolean; replyCommentId?: string; repliedAt: number }> {
    const fn = httpsCallable<
        { commentId: string; replyText: string },
        { ok: boolean; replyCommentId?: string; repliedAt: number }
    >(functions, 'replyInstagramCommentCallable');
    const res = await fn(params);
    return res.data;
}

export async function getInstagramMediaComments(mediaId: string): Promise<{
    ok: boolean;
    comments: InstagramCommentItem[];
}> {
    const fn = httpsCallable<
        { mediaId: string },
        { ok: boolean; comments: InstagramCommentItem[] }
    >(functions, 'getInstagramMediaCommentsCallable');
    const res = await fn({ mediaId });
    return res.data;
}
