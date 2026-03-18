/**
 * StorageQuotaService
 *
 * Client-side service for reading per-user storage usage data.
 * Works with the `trackStorageQuotas` Cloud Function that writes
 * usage data to `users/{userId}/usage/storage` daily.
 *
 * Usage:
 *   const quota = await StorageQuotaService.getQuota();
 *   // { totalGB: 2.5, usedPercent: 50, tier: 'pro', limitGB: 100, ... }
 */

import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Logger } from '@/core/logger/Logger';

const TAG = 'StorageQuotaService';

export interface StorageQuota {
    /** Total bytes used across all storage prefixes */
    totalBytes: number;
    /** Total megabytes used (rounded) */
    totalMB: number;
    /** Total gigabytes used (2 decimal places) */
    totalGB: number;
    /** Total number of files */
    fileCount: number;
    /** Number of video files */
    videoCount: number;
    /** Number of image files */
    imageCount: number;
    /** When the quota was last scanned (ISO date string) */
    scanDate: string;
    /** Firestore timestamp of last update */
    updatedAt: Date | null;
}

export interface StorageQuotaWithLimits extends StorageQuota {
    /** User's membership tier */
    tier: string;
    /** Storage limit in GB for this tier */
    limitGB: number;
    /** Usage percentage (0-100) */
    usedPercent: number;
    /** Whether the user is near their limit (>80%) */
    isNearLimit: boolean;
    /** Whether the user has exceeded their limit */
    isOverLimit: boolean;
}

/** Per-tier storage limits in GB */
const TIER_LIMITS_GB: Record<string, number> = {
    free: 5,
    pro: 100,
    enterprise: 1024,
};

export class StorageQuotaService {
    /**
     * Get the current user's storage quota (one-time read).
     * Fetches both usage data and subscription tier in parallel.
     */
    static async getQuota(): Promise<StorageQuotaWithLimits | null> {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            Logger.warn(TAG, 'No authenticated user');
            return null;
        }

        try {
            // Fetch usage and subscription tier in parallel
            const [usageDoc, subscriptionDoc] = await Promise.all([
                getDoc(doc(db, 'users', userId, 'usage', 'storage')),
                getDoc(doc(db, 'subscriptions', userId)),
            ]);

            const tier = (subscriptionDoc.data()?.tier as string) || 'free';

            if (!usageDoc.exists()) {
                Logger.info(TAG, 'No usage data yet — quota scan has not run');
                return StorageQuotaService.buildDefaultQuota(tier);
            }

            return StorageQuotaService.enrichQuota(usageDoc.data(), tier);
        } catch (error) {
            Logger.error(TAG, 'Failed to read storage quota:', error);
            return null;
        }
    }

    /**
     * Subscribe to real-time quota updates.
     *
     * Fetches the subscription tier BEFORE starting the onSnapshot listener
     * so the very first callback receives the correct tier — no flash of
     * free-tier limits for paying users.
     *
     * Returns an unsubscribe function.
     */
    static subscribeToQuota(
        callback: (quota: StorageQuotaWithLimits | null) => void
    ): Unsubscribe {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            Logger.warn(TAG, 'No authenticated user for quota subscription');
            callback(null);
            return () => { /* no-op */ };
        }

        const usageRef = doc(db, 'users', userId, 'usage', 'storage');
        let innerUnsub: Unsubscribe | null = null;
        let cancelled = false;

        // Fetch tier first, THEN start the real-time listener.
        // This prevents the race condition where the first onSnapshot callback
        // fires before the tier is known, causing paying users to briefly see
        // free-tier storage limits.
        getDoc(doc(db, 'subscriptions', userId))
            .then(snap => {
                if (cancelled) return;
                const tier = (snap.data()?.tier as string) || 'free';

                innerUnsub = onSnapshot(usageRef, (snapshot) => {
                    if (!snapshot.exists()) {
                        callback(StorageQuotaService.buildDefaultQuota(tier));
                        return;
                    }
                    callback(StorageQuotaService.enrichQuota(snapshot.data(), tier));
                }, (snapshotError) => {
                    Logger.error(TAG, 'Quota subscription error:', snapshotError);
                    callback(null);
                });
            })
            .catch((fetchError) => {
                if (cancelled) return;
                Logger.warn(TAG, 'Failed to fetch subscription tier, falling back to free:', fetchError);
                // Fall back: start listener with 'free' tier rather than blocking entirely
                innerUnsub = onSnapshot(usageRef, (snapshot) => {
                    if (!snapshot.exists()) {
                        callback(StorageQuotaService.buildDefaultQuota('free'));
                        return;
                    }
                    callback(StorageQuotaService.enrichQuota(snapshot.data(), 'free'));
                }, (snapshotError) => {
                    Logger.error(TAG, 'Quota subscription error:', snapshotError);
                    callback(null);
                });
            });

        // Return an unsubscribe function that tears down both the pending
        // tier fetch and the inner snapshot listener
        return () => {
            cancelled = true;
            if (innerUnsub) {
                innerUnsub();
            }
        };
    }

    /**
     * Check if user can upload a file of the given size.
     */
    static async canUpload(fileSizeBytes: number): Promise<{ allowed: boolean; reason?: string }> {
        const quota = await StorageQuotaService.getQuota();
        if (!quota) {
            // No quota data — allow (prevent blocking new users)
            return { allowed: true };
        }

        const newTotal = quota.totalBytes + fileSizeBytes;
        const limitBytes = quota.limitGB * 1024 * 1024 * 1024;

        if (newTotal > limitBytes) {
            const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
            return {
                allowed: false,
                reason: `This ${fileSizeMB}MB file would exceed your ${quota.tier} tier limit of ${quota.limitGB}GB. Currently using ${quota.totalGB}GB.`,
            };
        }

        return { allowed: true };
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private static enrichQuota(data: Record<string, unknown>, tier = 'free'): StorageQuotaWithLimits {
        const totalGB = (data.totalGB as number) || 0;
        const resolvedTier = TIER_LIMITS_GB[tier] !== undefined ? tier : 'free';
        const limitGB = (TIER_LIMITS_GB[resolvedTier] ?? TIER_LIMITS_GB.free)!;
        const usedPercent = limitGB > 0 ? Math.min(100, Math.round((totalGB / limitGB) * 100)) : 0;

        return {
            totalBytes: (data.totalBytes as number) || 0,
            totalMB: (data.totalMB as number) || 0,
            totalGB,
            fileCount: (data.fileCount as number) || 0,
            videoCount: (data.videoCount as number) || 0,
            imageCount: (data.imageCount as number) || 0,
            scanDate: (data.scanDate as string) || '',
            updatedAt: data.updatedAt ? (data.updatedAt as { toDate: () => Date }).toDate() : null,
            tier: resolvedTier,
            limitGB,
            usedPercent,
            isNearLimit: usedPercent >= 80,
            isOverLimit: usedPercent >= 100,
        };
    }

    private static buildDefaultQuota(tier = 'free'): StorageQuotaWithLimits {
        const resolvedTier = TIER_LIMITS_GB[tier] !== undefined ? tier : 'free';
        return {
            totalBytes: 0,
            totalMB: 0,
            totalGB: 0,
            fileCount: 0,
            videoCount: 0,
            imageCount: 0,
            scanDate: '',
            updatedAt: null,
            tier: resolvedTier,
            limitGB: (TIER_LIMITS_GB[resolvedTier] ?? TIER_LIMITS_GB.free)!,
            usedPercent: 0,
            isNearLimit: false,
            isOverLimit: false,
        };
    }
}
