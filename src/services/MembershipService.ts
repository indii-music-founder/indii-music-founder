/**
 * MembershipService - Centralized tier limits and quota enforcement
 *
 * Per AGENT_WORKFLOW_STANDARDS.md Section 8:
 * - Pre-check quotas before high-resource operations
 * - Provide actionable upgrade paths on limit exceeded
 */

import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, FieldValue, collection, query, where, getCountFromServer } from 'firebase/firestore';

export type MembershipTier = 'free' | 'pro' | 'enterprise';

/**
 * Daily usage tracking stored in Firestore
 * Path: users/{userId}/usage/{YYYY-MM-DD}
 */
export interface DailyUsage {
    date: string;              // YYYY-MM-DD
    imagesGenerated: number;
    videosGenerated: number;
    videoSecondsGenerated: number;
    storageUsedMB: number;     // Cumulative, not daily
    updatedAt: number;         // Timestamp
}

export interface TierLimits {
    // Video limits (in seconds)
    maxVideoDuration: number;
    maxVideoGenerationsPerDay: number;

    // Image limits
    maxImagesPerDay: number;
    maxBatchSize: number;

    // Physical Design limits
    maxDesignResolution: number;     // max width/height in px
    maxExportDPI: number;
    hasCMYKSupport: boolean;

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
        maxDesignResolution: 1024,
        maxExportDPI: 150,
        hasCMYKSupport: false,
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
        maxDesignResolution: 4096,          // 4K
        maxExportDPI: 300,
        hasCMYKSupport: true,
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
        maxDesignResolution: 8192,          // 8K
        maxExportDPI: 600,
        hasCMYKSupport: true,
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
    getUpgradeMessage(currentTier: MembershipTier, limitType: 'video' | 'images' | 'storage' | 'projects' | 'resolution' | 'export'): string {
        const nextTier = currentTier === 'free' ? 'Pro' : 'Enterprise';

        const messages = {
            video: `Upgrade to ${nextTier} for longer video durations`,
            images: `Upgrade to ${nextTier} for more image generations`,
            storage: `Upgrade to ${nextTier} for more storage space`,
            projects: `Upgrade to ${nextTier} for more projects`,
            resolution: `Upgrade to ${nextTier} for high-resolution 4K generation`,
            export: `Upgrade to ${nextTier} for professional CMYK/300DPI exports`
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

    // =========================================================================
    // USAGE TRACKING (Section 8 Compliance)
    // =========================================================================

    /**
     * Get today's date in YYYY-MM-DD format
     */
    private getTodayKey(): string {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get the current user ID from the store
     */
    private async getCurrentUserId(): Promise<string | null> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState();
            return state.userProfile?.id || null;
        } catch {
            return null;
        }
    }

    /**
     * Get daily usage for a user
     */
    async getDailyUsage(userId: string): Promise<DailyUsage> {
        const dateKey = this.getTodayKey();
        const usageRef = doc(db, 'users', userId, 'usage', dateKey);

        try {
            const snapshot = await getDoc(usageRef);
            if (snapshot.exists()) {
                return snapshot.data() as DailyUsage;
            }
        } catch (error) {
            console.warn('[MembershipService] Failed to get usage:', error);
        }

        // Return default empty usage
        return {
            date: dateKey,
            imagesGenerated: 0,
            videosGenerated: 0,
            videoSecondsGenerated: 0,
            storageUsedMB: 0,
            updatedAt: Date.now()
        };
    }

    /**
     * Increment usage counter after successful generation
     */
    async incrementUsage(
        userId: string,
        type: 'image' | 'video',
        count: number = 1,
        videoSeconds?: number
    ): Promise<void> {
        const dateKey = this.getTodayKey();
        const usageRef = doc(db, 'users', userId, 'usage', dateKey);

        try {
            const snapshot = await getDoc(usageRef);

            if (snapshot.exists()) {
                // Update existing document
                const updates: { [key: string]: number | FieldValue } = {
                    updatedAt: Date.now()
                };

                if (type === 'image') {
                    updates.imagesGenerated = increment(count);
                } else if (type === 'video') {
                    updates.videosGenerated = increment(count);
                    if (videoSeconds) {
                        updates.videoSecondsGenerated = increment(videoSeconds);
                    }
                }

                await updateDoc(usageRef, updates);
            } else {
                // Create new document for today
                const newUsage: DailyUsage = {
                    date: dateKey,
                    imagesGenerated: type === 'image' ? count : 0,
                    videosGenerated: type === 'video' ? count : 0,
                    videoSecondsGenerated: type === 'video' && videoSeconds ? videoSeconds : 0,
                    storageUsedMB: 0,
                    updatedAt: Date.now()
                };

                await setDoc(usageRef, newUsage);
            }
        } catch (error) {
            console.error('[MembershipService] Failed to increment usage:', error);
            // Don't throw - usage tracking shouldn't block generation
        }
    }

    /**
     * Check if user is within quota for a specific resource type
     * Returns true if allowed, false if quota exceeded
     */
    async checkQuota(
        type: 'image' | 'video' | 'storage' | 'projects',
        amount: number = 1
    ): Promise<{ allowed: boolean; currentUsage: number; maxAllowed: number }> {
        const userId = await this.getCurrentUserId();
        if (!userId) {
            // No user = deny quota (must be authenticated for any generation)
            console.warn('[MembershipService] Quota check denied: No authenticated user');
            return { allowed: false, currentUsage: 0, maxAllowed: 0 };
        }

        const tier = await this.getCurrentTier();
        const limits = this.getLimits(tier);
        const usage = await this.getDailyUsage(userId);

        let currentUsage: number;
        let maxAllowed: number;

        switch (type) {
            case 'image':
                currentUsage = usage.imagesGenerated;
                maxAllowed = limits.maxImagesPerDay;
                break;
            case 'video':
                currentUsage = usage.videosGenerated;
                maxAllowed = limits.maxVideoGenerationsPerDay;
                break;
            case 'storage':
                currentUsage = usage.storageUsedMB;
                maxAllowed = limits.maxStorageMB;
                break;
            case 'projects':
                // Check if quota is unlimited first
                if (tier === 'enterprise' && limits.maxProjects === -1) {
                    return { allowed: true, currentUsage: 0, maxAllowed: Infinity };
                }

                try {
                    // Count projects where the user is a member
                    // Note: This relies on the 'projects' collection being indexed by 'orgId'
                    // and the user being able to access them.
                    // For a simpler check, we count projects created by the user or
                    // check the organization's project count if applicable.
                    // Assuming 'projects' has an 'orgId' field.

                    // Get current Org ID from store state similar to getCurrentTier
                    const { useStore } = await import('@/core/store');
                    const state = useStore.getState();
                    const currentOrgId = state.currentOrganizationId;

                    if (currentOrgId) {
                         const projectsRef = collection(db, 'projects');
                         const q = query(projectsRef, where('orgId', '==', currentOrgId));
                         const snapshot = await getCountFromServer(q);
                         currentUsage = snapshot.data().count;
                    } else {
                        // Fallback to counting personal projects if no org context
                        // This might need adjustment based on exact data model
                        currentUsage = 0;
                    }
                } catch (e) {
                    console.warn('[MembershipService] Failed to count projects:', e);
                    currentUsage = 0; // Fail open but warn
                }

                maxAllowed = limits.maxProjects;
                break;
            default:
                return { allowed: true, currentUsage: 0, maxAllowed: Infinity };
        }

        // Enterprise has unlimited for most things
        if (tier === 'enterprise' && maxAllowed === -1) {
            return { allowed: true, currentUsage, maxAllowed: Infinity };
        }

        const allowed = (currentUsage + amount) <= maxAllowed;
        return { allowed, currentUsage, maxAllowed };
    }

    /**
     * Check video duration limit
     */
    async checkVideoDurationQuota(durationSeconds: number): Promise<{
        allowed: boolean;
        maxDuration: number;
        tierName: string;
    }> {
        const tier = await this.getCurrentTier();
        const limits = this.getLimits(tier);
        const allowed = durationSeconds <= limits.maxVideoDuration;

        return {
            allowed,
            maxDuration: limits.maxVideoDuration,
            tierName: this.getTierDisplayName(tier)
        };
    }
}

export const MembershipService = new MembershipServiceImpl();

// Export tier limits for direct access if needed
export { TIER_LIMITS };
