import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the Logger to avoid side effects
vi.mock('@/core/logger/Logger', () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// We re-import for each test to get a fresh FeatureFlagService instance.
// The module-level singleton is created at import time with defaults loaded.

describe('FeatureFlagService', () => {
    let featureFlags: typeof import('@/config/featureFlags').featureFlags;
    let FEATURE_FLAG_NAMES: typeof import('@/config/featureFlags').FEATURE_FLAG_NAMES;
    let getGatedModuleIds: typeof import('@/config/featureFlags').getGatedModuleIds;
    let useFeatureFlag: typeof import('@/config/featureFlags').useFeatureFlag;
    let useGatedModules: typeof import('@/config/featureFlags').useGatedModules;
    let GATED_MODULES: typeof import('@/config/featureFlags').GATED_MODULES;

    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('@/config/featureFlags');
        featureFlags = mod.featureFlags;
        FEATURE_FLAG_NAMES = mod.FEATURE_FLAG_NAMES;
        getGatedModuleIds = mod.getGatedModuleIds;
        useFeatureFlag = mod.useFeatureFlag;
        useGatedModules = mod.useGatedModules;
        GATED_MODULES = mod.GATED_MODULES;
    });

    describe('defaults', () => {
        it('loads platform capability flags as enabled by default', () => {
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.VIDEO_INTERPOLATION)).toBe(true);
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.AI_VOICE)).toBe(true);
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.DDEX_EXPORT)).toBe(true);
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.SOCIAL_FEED)).toBe(true);
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.KNOWLEDGE_API)).toBe(true);
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.ADVANCED_AUDIO_ANALYSIS)).toBe(true);
        });

        it('loads pre-launch gates with correct defaults', () => {
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.WEB3)).toBe(false);
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.MERCH_STORE)).toBe(true); // enabled by default
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.MARKETPLACE)).toBe(false);
        });

        it('returns false for unknown flags', () => {
            expect(featureFlags.isEnabled('nonexistent_flag')).toBe(false);
        });
    });

    describe('override', () => {
        it('overrides a flag value at runtime', () => {
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.WEB3)).toBe(false);
            featureFlags.override(FEATURE_FLAG_NAMES.WEB3, true);
            expect(featureFlags.isEnabled(FEATURE_FLAG_NAMES.WEB3)).toBe(true);
        });

        it('increments version on override', () => {
            const v1 = featureFlags.getVersion();
            featureFlags.override(FEATURE_FLAG_NAMES.WEB3, true);
            expect(featureFlags.getVersion()).toBe(v1 + 1);
        });

        it('notifies listeners on override', () => {
            const listener = vi.fn();
            featureFlags.subscribe(listener);
            featureFlags.override(FEATURE_FLAG_NAMES.WEB3, true);
            expect(listener).toHaveBeenCalledOnce();
        });
    });

    describe('subscribe/unsubscribe', () => {
        it('subscribes and receives notifications', () => {
            const listener = vi.fn();
            featureFlags.subscribe(listener);
            featureFlags.override(FEATURE_FLAG_NAMES.WEB3, true);
            featureFlags.override(FEATURE_FLAG_NAMES.MERCH_STORE, true);
            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('unsubscribes correctly', () => {
            const listener = vi.fn();
            const unsub = featureFlags.subscribe(listener);
            unsub();
            featureFlags.override(FEATURE_FLAG_NAMES.WEB3, true);
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('getAll', () => {
        it('returns all flag values as a record', () => {
            const all = featureFlags.getAll();
            expect(all[FEATURE_FLAG_NAMES.WEB3]).toBe(false);
            expect(all[FEATURE_FLAG_NAMES.VIDEO_INTERPOLATION]).toBe(true);
            expect(typeof all).toBe('object');
        });
    });

    describe('getGatedModuleIds', () => {
        it('returns gated modules when flags are disabled (default state)', () => {
            const gated = getGatedModuleIds();
            expect(gated.has('merch')).toBe(false); // MERCH_STORE is enabled by default, so merch is not gated
            expect(gated.has('marketplace')).toBe(true);
        });

        it('removes modules from gated set when their flag is enabled', () => {
            featureFlags.override(FEATURE_FLAG_NAMES.MERCH_STORE, true);
            const gated = getGatedModuleIds();
            expect(gated.has('merch')).toBe(false);
            expect(gated.has('marketplace')).toBe(true);
        });

        it('returns empty set when all gated flags are enabled', () => {
            featureFlags.override(FEATURE_FLAG_NAMES.MERCH_STORE, true);
            featureFlags.override(FEATURE_FLAG_NAMES.MARKETPLACE, true);
            const gated = getGatedModuleIds();
            expect(gated.size).toBe(0);
        });

        it('does not gate non-mapped modules like dashboard', () => {
            const gated = getGatedModuleIds();
            expect(gated.has('dashboard')).toBe(false);
            expect(gated.has('creative')).toBe(false);
            expect(gated.has('video')).toBe(false);
        });
    });

    describe('GATED_MODULES mapping', () => {
        it('maps MERCH_STORE to merch module', () => {
            expect(GATED_MODULES[FEATURE_FLAG_NAMES.MERCH_STORE]).toEqual(['merch']);
        });

        it('maps MARKETPLACE to marketplace module', () => {
            expect(GATED_MODULES[FEATURE_FLAG_NAMES.MARKETPLACE]).toEqual(['marketplace']);
        });

        it('does not map WEB3 (no sidebar module)', () => {
            expect(GATED_MODULES[FEATURE_FLAG_NAMES.WEB3]).toBeUndefined();
        });
    });

    describe('FEATURE_FLAG_NAMES', () => {
        it('has all expected pre-launch gate keys', () => {
            expect(FEATURE_FLAG_NAMES.WEB3).toBe('enable_web3');
            expect(FEATURE_FLAG_NAMES.MERCH_STORE).toBe('enable_merch_store');
            expect(FEATURE_FLAG_NAMES.MARKETPLACE).toBe('enable_marketplace');
        });

        it('has all expected platform capability keys', () => {
            expect(FEATURE_FLAG_NAMES.APP_CHECK).toBe('enable_app_check');
            expect(FEATURE_FLAG_NAMES.VIDEO_INTERPOLATION).toBe('enable_video_interpolation');
            expect(FEATURE_FLAG_NAMES.MAINTENANCE_MODE).toBe('maintenance_mode');
        });
    });

    describe('useFeatureFlag hook', () => {
        it('returns the current flag value', () => {
            const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAG_NAMES.MERCH_STORE));
            expect(result.current).toBe(true); // MERCH_STORE enabled by default
        });

        it('re-renders when the flag value changes via override', () => {
            const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAG_NAMES.MERCH_STORE));
            expect(result.current).toBe(true); // MERCH_STORE enabled by default

            act(() => {
                featureFlags.override(FEATURE_FLAG_NAMES.MERCH_STORE, false);
            });

            expect(result.current).toBe(false);
        });

        it('returns true for enabled platform flags', () => {
            const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAG_NAMES.VIDEO_INTERPOLATION));
            expect(result.current).toBe(true);
        });
    });

    describe('useGatedModules hook', () => {
        it('returns the set of gated module IDs', () => {
            const { result } = renderHook(() => useGatedModules());
            expect(result.current.has('merch')).toBe(false); // MERCH_STORE enabled by default, not gated
            expect(result.current.has('marketplace')).toBe(true);
        });

        it('updates when a gate flag is toggled', () => {
            const { result } = renderHook(() => useGatedModules());
            expect(result.current.has('merch')).toBe(false); // MERCH_STORE enabled by default

            act(() => {
                featureFlags.override(FEATURE_FLAG_NAMES.MERCH_STORE, false);
            });

            expect(result.current.has('merch')).toBe(true); // now gated
            expect(result.current.has('marketplace')).toBe(true);
        });

        it('returns empty set when all gates are enabled', () => {
            const { result } = renderHook(() => useGatedModules());

            act(() => {
                featureFlags.override(FEATURE_FLAG_NAMES.MERCH_STORE, true);
                featureFlags.override(FEATURE_FLAG_NAMES.MARKETPLACE, true);
            });

            expect(result.current.size).toBe(0);
        });
    });
});
