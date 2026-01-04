
import { VideoGeneration } from '../VideoGenerationService';
import { useStore } from '@/core/store';
import { MembershipService } from '@/services/MembershipService';
import { httpsCallable } from 'firebase/functions';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks
vi.mock('@/core/store');
vi.mock('@/services/MembershipService');
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
    functions: {},
    db: {}
}));
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(async () => ({ data: { success: true } })))
}));

// Helper to create mock profile with distributor
const createMockProfile = (distributor?: string) => ({
    uid: 'test-user',
    email: 'test@example.com',
    brandKit: distributor ? {
        socials: { distributor }
    } : undefined
} as any);

describe('VideoGenerationService - Distributor Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useStore.getState as any).mockReturnValue({ currentOrganizationId: 'org-1' });
        (MembershipService.checkQuota as any).mockResolvedValue({ allowed: true });
    });

    describe('Distributors with Canvas support (9:16)', () => {
        it('applies 9:16 for DistroKid Canvas', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBe('9:16');
            expect(callArgs.prompt).toContain('Optimized for Spotify Canvas');
        });

        it('applies 9:16 for TuneCore Canvas', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('tunecore')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBe('9:16');
            expect(callArgs.prompt).toContain('Optimized for Spotify Canvas');
        });
    });

    describe('Distributors without Canvas support', () => {
        it('does NOT apply Canvas constraints for CD Baby', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('cdbaby')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBeUndefined();
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for Ditto', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('ditto')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBeUndefined();
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for AWAL', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('awal')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBeUndefined();
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for UnitedMasters', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('unitedmasters')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBeUndefined();
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('does NOT apply Canvas constraints for Amuse', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('amuse')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBeUndefined();
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });
    });

    describe('Edge cases', () => {
        it('falls back to defaults when no distributor configured', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile() // No distributor
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBeUndefined();
            expect(callArgs.prompt).not.toContain('Optimized for Spotify Canvas');
        });

        it('falls back to defaults when no userProfile provided', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video'
                // No userProfile at all
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBeUndefined();
        });

        it('explicit aspectRatio overrides distributor default', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                aspectRatio: '16:9', // Explicit override
                userProfile: createMockProfile('distrokid') // Would normally be 9:16
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBe('16:9');
        });

        it('handles unknown distributor gracefully', async () => {
            const mockTriggerVideoJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerVideoJob as any);

            await VideoGeneration.generateVideo({
                prompt: 'A cool video',
                userProfile: createMockProfile('unknown_distributor')
            });

            const callArgs = mockTriggerVideoJob.mock.calls[0][0];
            // Should NOT crash, just use defaults
            expect(callArgs.aspectRatio).toBeUndefined();
        });
    });

    describe('Long-form video generation', () => {
        it('applies distributor constraints to long-form videos', async () => {
            const mockTriggerLongFormJob = vi.fn().mockResolvedValue({ data: { success: true } });
            vi.mocked(httpsCallable).mockReturnValue(mockTriggerLongFormJob as any);
            (MembershipService.checkVideoDurationQuota as any).mockResolvedValue({ allowed: true });

            await VideoGeneration.generateLongFormVideo({
                prompt: 'A long video',
                totalDuration: 30,
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockTriggerLongFormJob.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBe('9:16');
            // Prompt segments should contain Canvas optimization
            expect(callArgs.prompts[0]).toContain('Optimized for Spotify Canvas');
        });
    });
});
