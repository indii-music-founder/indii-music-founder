export interface SocialPost {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    mediaUrls?: string[]; // Images, generated art, snippets
    productId?: string; // ID of a product from the marketplace (Social Drop)
    likes: number;
    commentsCount: number;
    timestamp: number;
}

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    timestamp: number;
}

export interface SocialConnection {
    userId: string;
    targetId: string;
    status: 'following' | 'blocked' | 'mutual';
    timestamp: number;
}

export interface SocialStats {
    followers: number;
    following: number;
    posts: number;
    drops: number; // Number of product drops
}

export enum CampaignStatus {
    PENDING = 'PENDING',
    EXECUTING = 'EXECUTING',
    DONE = 'DONE',
    FAILED = 'FAILED',
}

export interface ImageAsset {
    assetType: 'image';
    title: string;
    imageUrl: string;
    caption: string;
}

export interface ScheduledPost {
    id: string;
    platform: 'Twitter' | 'Instagram' | 'LinkedIn';
    copy: string;
    imageAsset?: ImageAsset;
    day: number; // Keep for backward compatibility or relative scheduling
    scheduledTime?: number; // Changed to number (timestamp) for serialization
    status: CampaignStatus;
    errorMessage?: string;
    postId?: string; // If posted, reference to the actual post
    authorId: string;
}
