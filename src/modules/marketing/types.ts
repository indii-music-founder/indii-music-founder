
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

// AI Campaign Generation Types

export type CampaignObjective = 'awareness' | 'engagement' | 'conversion' | 'launch';
export type CampaignTone = 'professional' | 'casual' | 'edgy' | 'inspirational';
export type Platform = 'Twitter' | 'Instagram' | 'LinkedIn';

export interface CampaignBrief {
    topic: string;
    objective: CampaignObjective;
    platforms: Platform[];
    durationDays: number;
    postsPerDay: number;
    tone: CampaignTone;
    targetAudience?: string;
}

export interface GeneratedPostContent {
    platform: Platform;
    day: number;
    copy: string;
    imagePrompt: string;
    hashtags: string[];
    bestTimeToPost?: string;
}

export interface GeneratedCampaignPlan {
    title: string;
    description: string;
    posts: GeneratedPostContent[];
}

// AI Post Enhancement Types

export type EnhancementType = 'improve' | 'shorter' | 'longer' | 'different_tone';

export interface PostEnhancement {
    enhancedCopy: string;
    alternativeVersions: string[];
    suggestedHashtags: string[];
    toneAnalysis: string;
}

// AI Performance Prediction Types

export interface PlatformPrediction {
    platform: Platform;
    predictedLikes: number;
    predictedComments: number;
    predictedShares: number;
    confidence: 'low' | 'medium' | 'high';
}

export interface EngagementPrediction {
    overallScore: number;
    estimatedReach: number;
    estimatedEngagementRate: number;
    platformBreakdown: PlatformPrediction[];
    recommendations: string[];
    riskFactors: string[];
}

// AI Batch Processing Types

export interface BatchImageProgress {
    current: number;
    total: number;
    currentPostId: string;
    status: 'generating' | 'complete' | 'error';
}
