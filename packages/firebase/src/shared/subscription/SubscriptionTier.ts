/**
 * Subscription Tier Definitions for indii
 *
 * Defines all available subscription tiers with their feature limits and capabilities.
 *
 * Tier Structure:
 * - FREE: Entry-level, forever free
 * - PRO_MONTHLY/PRO_YEARLY: Professional subscription
 * - STUDIO_MONTHLY/STUDIO_YEARLY: Desktop studio variant
 */

/**
 * Available subscription tiers
 */
export enum SubscriptionTier {
    FREE = 'free',
    START = 'start',
    BUILD = 'build',
    SCALE = 'scale',
    FOUNDER = 'founder',
    // Legacy aliases for backward compatibility
    PRO_MONTHLY = 'pro_monthly',
    PRO_YEARLY = 'pro_yearly',
    STUDIO = 'studio',
}

/**
 * Supported billing periods with commit discounts
 */
export type BillingPeriod = 'monthly' | 'quarterly' | 'six_month' | 'annual';

export interface BillingPeriodConfig {
    period: BillingPeriod;
    label: string;
    months: number;
    discountRate: number;
}

export const BILLING_PERIODS: Record<BillingPeriod, BillingPeriodConfig> = {
    monthly: { period: 'monthly', label: 'Monthly', months: 1, discountRate: 0 },
    quarterly: { period: 'quarterly', label: 'Quarterly', months: 3, discountRate: 0.05 },
    six_month: { period: 'six_month', label: 'Six-month', months: 6, discountRate: 0.10 },
    annual: { period: 'annual', label: 'Annual', months: 12, discountRate: 0.20 },
};

/**
 * Settle whole-number totals for subscription cadences.
 * Enforces NO .99 charm pricing and stage-appropriate discounts (approx 5%/10%/20%).
 */
export function calculateBillingTotal(monthlyPrice: number, period: BillingPeriod | 'six-month' = 'monthly'): {
    total: number;
    monthlyEquivalent: number;
    months: number;
    discountPercent: number;
} {
    const normalizedPeriod = period === 'six-month' ? 'six_month' : period;
    const config = BILLING_PERIODS[normalizedPeriod] ?? BILLING_PERIODS.monthly;
    if (monthlyPrice <= 0) {
        return { total: 0, monthlyEquivalent: 0, months: config.months, discountPercent: 0 };
    }
    const total = Math.round(monthlyPrice * config.months * (1 - config.discountRate));
    const monthlyEquivalent = Math.round(total / config.months);
    return {
        total,
        monthlyEquivalent,
        months: config.months,
        discountPercent: Math.round(config.discountRate * 100),
    };
}


/**
 * Image generation limits for a tier
 */
export interface ImageGenerationLimits {
    monthly: number;
    generationsPerMonth: number;
    allowedFormats: string[];
}

/**
 * Video generation limits for a tier
 */
export interface VideoGenerationLimits {
    totalDurationMinutes: number;
    maxResolution: string;
    maxDurationSeconds: number;
    allowedFormats: string[];
}

/**
 * AI chat limits for a tier
 */
export interface ChatLimits {
    tokensPerMonth: number;
    modelTier: 'basic' | 'advanced' | 'unlimited';
}

/**
 * Storage limits for a tier
 */
export interface StorageLimits {
    totalGB: number;
    fileTypeAccess: string[];
    maxFileSizeMB: number;
}

/**
 * Feature flags for a tier
 */
export interface FeatureFlags {
    collaboration: boolean;
    exportFormats: string[];
    agentCapabilities: string[];
    advancedTools: string[];
    prioritySupport: boolean;
    apiAccess: boolean;
}

/**
 * Complete tier configuration
 */
export interface TierLimits {
    name: string;
    description: string;
    price: number;
    billingPeriod: 'month' | 'year' | 'once';
    imageGenerations: ImageGenerationLimits;
    videoGenerations: VideoGenerationLimits;
    aiChat: ChatLimits;
    storage: StorageLimits;
    features: FeatureFlags;
    maxProjects: number;
    maxTeamMembers: number;
}

/**
 * Complete tier configurations with all limits and features
 */
