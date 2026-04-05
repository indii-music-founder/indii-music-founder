import { db } from '@/services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/**
 * Item 299: Feature Flag Service
 *
 * Lightweight feature flag system backed by Firestore. Enables gradual
 * rollouts without code deploys. Falls back to hardcoded defaults if
 * Firestore is unreachable.
 *
 * Flags are stored in `config/feature_flags` document with boolean values.
 *
 * Usage:
 *   const isEnabled = await FeatureFlagService.isEnabled('web3_wallet_connect');
 *   if (isEnabled) { ... }
 *
 * Admin:
 *   await FeatureFlagService.setFlag('web3_wallet_connect', true);
 */

/** Default flag values — used when Firestore is unreachable or flag is undefined */
const DEFAULT_FLAGS: Record<string, boolean> = {
    web3_wallet_connect: false,
    real_payments: false,
    real_distribution: false,
    ai_video_generation: true,
    ai_image_generation: true,
    social_auto_posting: false,
    advanced_analytics: false,
    mechanical_licensing: false,
    content_id_delivery: false,
    label_deal_tracking: false,
};

/** In-memory cache to avoid repeated Firestore reads */
let flagCache: Record<string, boolean> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class FeatureFlagService {
    private static readonly DOC_PATH = 'config/feature_flags';

    /**
     * Check if a feature flag is enabled.
     * Returns the cached value if fresh, otherwise fetches from Firestore.
     */
    static async isEnabled(flagName: string): Promise<boolean> {
        try {
            const flags = await this.getAllFlags();
            return flags[flagName] ?? DEFAULT_FLAGS[flagName] ?? false;
        } catch (error: unknown) {
            logger.warn(`[FeatureFlags] Failed to check flag "${flagName}", using default`, error);
            return DEFAULT_FLAGS[flagName] ?? false;
        }
    }

    /**
     * Get all feature flags (cached).
     */
    static async getAllFlags(): Promise<Record<string, boolean>> {
        const now = Date.now();

        if (flagCache && now - cacheTimestamp < CACHE_TTL_MS) {
            return flagCache;
        }

        try {
            const docRef = doc(db, this.DOC_PATH);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                // Merge with defaults so new flags always have a value
                flagCache = { ...DEFAULT_FLAGS, ...data };
            } else {
                flagCache = { ...DEFAULT_FLAGS };
            }

            cacheTimestamp = now;
            return flagCache;
        } catch (error: unknown) {
            logger.warn('[FeatureFlags] Firestore unreachable, using defaults', error);
            return { ...DEFAULT_FLAGS };
        }
    }

    /**
     * Set a feature flag value. Admin-only — should be restricted via Firestore rules.
     */
    static async setFlag(flagName: string, enabled: boolean): Promise<void> {
        const docRef = doc(db, this.DOC_PATH);
        await setDoc(docRef, {
            [flagName]: enabled,
            updatedAt: serverTimestamp(),
        }, { merge: true });

        // Invalidate cache
        flagCache = null;
        cacheTimestamp = 0;

        logger.info(`[FeatureFlags] Flag "${flagName}" set to ${enabled}`);
    }

    /**
     * Force-refresh the cache from Firestore.
     */
    static invalidateCache(): void {
        flagCache = null;
        cacheTimestamp = 0;
    }

    /**
     * Get the list of all known flag names.
     */
    static getKnownFlags(): string[] {
        return Object.keys(DEFAULT_FLAGS);
    }
}
