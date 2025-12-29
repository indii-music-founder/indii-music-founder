
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
    imageAsset: ImageAsset;
    day: number; // Keep for backward compatibility or relative scheduling
    scheduledTime?: Date;
    status: CampaignStatus;
    errorMessage?: string;
    postId?: string;
}

export interface CampaignAsset {
    id?: string;
    assetType: 'campaign';
    title: string;
    description?: string;
    durationDays: number;
    startDate: string;
    endDate?: string;
    posts: ScheduledPost[];
    status: CampaignStatus;
}

export interface MarketingStats {
    totalReach: number;
    engagementRate: number;
    activeCampaigns: number;
}