export const TIER_CONFIGS: Record<SubscriptionTier, TierLimits> = {
    [SubscriptionTier.FREE]: {
        name: 'indii Free',
        description: 'Verified artist completing one bounded guided creative proof',
        price: 0,
        billingPeriod: 'once',
        imageGenerations: {
            monthly: 50,
            generationsPerMonth: 50,
            allowedFormats: ['png', 'jpg', 'webp']
        },
        videoGenerations: {
            totalDurationMinutes: 5,
            maxResolution: '720p',
            maxDurationSeconds: 15,
            allowedFormats: ['mp4']
        },
        aiChat: {
            tokensPerMonth: 10000,
            modelTier: 'basic'
        },
        storage: {
            totalGB: 2,
            fileTypeAccess: ['jpg', 'png', 'webp', 'mp4', 'mp3', 'wav'],
            maxFileSizeMB: 100
        },
        features: {
            collaboration: false,
            exportFormats: ['png', 'jpg', 'webp', 'mp4', 'mp3'],
            agentCapabilities: ['basic_chat', 'suggestions', 'assistant'],
            advancedTools: [],
            prioritySupport: false,
            apiAccess: false
        },
        maxProjects: 3,
        maxTeamMembers: 1
    },

    [SubscriptionTier.START]: {
        name: 'indii Start',
        description: 'For an artist beginning to organize and operate the business behind the music',
        price: 22,
        billingPeriod: 'month',
        imageGenerations: {
            monthly: 250,
            generationsPerMonth: 250,
            allowedFormats: ['png', 'jpg', 'webp', 'svg']
        },
        videoGenerations: {
            totalDurationMinutes: 15,
            maxResolution: '1080p',
            maxDurationSeconds: 45,
            allowedFormats: ['mp4', 'mov', 'webm']
        },
        aiChat: {
            tokensPerMonth: 50000,
            modelTier: 'basic'
        },
        storage: {
            totalGB: 25,
            fileTypeAccess: ['jpg', 'png', 'webp', 'svg', 'mp4', 'mov', 'webm', 'mp3', 'wav', 'flac', 'pdf'],
            maxFileSizeMB: 250
        },
        features: {
            collaboration: false,
            exportFormats: ['png', 'jpg', 'webp', 'svg', 'mp4', 'mov', 'webm', 'mp3', 'wav', 'flac'],
            agentCapabilities: ['basic_chat', 'suggestions', 'assistant', 'release_workspace'],
            advancedTools: ['metadata_management', 'planning'],
            prioritySupport: false,
            apiAccess: false
        },
        maxProjects: 10,
        maxTeamMembers: 2
    },

    [SubscriptionTier.BUILD]: {
        name: 'indii Build',
        description: 'For an artist actively releasing music and building repeatable operations',
        price: 55,
        billingPeriod: 'month',
        imageGenerations: {
            monthly: 1000,
            generationsPerMonth: 1000,
            allowedFormats: ['png', 'jpg', 'webp', 'svg', 'tiff', 'psd']
        },
        videoGenerations: {
            totalDurationMinutes: 60,
            maxResolution: '1080p',
            maxDurationSeconds: 120,
            allowedFormats: ['mp4', 'mov', 'webm']
        },
        aiChat: {
            tokensPerMonth: 250000,
            modelTier: 'advanced'
        },
        storage: {
            totalGB: 100,
            fileTypeAccess: ['all'],
            maxFileSizeMB: 1000
        },
        features: {
            collaboration: true,
            exportFormats: ['all'],
            agentCapabilities: ['basic_chat', 'suggestions', 'assistant', 'delegation', 'long_term_memory', 'workflow_automation'],
            advancedTools: ['batch_processing', 'style_transfer', 'video_editing', 'audio_editing', 'metadata_management'],
            prioritySupport: false,
            apiAccess: false
        },
        maxProjects: 50,
        maxTeamMembers: 5
    },

    [SubscriptionTier.SCALE]: {
        name: 'indii Scale',
        description: 'For an artist with an active career, larger workload, and music income',
        price: 110,
        billingPeriod: 'month',
        imageGenerations: {
            monthly: 3000,
            generationsPerMonth: 3000,
            allowedFormats: ['all']
        },
        videoGenerations: {
            totalDurationMinutes: 180,
            maxResolution: '4K',
            maxDurationSeconds: 300,
            allowedFormats: ['all']
        },
        aiChat: {
            tokensPerMonth: 1000000,
            modelTier: 'unlimited'
        },
        storage: {
            totalGB: 500,
            fileTypeAccess: ['all'],
            maxFileSizeMB: 2000
        },
        features: {
            collaboration: true,
            exportFormats: ['all'],
            agentCapabilities: ['all'],
            advancedTools: ['all'],
            prioritySupport: true,
            apiAccess: true
        },
        maxProjects: 200,
        maxTeamMembers: 15
    },

    [SubscriptionTier.FOUNDER]: {
        name: 'indii Founder',
        description: 'Lifetime founding access. One-time $2,500. Unlimited indii product access; provider compute billed at pass-through cost.',
        price: 2500,
        billingPeriod: 'once',
        imageGenerations: {
            monthly: 999999,
            generationsPerMonth: 999999,
            allowedFormats: ['png', 'jpg', 'webp', 'svg', 'tiff', 'psd']
        },
        videoGenerations: {
            totalDurationMinutes: 999999,
            maxResolution: '4K',
            maxDurationSeconds: 99999,
            allowedFormats: ['mp4', 'mov', 'webm', 'avi', 'mkv']
        },
        aiChat: {
            tokensPerMonth: 999999999,
            modelTier: 'unlimited'
        },
        storage: {
            totalGB: 10000,
            fileTypeAccess: ['all'],
            maxFileSizeMB: 10000
        },
        features: {
            collaboration: true,
            exportFormats: ['all'],
            agentCapabilities: ['all'],
            advancedTools: ['all'],
            prioritySupport: true,
            apiAccess: true
        },
        maxProjects: 999999,
        maxTeamMembers: 100
    },

    // Legacy Tiers (Backward Compatibility)
    [SubscriptionTier.PRO_MONTHLY]: {
        name: 'indii Pro',
        description: 'Professional tools for serious creators',
        price: 22,
        billingPeriod: 'month',
        imageGenerations: {
            monthly: 500,
            generationsPerMonth: 500,
            allowedFormats: ['png', 'jpg', 'webp', 'svg']
        },
        videoGenerations: {
            totalDurationMinutes: 30,
            maxResolution: '1080p',
            maxDurationSeconds: 60,
            allowedFormats: ['mp4', 'mov', 'webm']
        },
        aiChat: {
            tokensPerMonth: 100000,
            modelTier: 'advanced'
        },
        storage: {
            totalGB: 50,
            fileTypeAccess: ['jpg', 'png', 'webp', 'svg', 'mp4', 'mov', 'webm', 'mp3', 'wav', 'flac', 'pdf', 'zip'],
            maxFileSizeMB: 500
        },
        features: {
            collaboration: true,
            exportFormats: ['png', 'jpg', 'webp', 'svg', 'mp4', 'mov', 'webm', 'gif', 'mp3', 'wav', 'flac', 'pdf', 'zip'],
            agentCapabilities: ['basic_chat', 'suggestions', 'assistant', 'delegation', 'long_term_memory', 'workflow_automation'],
            advancedTools: ['batch_processing', 'style_transfer', 'video_editing', 'audio_editing', 'metadata_management'],
            prioritySupport: false,
            apiAccess: false
        },
        maxProjects: 25,
        maxTeamMembers: 5
    },

    [SubscriptionTier.PRO_YEARLY]: {
        name: 'indii Pro (Yearly)',
        description: 'Save 20% with annual billing',
        price: 211,
        billingPeriod: 'year',
        imageGenerations: {
            monthly: 500,
            generationsPerMonth: 500,
            allowedFormats: ['png', 'jpg', 'webp', 'svg']
        },
        videoGenerations: {
            totalDurationMinutes: 30,
            maxResolution: '1080p',
            maxDurationSeconds: 60,
            allowedFormats: ['mp4', 'mov', 'webm']
        },
        aiChat: {
            tokensPerMonth: 100000,
            modelTier: 'advanced'
        },
        storage: {
            totalGB: 50,
            fileTypeAccess: ['jpg', 'png', 'webp', 'svg', 'mp4', 'mov', 'webm', 'mp3', 'wav', 'flac', 'pdf', 'zip'],
            maxFileSizeMB: 500
        },
        features: {
            collaboration: true,
            exportFormats: ['png', 'jpg', 'webp', 'svg', 'mp4', 'mov', 'webm', 'gif', 'mp3', 'wav', 'flac', 'pdf', 'zip'],
            agentCapabilities: ['basic_chat', 'suggestions', 'assistant', 'delegation', 'long_term_memory', 'workflow_automation'],
            advancedTools: ['batch_processing', 'style_transfer', 'video_editing', 'audio_editing', 'metadata_management'],
            prioritySupport: false,
            apiAccess: false
        },
        maxProjects: 25,
        maxTeamMembers: 5
    },

    [SubscriptionTier.STUDIO]: {
        name: 'indii Studio',
        description: 'Desktop-native with local computing and unlimited creativity',
        price: 55,
        billingPeriod: 'month',
        imageGenerations: {
            monthly: 2000,
            generationsPerMonth: 2000,
            allowedFormats: ['png', 'jpg', 'webp', 'svg', 'tiff', 'psd']
        },
        videoGenerations: {
            totalDurationMinutes: 120,
            maxResolution: '4K',
            maxDurationSeconds: 300,
            allowedFormats: ['mp4', 'mov', 'webm', 'avi', 'mkv']
        },
        aiChat: {
            tokensPerMonth: 500000,
            modelTier: 'unlimited'
        },
        storage: {
            totalGB: 500,
            fileTypeAccess: ['all'],
            maxFileSizeMB: 2000
        },
        features: {
            collaboration: true,
            exportFormats: ['all'],
            agentCapabilities: ['all'],
            advancedTools: ['all'],
            prioritySupport: true,
            apiAccess: true
        },
        maxProjects: 100,
        maxTeamMembers: 25
    }
};

