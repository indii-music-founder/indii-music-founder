/**
 * MembershipService - Centralized tier limits and quota enforcement
 */

export type MembershipTier = 'free' | 'pro' | 'enterprise';

export interface TierLimits {
    // Video limits (in seconds)
    maxVideoDuration: number;
    maxVideoGenerationsPerDay: number;

    // Image limits
    maxImagesPerDay: number;
    maxBatchSize: number;

    // Storage limits (in MB)
    maxStorageMB: number;

    // Project limits
    maxProjects: number;

    // Feature flags
    hasAdvancedEditing: boolean;
    hasCustomBranding: boolean;
    hasPriorityQueue: boolean;
    hasAPIAccess: boolean;
}

const TIER_LIMITS: Record<MembershipTier, TierLimits> = {
    free: {
        maxVideoDuration: 8 * 60,          // 8 minutes
        maxVideoGenerationsPerDay: 5,
        maxImagesPerDay: 50,
        maxBatchSize: 4,
        maxStorageMB: 500,                  // 500 MB
        maxProjects: 3,
        hasAdvancedEditing: false,
        hasCustomBranding: false,
        hasPriorityQueue: false,
        hasAPIAccess: false,
    },
    pro: {
        maxVideoDuration: 60 * 60,         // 60 minutes
        maxVideoGenerationsPerDay: 50,
        maxImagesPerDay: 500,
        maxBatchSize: 16,
        maxStorageMB: 10 * 1024,           // 10 GB
        maxProjects: 50,
        hasAdvancedEditing: true,
        hasCustomBranding: true,
        hasPriorityQueue: true,
        hasAPIAccess: false,
    },
    enterprise: {
        maxVideoDuration: 4 * 60 * 60,     // 4 hours
        maxVideoGenerationsPerDay: 500,
        maxImagesPerDay: 5000,
        maxBatchSize: 64,
        maxStorageMB: 100 * 1024,          // 100 GB
        maxProjects: -1,                    // Unlimited
        hasAdvancedEditing: true,
        hasCustomBranding: true,
        hasPriorityQueue: true,
        hasAPIAccess: true,
    },
};

class MembershipServiceImpl {
    /**
     * Get limits for a specific tier
     */
    getLimits(tier: MembershipTier): TierLimits {
        return TIER_LIMITS[tier] || TIER_LIMITS.free;
    }

    /**
     * Get maximum video duration in frames for a tier (at 30fps)
     */
    getMaxVideoDurationFrames(tier: MembershipTier, fps: number = 30): number {
        const limits = this.getLimits(tier);
        return limits.maxVideoDuration * fps;
    }

    /**
     * Get maximum video duration in seconds for a tier
     */
    getMaxVideoDurationSeconds(tier: MembershipTier): number {
        return this.getLimits(tier).maxVideoDuration;
    }

    /**
     * Check if a duration (in seconds) is within tier limits
     */
    isWithinVideoDurationLimit(tier: MembershipTier, durationSeconds: number): boolean {
        return durationSeconds <= this.getLimits(tier).maxVideoDuration;
    }

    /**
     * Check if user can perform an action based on tier
     */
    canUseFeature(tier: MembershipTier, feature: keyof TierLimits): boolean {
        const limits = this.getLimits(tier);
        const value = limits[feature];
        return typeof value === 'boolean' ? value : value !== 0;
    }

    /**
     * Format duration for display (e.g., "8 minutes", "1 hour")
     */
    formatDuration(seconds: number): string {
        if (seconds < 60) return `${seconds} seconds`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} min` : `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    /**
     * Get tier display name
     */
    getTierDisplayName(tier: MembershipTier): string {
        return {
            free: 'Free',
            pro: 'Pro',
            enterprise: 'Enterprise'
        }[tier];
    }

    /**
     * Get upgrade message for a limit
     */
    getUpgradeMessage(currentTier: MembershipTier, limitType: 'video' | 'images' | 'storage' | 'projects'): string {
        const nextTier = currentTier === 'free' ? 'Pro' : 'Enterprise';

        const messages = {
            video: `Upgrade to ${nextTier} for longer video durations`,
            images: `Upgrade to ${nextTier} for more image generations`,
            storage: `Upgrade to ${nextTier} for more storage space`,
            projects: `Upgrade to ${nextTier} for more projects`
        };

        return messages[limitType];
    }

    /**
     * Get the current organization's tier from the store
     * This is a helper that integrates with the Zustand store
     */
    async getCurrentTier(): Promise<MembershipTier> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState();
            const currentOrg = state.organizations.find(o => o.id === state.currentOrganizationId);
            return currentOrg?.plan || 'free';
        } catch {
            return 'free';
        }
    }
}

export const MembershipService = new MembershipServiceImpl();

// Export tier limits for direct access if needed
export { TIER_LIMITS };
