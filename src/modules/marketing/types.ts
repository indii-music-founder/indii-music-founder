
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
    platform: 'Twitter' | 'Instagram' | 'LinkedIn' | 'Email';
    copy: string;
    subject?: string; // Optional for Email
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
    budget?: number;
    posts: ScheduledPost[];
    status: CampaignStatus;
    attachedAssets?: string[];
}

export interface MarketingStats {
    totalReach: number;
    engagementRate: number;
    activeCampaigns: number;
}

// AI Campaign Generation Types

export type CampaignObjective = 'awareness' | 'engagement' | 'conversion' | 'launch';
export type CampaignTone = 'professional' | 'casual' | 'edgy' | 'inspirational';
export type Platform = 'Twitter' | 'Instagram' | 'LinkedIn' | 'Email';

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
    viralProbability: number; // 0.0 to 1.0
    highPotentialAssets: string[]; // List of post IDs with highest predicted performance
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

// Fan Enrichment Types

export interface FanRecord {
    email: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    country?: string;
    phone?: string;
}

export interface EnrichedFanData extends FanRecord {
    location?: string;
    ageRange?: string;
    incomeBracket?: string;
    topGenre?: string;
    interests?: string[];
    socialProfiles?: {
        platform: string;
        url: string;
    }[];
    lastEnriched?: string;
}

export type EnrichmentProvider = 'Clearbit' | 'Apollo';

export interface EnrichmentProgress {
    processed: number;
    total: number;
    currentEmail?: string;
    status: 'idle' | 'loading' | 'processing' | 'completed' | 'error';
}
