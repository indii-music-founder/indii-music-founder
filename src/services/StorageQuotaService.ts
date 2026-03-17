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
     */
    static async getQuota(): Promise<StorageQuotaWithLimits | null> {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            Logger.warn(TAG, 'No authenticated user');
            return null;
        }

        try {
            const usageRef = doc(db, 'users', userId, 'usage', 'storage');
            const usageDoc = await getDoc(usageRef);

            if (!usageDoc.exists()) {
                Logger.info(TAG, 'No usage data yet — quota scan has not run');
                return StorageQuotaService.buildDefaultQuota();
            }

            const data = usageDoc.data();
            return StorageQuotaService.enrichQuota(data);
        } catch (error) {
            Logger.error(TAG, 'Failed to read storage quota:', error);
            return null;
        }
    }

    /**
     * Subscribe to real-time quota updates.
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

        return onSnapshot(usageRef, (snapshot) => {
            if (!snapshot.exists()) {
                callback(StorageQuotaService.buildDefaultQuota());
                return;
            }
            callback(StorageQuotaService.enrichQuota(snapshot.data()));
        }, (error) => {
            Logger.error(TAG, 'Quota subscription error:', error);
            callback(null);
        });
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

    private static enrichQuota(data: Record<string, unknown>): StorageQuotaWithLimits {
        const totalGB = (data.totalGB as number) || 0;

        // TODO: Read the user's actual tier from their profile/org.
        // For now, default to 'free' tier.
        const tier = 'free';
        const limitGB = TIER_LIMITS_GB[tier] || TIER_LIMITS_GB.free;
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
            tier,
            limitGB,
            usedPercent,
            isNearLimit: usedPercent >= 80,
            isOverLimit: usedPercent >= 100,
        };
    }

    private static buildDefaultQuota(): StorageQuotaWithLimits {
        const tier = 'free';
        return {
            totalBytes: 0,
            totalMB: 0,
            totalGB: 0,
            fileCount: 0,
            videoCount: 0,
            imageCount: 0,
            scanDate: '',
            updatedAt: null,
            tier,
            limitGB: TIER_LIMITS_GB[tier],
            usedPercent: 0,
            isNearLimit: false,
            isOverLimit: false,
        };
    }
}
