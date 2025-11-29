
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
    platform: 'Twitter' | 'Instagram';
    copy: string;
    imageAsset: ImageAsset;
    day: number;
    status: CampaignStatus;
    errorMessage?: string;
    postId?: string;
}

export interface CampaignAsset {
    assetType: 'campaign';
    title: string;
    durationDays: number;
    startDate: string;
    posts: ScheduledPost[];
}
