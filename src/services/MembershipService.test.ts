import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService, TIER_LIMITS, MembershipTier, TierLimits } from './MembershipService';

describe('MembershipService', () => {
    describe('getLimits', () => {
        it('returns correct limits for free tier', () => {
            const limits = MembershipService.getLimits('free');
            expect(limits.maxVideoDuration).toBe(8 * 60);
            expect(limits.maxVideoGenerationsPerDay).toBe(5);
            expect(limits.maxImagesPerDay).toBe(50);
            expect(limits.maxBatchSize).toBe(4);
            expect(limits.maxDesignResolution).toBe(1024);
            expect(limits.maxExportDPI).toBe(150);
            expect(limits.hasCMYKSupport).toBe(false);
            expect(limits.maxStorageMB).toBe(500);
            expect(limits.maxProjects).toBe(3);
            expect(limits.hasAdvancedEditing).toBe(false);
            expect(limits.hasCustomBranding).toBe(false);
            expect(limits.hasPriorityQueue).toBe(false);
            expect(limits.hasAPIAccess).toBe(false);
        });

        it('returns correct limits for pro tier', () => {
            const limits = MembershipService.getLimits('pro');
            expect(limits.maxVideoDuration).toBe(60 * 60);
            expect(limits.maxVideoGenerationsPerDay).toBe(50);
            expect(limits.maxImagesPerDay).toBe(500);
            expect(limits.maxBatchSize).toBe(16);
            expect(limits.maxDesignResolution).toBe(4096);
            expect(limits.maxExportDPI).toBe(300);
            expect(limits.hasCMYKSupport).toBe(true);
            expect(limits.maxStorageMB).toBe(10 * 1024);
            expect(limits.maxProjects).toBe(50);
            expect(limits.hasAdvancedEditing).toBe(true);
            expect(limits.hasCustomBranding).toBe(true);
            expect(limits.hasPriorityQueue).toBe(true);
            expect(limits.hasAPIAccess).toBe(false);
        });

        it('returns correct limits for enterprise tier', () => {
            const limits = MembershipService.getLimits('enterprise');
            expect(limits.maxVideoDuration).toBe(4 * 60 * 60);
            expect(limits.maxVideoGenerationsPerDay).toBe(500);
            expect(limits.maxImagesPerDay).toBe(5000);
            expect(limits.maxBatchSize).toBe(64);
            expect(limits.maxDesignResolution).toBe(8192);
            expect(limits.maxExportDPI).toBe(600);
            expect(limits.hasCMYKSupport).toBe(true);
            expect(limits.maxStorageMB).toBe(100 * 1024);
            expect(limits.maxProjects).toBe(-1); // Unlimited
            expect(limits.hasAdvancedEditing).toBe(true);
            expect(limits.hasCustomBranding).toBe(true);
            expect(limits.hasPriorityQueue).toBe(true);
            expect(limits.hasAPIAccess).toBe(true);
        });

        it('falls back to free tier for invalid tier', () => {
            const limits = MembershipService.getLimits('invalid' as MembershipTier);
            expect(limits).toEqual(TIER_LIMITS.free);
        });
    });

    describe('getMaxVideoDurationFrames', () => {
        it('calculates frames at 30fps', () => {
            expect(MembershipService.getMaxVideoDurationFrames('free', 30)).toBe(8 * 60 * 30);
            expect(MembershipService.getMaxVideoDurationFrames('pro', 30)).toBe(60 * 60 * 30);
            expect(MembershipService.getMaxVideoDurationFrames('enterprise', 30)).toBe(4 * 60 * 60 * 30);
        });

        it('calculates frames at 60fps', () => {
            expect(MembershipService.getMaxVideoDurationFrames('free', 60)).toBe(8 * 60 * 60);
            expect(MembershipService.getMaxVideoDurationFrames('pro', 60)).toBe(60 * 60 * 60);
        });

        it('uses 30fps as default', () => {
            expect(MembershipService.getMaxVideoDurationFrames('free')).toBe(8 * 60 * 30);
        });
    });

    describe('getMaxVideoDurationSeconds', () => {
        it('returns correct seconds for each tier', () => {
            expect(MembershipService.getMaxVideoDurationSeconds('free')).toBe(8 * 60);
            expect(MembershipService.getMaxVideoDurationSeconds('pro')).toBe(60 * 60);
            expect(MembershipService.getMaxVideoDurationSeconds('enterprise')).toBe(4 * 60 * 60);
        });
    });

    describe('isWithinVideoDurationLimit', () => {
        it('returns true when within limit', () => {
            expect(MembershipService.isWithinVideoDurationLimit('free', 60)).toBe(true);
            expect(MembershipService.isWithinVideoDurationLimit('free', 8 * 60)).toBe(true);
            expect(MembershipService.isWithinVideoDurationLimit('pro', 30 * 60)).toBe(true);
        });

        it('returns false when exceeding limit', () => {
            expect(MembershipService.isWithinVideoDurationLimit('free', 8 * 60 + 1)).toBe(false);
            expect(MembershipService.isWithinVideoDurationLimit('free', 60 * 60)).toBe(false);
            expect(MembershipService.isWithinVideoDurationLimit('pro', 60 * 60 + 1)).toBe(false);
        });

        it('returns true at exact limit boundary', () => {
            expect(MembershipService.isWithinVideoDurationLimit('free', 8 * 60)).toBe(true);
            expect(MembershipService.isWithinVideoDurationLimit('pro', 60 * 60)).toBe(true);
            expect(MembershipService.isWithinVideoDurationLimit('enterprise', 4 * 60 * 60)).toBe(true);
        });
    });

    describe('canUseFeature', () => {
        it('returns true for enabled boolean features', () => {
            expect(MembershipService.canUseFeature('pro', 'hasAdvancedEditing')).toBe(true);
            expect(MembershipService.canUseFeature('pro', 'hasCMYKSupport')).toBe(true);
            expect(MembershipService.canUseFeature('enterprise', 'hasAPIAccess')).toBe(true);
        });

        it('returns false for disabled boolean features', () => {
            expect(MembershipService.canUseFeature('free', 'hasAdvancedEditing')).toBe(false);
            expect(MembershipService.canUseFeature('free', 'hasCMYKSupport')).toBe(false);
            expect(MembershipService.canUseFeature('pro', 'hasAPIAccess')).toBe(false);
        });

        it('returns true for non-zero numeric features', () => {
            expect(MembershipService.canUseFeature('free', 'maxImagesPerDay')).toBe(true);
            expect(MembershipService.canUseFeature('free', 'maxProjects')).toBe(true);
        });

        it('handles enterprise unlimited projects (-1)', () => {
            expect(MembershipService.canUseFeature('enterprise', 'maxProjects')).toBe(true);
        });
    });

    describe('formatDuration', () => {
        it('formats seconds correctly', () => {
            expect(MembershipService.formatDuration(30)).toBe('30 seconds');
            expect(MembershipService.formatDuration(1)).toBe('1 seconds');
            expect(MembershipService.formatDuration(59)).toBe('59 seconds');
        });

        it('formats minutes correctly', () => {
            expect(MembershipService.formatDuration(60)).toBe('1 minutes');
            expect(MembershipService.formatDuration(120)).toBe('2 minutes');
            expect(MembershipService.formatDuration(8 * 60)).toBe('8 minutes');
            expect(MembershipService.formatDuration(59 * 60 + 59)).toBe('59 minutes');
        });

        it('formats hours correctly', () => {
            expect(MembershipService.formatDuration(3600)).toBe('1 hour');
            expect(MembershipService.formatDuration(7200)).toBe('2 hours');
            expect(MembershipService.formatDuration(4 * 3600)).toBe('4 hours');
        });

        it('formats hours with minutes correctly', () => {
            expect(MembershipService.formatDuration(3660)).toBe('1 hour 1 min');
            expect(MembershipService.formatDuration(3720)).toBe('1 hour 2 min');
            expect(MembershipService.formatDuration(7260)).toBe('2 hours 1 min');
        });
    });

    describe('getTierDisplayName', () => {
        it('returns correct display names', () => {
            expect(MembershipService.getTierDisplayName('free')).toBe('Free');
            expect(MembershipService.getTierDisplayName('pro')).toBe('Pro');
            expect(MembershipService.getTierDisplayName('enterprise')).toBe('Enterprise');
        });
    });

    describe('getUpgradeMessage', () => {
        it('suggests Pro upgrade for free users', () => {
            expect(MembershipService.getUpgradeMessage('free', 'video')).toBe('Upgrade to Pro for longer video durations');
            expect(MembershipService.getUpgradeMessage('free', 'images')).toBe('Upgrade to Pro for more image generations');
            expect(MembershipService.getUpgradeMessage('free', 'storage')).toBe('Upgrade to Pro for more storage space');
            expect(MembershipService.getUpgradeMessage('free', 'projects')).toBe('Upgrade to Pro for more projects');
            expect(MembershipService.getUpgradeMessage('free', 'resolution')).toBe('Upgrade to Pro for high-resolution 4K generation');
            expect(MembershipService.getUpgradeMessage('free', 'export')).toBe('Upgrade to Pro for professional CMYK/300DPI exports');
        });

        it('suggests Enterprise upgrade for pro users', () => {
            expect(MembershipService.getUpgradeMessage('pro', 'video')).toBe('Upgrade to Enterprise for longer video durations');
            expect(MembershipService.getUpgradeMessage('pro', 'images')).toBe('Upgrade to Enterprise for more image generations');
            expect(MembershipService.getUpgradeMessage('pro', 'storage')).toBe('Upgrade to Enterprise for more storage space');
        });
    });

    describe('TIER_LIMITS export', () => {
        it('exports all tiers', () => {
            expect(TIER_LIMITS).toHaveProperty('free');
            expect(TIER_LIMITS).toHaveProperty('pro');
            expect(TIER_LIMITS).toHaveProperty('enterprise');
        });

        it('has consistent structure across tiers', () => {
            const freeKeys = Object.keys(TIER_LIMITS.free);
            const proKeys = Object.keys(TIER_LIMITS.pro);
            const enterpriseKeys = Object.keys(TIER_LIMITS.enterprise);

            expect(freeKeys).toEqual(proKeys);
            expect(proKeys).toEqual(enterpriseKeys);
        });
    });

    describe('tier progression', () => {
        it('has increasing limits from free to enterprise', () => {
            const free = MembershipService.getLimits('free');
            const pro = MembershipService.getLimits('pro');
            const enterprise = MembershipService.getLimits('enterprise');

            // Video limits
            expect(pro.maxVideoDuration).toBeGreaterThan(free.maxVideoDuration);
            expect(enterprise.maxVideoDuration).toBeGreaterThan(pro.maxVideoDuration);

            // Image limits
            expect(pro.maxImagesPerDay).toBeGreaterThan(free.maxImagesPerDay);
            expect(enterprise.maxImagesPerDay).toBeGreaterThan(pro.maxImagesPerDay);

            // Storage limits
            expect(pro.maxStorageMB).toBeGreaterThan(free.maxStorageMB);
            expect(enterprise.maxStorageMB).toBeGreaterThan(pro.maxStorageMB);

            // Design resolution
            expect(pro.maxDesignResolution).toBeGreaterThan(free.maxDesignResolution);
            expect(enterprise.maxDesignResolution).toBeGreaterThan(pro.maxDesignResolution);

            // Export DPI
            expect(pro.maxExportDPI).toBeGreaterThan(free.maxExportDPI);
            expect(enterprise.maxExportDPI).toBeGreaterThan(pro.maxExportDPI);
        });
    });
});
