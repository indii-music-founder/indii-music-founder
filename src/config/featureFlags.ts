/**
 * Feature Flags Service
 *
 * Wraps Firebase Remote Config for runtime feature toggles.
 * Allows gradual rollouts without redeploying.
 *
 * Usage:
 *   import { featureFlags } from '@/config/featureFlags';
 *   if (featureFlags.isEnabled('enable_merch_store')) { ... }
 *
 * React Usage:
 *   import { useFeatureFlag } from '@/config/featureFlags';
 *   const isMerchEnabled = useFeatureFlag('enable_merch_store');
 */

import { Logger } from '@/core/logger/Logger';
import { useSyncExternalStore } from 'react';
import type { ModuleId } from '@/core/constants';

// ============================================================================
// Feature Flag Names — typed constants to prevent typos
// ============================================================================

export const FEATURE_FLAG_NAMES = {
    // ---- Platform capabilities ----
    APP_CHECK: 'enable_app_check',
    VIDEO_INTERPOLATION: 'enable_video_interpolation',
    AI_VOICE: 'enable_ai_voice',
    DDEX_EXPORT: 'enable_ddex_export',
    SOCIAL_FEED: 'enable_social_feed',
    KNOWLEDGE_API: 'enable_knowledge_api',
    DESKTOP_AUTO_UPDATE: 'enable_desktop_auto_update',
    ADVANCED_AUDIO_ANALYSIS: 'enable_advanced_audio_analysis',
    MAINTENANCE_MODE: 'maintenance_mode',

    // ---- Pre-launch gates (disabled by default) ----
    // These modules require external API keys or service setup not yet
    // configured for launch. They are hidden from the sidebar until ready.
    WEB3: 'enable_web3',
    MERCH_STORE: 'enable_merch_store',
    MARKETPLACE: 'enable_marketplace',
    SOCIAL_POSTING: 'enable_social_posting',
    AVATAR_GENERATION: 'enable_avatar_generation',
} as const;

export type FeatureFlagName = typeof FEATURE_FLAG_NAMES[keyof typeof FEATURE_FLAG_NAMES];

// ============================================================================
// Defaults — used when Remote Config is unavailable
// ============================================================================

const DEFAULTS: Record<string, boolean> = {
    // Platform capabilities (enabled)
    [FEATURE_FLAG_NAMES.APP_CHECK]: false,
    [FEATURE_FLAG_NAMES.VIDEO_INTERPOLATION]: true,
    [FEATURE_FLAG_NAMES.AI_VOICE]: true,
    [FEATURE_FLAG_NAMES.DDEX_EXPORT]: true,
    [FEATURE_FLAG_NAMES.SOCIAL_FEED]: true,
    [FEATURE_FLAG_NAMES.KNOWLEDGE_API]: true,
    [FEATURE_FLAG_NAMES.DESKTOP_AUTO_UPDATE]: false,
    [FEATURE_FLAG_NAMES.ADVANCED_AUDIO_ANALYSIS]: true,
    [FEATURE_FLAG_NAMES.MAINTENANCE_MODE]: false,

    // Pre-launch gates (disabled by default — require external API keys)
    [FEATURE_FLAG_NAMES.WEB3]: false,
    [FEATURE_FLAG_NAMES.MERCH_STORE]: false,
    [FEATURE_FLAG_NAMES.MARKETPLACE]: false,
    [FEATURE_FLAG_NAMES.SOCIAL_POSTING]: false,
    [FEATURE_FLAG_NAMES.AVATAR_GENERATION]: false,
};

// ============================================================================
// Gated Module Mapping — which flags control which sidebar modules
// ============================================================================

/**
 * Maps feature flag names to the module IDs they gate.
 * When a flag is disabled, ALL mapped modules are hidden from the sidebar
 * and blocked in the ModuleRenderer.
 */
export const GATED_MODULES: Record<string, ModuleId[]> = {
    // Note: WEB3 flag exists but has no corresponding sidebar ModuleId —
    // Web3 services are only consumed internally by agent tools.
    [FEATURE_FLAG_NAMES.MERCH_STORE]: ['merch'],
    [FEATURE_FLAG_NAMES.MARKETPLACE]: ['marketplace'],
};

/**
 * Returns the set of module IDs that are currently gated off.
 * Use this to filter sidebar items and block direct navigation.
 */
export function getGatedModuleIds(): Set<ModuleId> {
    const gated = new Set<ModuleId>();
    for (const [flag, moduleIds] of Object.entries(GATED_MODULES)) {
        if (!featureFlags.isEnabled(flag)) {
            for (const id of moduleIds) {
                gated.add(id);
            }
        }
    }
    return gated;
}

// ============================================================================
// Feature Flag Service
// ============================================================================

type FlagListener = () => void;

class FeatureFlagService {
    private flags: Map<string, boolean> = new Map();
    private initialized = false;
    private version = 0; // Incremented on every flag change for React subscriptions
    private listeners: Set<FlagListener> = new Set();

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
            this.version++;
            this.notifyListeners();
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
     * Override a flag at runtime (useful for dev/debug).
     * Does NOT persist — reset on page reload.
     */
    override(flag: string, value: boolean): void {
        this.flags.set(flag, value);
        this.version++;
        this.notifyListeners();
        Logger.info('FeatureFlags', `Override: ${flag} = ${value}`);
    }

    /**
     * Get all current flag values (for debugging).
     */
    getAll(): Record<string, boolean> {
        return Object.fromEntries(this.flags);
    }

    /**
     * Get the current version number (for React subscriptions).
     */
    getVersion(): number {
        return this.version;
    }

    /**
     * Subscribe to flag changes (for useSyncExternalStore).
     */
    subscribe(listener: FlagListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const featureFlags = new FeatureFlagService();

// ============================================================================
// React Hook — subscribes to flag changes reactively
// ============================================================================

/**
 * React hook that returns the current value of a feature flag.
 * Re-renders the component when the flag value changes (e.g., after Remote Config fetch).
 *
 * @example
 * const isMerchEnabled = useFeatureFlag('enable_merch_store');
 * if (!isMerchEnabled) return <ComingSoon />;
 */
export function useFeatureFlag(flag: FeatureFlagName): boolean {
    return useSyncExternalStore(
        (callback) => featureFlags.subscribe(callback),
        () => featureFlags.isEnabled(flag),
        () => DEFAULTS[flag] ?? false // Server snapshot for SSR
    );
}

/**
 * React hook that returns the set of currently gated module IDs.
 * Re-renders when any flag changes.
 */
export function useGatedModules(): Set<ModuleId> {
    const version = useSyncExternalStore(
        (callback) => featureFlags.subscribe(callback),
        () => featureFlags.getVersion(),
        () => 0
    );
    // version is used to trigger re-computation
    void version;
    return getGatedModuleIds();
}