/**
 * Get tier configuration by tier enum
 */
export function getTierConfig(tier: SubscriptionTier): TierLimits {
    return TIER_CONFIGS[tier];
}

/**
 * Get all available tiers ordered by price
 */
export function getTierOrder(): SubscriptionTier[] {
    return [
        SubscriptionTier.FREE,
        SubscriptionTier.START,
        SubscriptionTier.BUILD,
        SubscriptionTier.SCALE,
        SubscriptionTier.FOUNDER
    ];
}

/**
 * Check if a tier is the Founder lifetime tier
 */
export function isFounderTier(tier: SubscriptionTier): boolean {
    return tier === SubscriptionTier.FOUNDER;
}

/**
 * Check if a tier is a paid subscription
 */
export function isPaidTier(tier: SubscriptionTier): boolean {
    return tier !== SubscriptionTier.FREE;
}

/**
 * Check if a tier is yearly billing
 */
export function isYearlyTier(tier: SubscriptionTier): boolean {
    return tier === SubscriptionTier.PRO_YEARLY;
}

/**
 * Get the base tier (remove billing period)
 */
export function getBaseTier(tier: SubscriptionTier): SubscriptionTier {
    if (tier === SubscriptionTier.PRO_YEARLY) {
        return SubscriptionTier.PRO_MONTHLY;
    }
    return tier;
}

/**
 * Calculate savings for yearly billing
 */
export function calculateYearlySavings(monthlyTier: SubscriptionTier): number {
    const monthlyConfig = TIER_CONFIGS[monthlyTier];
    const yearlyTier = mappingMonthToYearly(monthlyTier);

    if (!monthlyConfig || !yearlyTier) return 0;

    const yearlyConfig = TIER_CONFIGS[yearlyTier];

    const monthlyYearlyTotal = monthlyConfig.price * 12;
    return monthlyYearlyTotal - yearlyConfig.price;
}

function mappingMonthToYearly(tier: SubscriptionTier): SubscriptionTier | null {
    if (tier === SubscriptionTier.PRO_MONTHLY) {
        return SubscriptionTier.PRO_YEARLY;
    }
    return null;
}
