import { describe, it, expect } from 'vitest';
import { MembershipService } from './MembershipService';

describe('MembershipService', () => {
    it('should return correct video duration limits by tier', () => {
        expect(MembershipService.getMaxVideoDurationSeconds('free')).toBe(8 * 60); // 8 minutes
        expect(MembershipService.getMaxVideoDurationSeconds('pro')).toBe(60 * 60); // 60 minutes
        expect(MembershipService.getMaxVideoDurationSeconds('enterprise')).toBe(4 * 60 * 60); // 4 hours
    });

    it('should calculate max frames based on fps and duration', () => {
        const freeFrames = MembershipService.getMaxVideoDurationFrames('free', 30);
        expect(freeFrames).toBe(8 * 60 * 30); // 8 min * 60 sec * 30 fps

        const proFrames = MembershipService.getMaxVideoDurationFrames('pro', 30);
        expect(proFrames).toBe(60 * 60 * 30); // 60 min * 60 sec * 30 fps
    });

    it('should return correct daily image limits via getLimits', () => {
        const freeLimits = MembershipService.getLimits('free');
        const proLimits = MembershipService.getLimits('pro');
        const enterpriseLimits = MembershipService.getLimits('enterprise');

        expect(freeLimits.maxImagesPerDay).toBe(50);
        expect(proLimits.maxImagesPerDay).toBe(500);
        expect(enterpriseLimits.maxImagesPerDay).toBe(5000);
    });

    it('should format duration in readable format', () => {
        expect(MembershipService.formatDuration(60)).toContain('1');
        expect(MembershipService.formatDuration(3600)).toContain('1');
        expect(MembershipService.formatDuration(480)).toContain('8');
    });

    it('should provide tier display names', () => {
        expect(MembershipService.getTierDisplayName('free')).toBe('Free');
        expect(MembershipService.getTierDisplayName('pro')).toBe('Pro');
        expect(MembershipService.getTierDisplayName('enterprise')).toBe('Enterprise');
    });

    it('should provide upgrade messages', () => {
        const freeMsg = MembershipService.getUpgradeMessage('free', 'video');
        expect(freeMsg).toMatch(/Upgrade/i);
        expect(freeMsg).toContain('Pro');
    });
});
