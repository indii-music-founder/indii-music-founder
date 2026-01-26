"use strict";
/**
 * Subscription Tier Definitions for indiiOS
 *
 * Defines all available subscription tiers with their feature limits and capabilities.
 *
 * Tier Structure:
 * - FREE: Entry-level, forever free
 * - PRO_MONTHLY/PRO_YEARLY: Professional subscription
 * - STUDIO_MONTHLY/STUDIO_YEARLY: Desktop studio variant
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_CONFIGS = exports.SubscriptionTier = void 0;
exports.getTierConfig = getTierConfig;
exports.getTierOrder = getTierOrder;
exports.isPaidTier = isPaidTier;
exports.isYearlyTier = isYearlyTier;
exports.getBaseTier = getBaseTier;
exports.calculateYearlySavings = calculateYearlySavings;
/**
 * Available subscription tiers
 */
var SubscriptionTier;
(function (SubscriptionTier) {
    SubscriptionTier["FREE"] = "free";
    SubscriptionTier["PRO_MONTHLY"] = "pro_monthly";
    SubscriptionTier["PRO_YEARLY"] = "pro_yearly";
    SubscriptionTier["STUDIO"] = "studio";
})(SubscriptionTier || (exports.SubscriptionTier = SubscriptionTier = {}));
/**
 * Complete tier configurations with all limits and features
 */
exports.TIER_CONFIGS = {
    [SubscriptionTier.FREE]: {
        name: 'indiiOS Free',
        description: 'Perfect for beginners to explore AI-powered creativity',
        price: 0,
        billingPeriod: 'once',
        imageGenerations: {
            monthly: 50,
            maxResolution: '1024x1024',
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
    [SubscriptionTier.PRO_MONTHLY]: {
        name: 'indiiOS Pro',
        description: 'Professional tools for serious creators',
        price: 19,
        billingPeriod: 'month',
        imageGenerations: {
            monthly: 500,
            maxResolution: '2048x2048',
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
        name: 'indiiOS Pro (Yearly)',
        description: 'Save 17% with annual billing',
        price: 190,
        billingPeriod: 'year',
        imageGenerations: {
            monthly: 500,
            maxResolution: '2048x2048',
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
        name: 'indiiOS Studio',
        description: 'Desktop-native with local computing and unlimited creativity',
        price: 49,
        billingPeriod: 'month',
        imageGenerations: {
            monthly: 2000,
            maxResolution: '4096x4096',
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
function getTierConfig(tier) {
    return exports.TIER_CONFIGS[tier];
}
/**
 * Get all available tiers ordered by price
 */
function getTierOrder() {
    return [
        SubscriptionTier.FREE,
        SubscriptionTier.PRO_MONTHLY,
        SubscriptionTier.STUDIO
    ];
}
/**
 * Check if a tier is a paid subscription
 */
function isPaidTier(tier) {
    return tier !== SubscriptionTier.FREE;
}
/**
 * Check if a tier is yearly billing
 */
function isYearlyTier(tier) {
    return tier === SubscriptionTier.PRO_YEARLY;
}
/**
 * Get the base tier (remove billing period)
 */
function getBaseTier(tier) {
    if (tier === SubscriptionTier.PRO_YEARLY) {
        return SubscriptionTier.PRO_MONTHLY;
    }
    return tier;
}
/**
 * Calculate savings for yearly billing
 */
function calculateYearlySavings(monthlyTier) {
    const monthlyConfig = exports.TIER_CONFIGS[monthlyTier];
    const yearlyTier = mappingMonthToYearly(monthlyTier);
    if (!monthlyConfig || !yearlyTier)
        return 0;
    const yearlyConfig = exports.TIER_CONFIGS[yearlyTier];
    const monthlyYearlyTotal = monthlyConfig.price * 12;
    return monthlyYearlyTotal - yearlyConfig.price;
}
function mappingMonthToYearly(tier) {
    if (tier === SubscriptionTier.PRO_MONTHLY) {
        return SubscriptionTier.PRO_YEARLY;
    }
    return null;
}
//# sourceMappingURL=SubscriptionTier.js.map