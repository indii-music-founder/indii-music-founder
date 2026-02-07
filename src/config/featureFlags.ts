/**
 * Feature Flags Service
 *
 * Wraps Firebase Remote Config for runtime feature toggles.
 * Allows gradual rollouts without redeploying.
 *
 * Usage:
 *   if (featureFlags.isEnabled('new_video_editor')) { ... }
 */

import { Logger } from '@/core/logger/Logger';

// Feature flag defaults - these are used when Remote Config is unavailable
const DEFAULTS: Record<string, boolean> = {
    enable_app_check: false,
    enable_video_interpolation: true,
    enable_ai_voice: true,
    enable_merch_store: true,
    enable_ddex_export: true,
    enable_social_feed: true,
    enable_knowledge_api: true,
    enable_desktop_auto_update: false,
    enable_advanced_audio_analysis: true,
    maintenance_mode: false,
};

class FeatureFlagService {
    private flags: Map<string, boolean> = new Map();
    private initialized = false;

    constructor() {
        // Load defaults immediately
        for (const [key, value] of Object.entries(DEFAULTS)) {
            this.flags.set(key, value);
        }
    }

    /**
     * Initialize from Firebase Remote Config.
     * Call once at app startup after Firebase is initialized.
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const { getRemoteConfig, fetchAndActivate, getBoolean } = await import('firebase/remote-config');
            const { app } = await import('@/services/firebase');

            const remoteConfig = getRemoteConfig(app);
            remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 0 : 3600000; // 1hr in prod

            // Set defaults
            remoteConfig.defaultConfig = Object.fromEntries(
                Object.entries(DEFAULTS).map(([k, v]) => [k, String(v)])
            );

            await fetchAndActivate(remoteConfig);

            // Read all flags
            for (const key of Object.keys(DEFAULTS)) {
                this.flags.set(key, getBoolean(remoteConfig, key));
            }

            this.initialized = true;
            Logger.info('FeatureFlags', `Loaded ${this.flags.size} flags from Remote Config`);
        } catch (error) {
            Logger.warn('FeatureFlags', 'Remote Config unavailable, using defaults', error);
            // Defaults are already loaded - continue with them
        }
    }

    /**
     * Check if a feature flag is enabled.
     */
    isEnabled(flag: string): boolean {
        return this.flags.get(flag) ?? false;
    }

    /**
     * Get all current flag values (for debugging).
     */
    getAll(): Record<string, boolean> {
        return Object.fromEntries(this.flags);
    }
}

export const featureFlags = new FeatureFlagService();
