import { SocialPost } from '@/services/social/types';

export interface FeedItemProps {
    post: SocialPost;
    formatDate: (ts: number) => string;
}

// ⚡ Bolt Optimization: Deep comparison to prevent re-renders from Firestore/Store reference instability
// This allows React.memo to skip re-renders when the post object reference changes but the content is identical.
// NOTE: If SocialPost type changes (new fields), this function must be updated to avoid stale UI.
export function areFeedItemPropsEqual(prev: FeedItemProps, next: FeedItemProps): boolean {
    if (prev.formatDate !== next.formatDate) return false;

    const p = prev.post;
    const n = next.post;

    // Fast path: referential equality
    if (p === n) return true;

    // Deep compare relevant fields
    const areFieldsEqual =
        p.id === n.id &&
        p.likes === n.likes &&
        p.commentsCount === n.commentsCount &&
        p.content === n.content &&
        p.authorId === n.authorId &&
        p.authorName === n.authorName &&
        p.authorAvatar === n.authorAvatar &&
        p.productId === n.productId &&
        p.timestamp === n.timestamp;

    if (!areFieldsEqual) return false;

    // Deep compare mediaUrls array
    const prevMedia = p.mediaUrls;
    const nextMedia = n.mediaUrls;

    if (prevMedia === nextMedia) return true;
    if (!prevMedia || !nextMedia) return prevMedia === nextMedia; // One is null/undefined
    if (prevMedia.length !== nextMedia.length) return false;

    for (let i = 0; i < prevMedia.length; i++) {
        if (prevMedia[i] !== nextMedia[i]) return false;
    }

    return true;
}
