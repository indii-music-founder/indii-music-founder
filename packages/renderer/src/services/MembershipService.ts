/**
 * MembershipService - Centralized tier limits and quota enforcement
 *
 * Per AGENT_WORKFLOW_STANDARDS.md Section 8:
 * - Pre-check quotas before high-resource operations
 * - Provide actionable upgrade paths on limit exceeded
 */

import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, FieldValue, query, collection, where, getCountFromServer } from 'firebase/firestore';
import { logger } from '@/utils/logger';

export type MembershipTier = 'free' | 'pro' | 'founder' | 'enterprise';

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
    totalSpend: number;        // Track daily spend in USD
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

    // Cost limits
    maxDailySpend: number;

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
        maxDailySpend: 1.0,                 // $1.00 Daily Limit
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
        maxDailySpend: 10.0,                // $10.00 Daily Limit
        hasAdvancedEditing: true,
        hasCustomBranding: true,
        hasPriorityQueue: true,
        hasAPIAccess: false,
    },
    founder: {
        maxVideoDuration: 4 * 60 * 60,     // 4 hours (same as enterprise)
        maxVideoGenerationsPerDay: 500,
        maxImagesPerDay: 5000,
        maxBatchSize: 64,
        maxDesignResolution: 8192,          // 8K
        maxExportDPI: 600,
        hasCMYKSupport: true,
        maxStorageMB: 10 * 1024 * 1024,    // 10 TB
        maxProjects: -1,                    // Unlimited
        maxDailySpend: 500.0,               // $500.00 Daily Limit (pass-through at cost)
        hasAdvancedEditing: true,
        hasCustomBranding: true,
        hasPriorityQueue: true,
        hasAPIAccess: true,
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
        maxDailySpend: 100.0,               // $100.00 Daily Limit
        hasAdvancedEditing: true,
        hasCustomBranding: true,
        hasPriorityQueue: true,
        hasAPIAccess: true,
    },
};

/**
 * Builder/dev accounts that bypass all budget and quota limits.
 * Add new test emails here — this is the SINGLE source of truth.
 */
const BUILDER_EMAILS = new Set([
    'the.walking.agency.det@gmail.com',
    'qa@indiios.com',
    'founder@indiios.local',
    'e2e@indiios.test',
]);

