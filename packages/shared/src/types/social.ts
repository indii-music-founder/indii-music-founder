export type SocialPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube' | 'spotify';

export type InstagramMediaType = 'image' | 'video' | 'reel' | 'story' | 'carousel';

export interface InstagramCarouselItem {
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
}

export type InstagramConnectionHealthStatus = 'HEALTHY' | 'RECONNECT_REQUIRED' | 'MISSING_PERMISSIONS' | 'EXPIRED';

export interface InstagramConnectionHealth {
    status: InstagramConnectionHealthStatus;
    connected: boolean;
    igUserId?: string;
    facebookPageId?: string;
    instagramUsername?: string;
    permissions: string[];
    missingPermissions: string[];
    expiresAt?: number;
    lastCheckedAt: number;
    reconnectUrl?: string;
}

export interface InstagramMessagePayload {
    recipientIgUserId: string;
    messageText: string;
    mediaUrl?: string;
    threadId?: string;
}

export interface InstagramCommentPayload {
    mediaId: string;
    commentId: string;
    replyText: string;
}

export interface InstagramCommentItem {
    id: string;
    text: string;
    timestamp: string;
    username: string;
    fromId: string;
    likeCount?: number;
    replyCount?: number;
}
