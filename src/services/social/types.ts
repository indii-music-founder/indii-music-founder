export interface SocialPost {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    content: string;
    attachments: SocialAttachment[];
    likes: string[]; // User IDs
    commentCount: number;
    createdAt: string; // ISO String
    updatedAt?: string;
}

export interface SocialAttachment {
    id: string;
    type: 'image' | 'video' | 'audio' | 'link';
    url: string;
    thumbnailUrl?: string;
    title?: string;
}

export interface SocialComment {
    id: string;
    postId: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    content: string;
    likes: string[];
    createdAt: string;
}

export interface SocialConnection {
    followerId: string;
    followingId: string;
    createdAt: string;
}

export interface ArtistUpdate extends SocialPost {
    type: 'announcement' | 'release' | 'behind-the-scenes';
    isExclusive: boolean; // For paid subscribers/fans
}