class MembershipServiceImpl {
    /**
     * Check if the current user is a builder/dev account.
     * Checks both the profile email AND the Firebase Auth user email
     * to guard against the race condition where userProfile.email is
     * still empty (from IDB cache) while auth.user.email is already set.
     * 
     * @returns True if the account is a whitelisted builder account or in DEV mode.
     */
    private async isBuilderAccount(): Promise<boolean> {
        // ALWAYS bypass limits in local development so the team can test without hitting budget caps
        // IMPORTANT: Do NOT bypass in Vitest test runs — tests need to exercise real limit enforcement
        if (import.meta.env && import.meta.env.DEV && !import.meta.env.VITEST) {
            return true;
        }

        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState();

            // Primary: check userProfile.email (populated from Firestore/IDB)
            const profileEmail = state.userProfile?.email;
            if (profileEmail && BUILDER_EMAILS.has(profileEmail)) {
                return true;
            }

            // Fallback: check Firebase Auth user.email (populated immediately on login)
            const authEmail = (state as unknown as { user?: { email?: string | null } }).user?.email;
            if (authEmail && BUILDER_EMAILS.has(authEmail)) {
                return true;
            }

            return false;
        } catch {
            return (import.meta.env && import.meta.env.DEV) || false;
        }
    }

    /**
     * Get limits for a specific tier.
     * @param tier - The membership tier.
     * @returns The TierLimits object for the given tier.
     */
    getLimits(tier: MembershipTier): TierLimits {
        return TIER_LIMITS[tier] || TIER_LIMITS.free;
    }

    /**
     * Get maximum video duration in frames for a tier (at specified fps).
     * @param tier - The membership tier.
     * @param fps - Frames per second (default 30).
     * @returns The total number of frames allowed.
     */
    getMaxVideoDurationFrames(tier: MembershipTier, fps: number = 30): number {
        const limits = this.getLimits(tier);
        return limits.maxVideoDuration * fps;
    }

    /**
     * Get maximum video duration in seconds for a tier.
     * @param tier - The membership tier.
     * @returns Maximum duration in seconds.
     */
    getMaxVideoDurationSeconds(tier: MembershipTier): number {
        return this.getLimits(tier).maxVideoDuration;
    }

    /**
     * Check if a duration (in seconds) is within tier limits.
     * @param tier - The membership tier.
     * @param durationSeconds - The duration to check.
     * @returns True if within limits.
     */
    isWithinVideoDurationLimit(tier: MembershipTier, durationSeconds: number): boolean {
        return durationSeconds <= this.getLimits(tier).maxVideoDuration;
    }

    /**
     * Check if user can perform an action based on tier features.
     * @param tier - The membership tier.
     * @param feature - The feature key to check.
     * @returns True if the feature is enabled for the tier.
     */
    canUseFeature(tier: MembershipTier, feature: keyof TierLimits): boolean {
        const limits = this.getLimits(tier);
        const value = limits[feature];
        return typeof value === 'boolean' ? value : value !== 0;
    }

    /**
     * Format duration for display (e.g., "8 minutes", "1 hour").
     * @param seconds - Seconds to format.
     * @returns Formatted string for UI.
     */
    formatDuration(seconds: number): string {
        if (seconds < 60) return `${seconds} seconds`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} min` : `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    /**
     * Get tier display name.
     * @param tier - The membership tier.
     * @returns Human-readable tier name.
     */
    getTierDisplayName(tier: MembershipTier): string {
        return ({
            free: 'Free',
            pro: 'Pro',
            founder: 'Founder',
            enterprise: 'Enterprise'
        } as Record<MembershipTier, string>)[tier];
    }

    /**
     * Get upgrade message for a specific limit type.
     * @param currentTier - The user's current tier.
     * @param limitType - The type of limit being hit.
     * @returns A string offering an upgrade path.
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
     * Get the current organization's tier from the store.
     * This is a helper that integrates with the Zustand store.
     * 
     * @returns A promise resolving to the current MembershipTier.
     */
    async getCurrentTier(): Promise<MembershipTier> {
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState();

            // GOD MODE: Bypass for Builder
            if (await this.isBuilderAccount()) {
                return 'enterprise';
            }

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
    /**
     * Gets today's date in YYYY-MM-DD format for Firestore document indexing.
     * Uses the local timezone to match user-perceived daily quotas.
     * 
     * @returns A string representing the current date in YYYY-MM-DD format.
     */
    private getTodayKey(): string {
        return new Date().toISOString().split('T')[0]!;
    }

    /**
     * Retrieves the current authenticated User ID from the application store.
     * 
     * @returns A promise resolving to the user ID string or null if not authenticated.
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
     * Retrieves the daily usage record for a specific user.
     * If no record exists for today, returns a default empty usage object.
     * 
     * @param userId - The unique ID of the user to check.
     * @returns A promise resolving to the user's daily usage statistics.
     */
    async getDailyUsage(userId: string): Promise<DailyUsage> {
        const dateKey = this.getTodayKey();
        const usageRef = doc(db, 'users', userId, 'usage', dateKey);

        try {
            const snapshot = await getDoc(usageRef);
            if (snapshot.exists()) {
                return snapshot.data() as DailyUsage;
            }
        } catch (error: unknown) {
            logger.warn('[MembershipService] Failed to get usage:', error);
        }

        // Return default empty usage
        return {
            date: dateKey,
            imagesGenerated: 0,
            videosGenerated: 0,
            videoSecondsGenerated: 0,
            storageUsedMB: 0,
            totalSpend: 0,
            updatedAt: Date.now()
        };
    }

    /**
     * Increments usage counters (images, videos, or duration) for a user.
     * Creates a new document if it's the first action of the day.
     * 
     * @param userId - The unique ID of the user.
     * @param type - Which resource type to increment ('image' or 'video').
     * @param count - Number of units to increment (default: 1).
     * @param videoSeconds - If type is 'video', the duration in seconds to add.
     * @returns A promise that resolves when the usage is updated.
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
                    totalSpend: 0,
                    updatedAt: Date.now()
                };

                await setDoc(usageRef, newUsage);
            }
        } catch (error: unknown) {
            logger.error('[MembershipService] Failed to increment usage:', error);
            // Don't throw - usage tracking shouldn't block generation
        }
    }

    /**
     * Records a monetary spend amount for a user's daily usage.
     * This is used for budget enforcement and tiered pass-through billing.
     * 
     * @param userId - The unique ID of the user.
     * @param amount - The USD amount to add to the daily spend.
     * @returns A promise that resolves when the spend is recorded.
     */
    async recordSpend(userId: string, amount: number): Promise<void> {
        const dateKey = this.getTodayKey();
        const usageRef = doc(db, 'users', userId, 'usage', dateKey);

        try {
            // Atomic update or create with merge to prevent race conditions
            await setDoc(usageRef, {
                date: dateKey,
                totalSpend: increment(amount),
                updatedAt: Date.now()
            }, { merge: true });
        } catch (error: unknown) {
            logger.error('[MembershipService] Failed to record spend:', error);
        }
    }

    /**
     * Verifies if an estimated operation cost fits within the user's daily budget.
     * Checks tier-specific limits and current daily spend totals.
     * 
     * @param estimatedCost - The predicted cost of the upcoming operation in USD.
     * @returns A promise resolving to an approval status, remaining budget, and whether explicit user consent is required.
     */
    async checkBudget(estimatedCost: number): Promise<{ allowed: boolean; remainingBudget: number; requiresApproval: boolean }> {
        // GOD MODE: Bypass for Builder
        if (await this.isBuilderAccount()) {
            return { allowed: true, remainingBudget: Infinity, requiresApproval: false };
        }

        const userId = await this.getCurrentUserId();
        if (!userId) {
            return { allowed: false, remainingBudget: 0, requiresApproval: false };
        }

        const tier = await this.getCurrentTier();
        const limits = this.getLimits(tier);
        const usage = await this.getDailyUsage(userId);
        const currentSpend = usage.totalSpend || 0;

        // Use fixed point arithmetic for currency comparison to avoid float errors
        const currentSpendFixed = Math.round(currentSpend * 100);
        const estimatedCostFixed = Math.round(estimatedCost * 100);
        const maxSpendFixed = Math.round(limits.maxDailySpend * 100);

        const remainingBudgetFixed = maxSpendFixed - currentSpendFixed;
        const allowed = (currentSpendFixed + estimatedCostFixed) <= maxSpendFixed;

        // Ledger Policy: User must approve every charge over $0.50
        const requiresApproval = estimatedCost > 0.50;

        return {
            allowed,
            remainingBudget: remainingBudgetFixed / 100,
            requiresApproval
        };
    }

    /**
     * Checks the user's quota for a specific resource type.
     * Enforces daily caps for images, videos, and project counts.
     * 
     * @param type - The resource type to check ('image', 'video', 'storage', 'projects').
     * @param amount - The number of units being requested (default: 1).
     * @returns A promise resolving to an 'allowed' status, current usage, and the maximum allowed units.
     */
    async checkQuota(
        type: 'image' | 'video' | 'storage' | 'projects',
        amount: number = 1
    ): Promise<{ allowed: boolean; currentUsage: number; maxAllowed: number }> {
        const userId = await this.getCurrentUserId();
        if (!userId) {
            // No user = deny quota (must be authenticated for any generation)
            logger.warn('[MembershipService] Quota check denied: No authenticated user');
            return { allowed: false, currentUsage: 0, maxAllowed: 0 };
        }

        // GOD MODE: Bypass for Builder
        if (await this.isBuilderAccount()) {
            return { allowed: true, currentUsage: 0, maxAllowed: Infinity };
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
                try {
                    const q = query(collection(db, 'projects'), where('orgId', '==', 'personal'), where('userId', '==', userId));
                    const snapshot = await getCountFromServer(q);
                    currentUsage = snapshot.data().count;
                } catch (_e: unknown) {
                    logger.warn("[MembershipService] Failed to count projects:", _e);
                    currentUsage = 0;
                }
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
                } catch (_e: unknown) {
                    logger.warn("[MembershipService] Failed to count projects:", _e);
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
     * Validates if a proposed video duration is within the tier limits.
     * 
     * @param durationSeconds - The total duration in seconds being requested.
     * @returns A promise resolving to the validation status and tier metadata.
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
