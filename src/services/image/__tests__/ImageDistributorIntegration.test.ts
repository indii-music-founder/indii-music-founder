import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageGeneration, ImageGenerationOptions } from '../ImageGenerationService';
import { MembershipService } from '@/services/MembershipService';
import { httpsCallable } from 'firebase/functions';
import type { UserProfile } from '@/modules/workflow/types';

// Mocks
vi.mock('@/services/MembershipService');
vi.mock('@/services/firebase', () => ({
    functions: {},
    auth: { currentUser: { uid: 'test-user' } }
}));
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn(async () => ({
        data: {
            images: [{ id: 'img-1', url: 'https://example.com/image.png' }]
        }
    })))
}));
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user' }
        })
    }
}));

// Helper to create mock profile with distributor
const createMockProfile = (distributor?: string): UserProfile => ({
    uid: 'test-user',
    email: 'test@example.com',
    brandKit: distributor ? {
        socials: { distributor }
    } : undefined
} as UserProfile);

describe('ImageGenerationService - Distributor Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (MembershipService.checkQuota as any).mockResolvedValue({ allowed: true });
    });

    describe('Cover Art Generation', () => {
        it('enforces 1:1 aspect ratio when isCoverArt is true', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'Album cover art',
                isCoverArt: true,
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBe('1:1');
        });

        it('includes distributor requirements in prompt for cover art', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'Album cover art',
                isCoverArt: true,
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            expect(callArgs.prompt).toContain('COVER ART REQUIREMENTS');
            expect(callArgs.prompt).toContain('3000x3000');
            expect(callArgs.prompt).toContain('square');
        });

        it('includes distributor context in project context', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'Album cover art',
                isCoverArt: true,
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            // Full prompt should include distributor context
            expect(callArgs.prompt).toContain('DistroKid');
        });
    });

    describe('Non-Cover Art Generation', () => {
        it('does NOT enforce 1:1 when isCoverArt is false', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'A landscape scene',
                aspectRatio: '16:9',
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBe('16:9');
        });

        it('does NOT inject cover art requirements when isCoverArt is false', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'A landscape scene',
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            expect(callArgs.prompt).not.toContain('COVER ART REQUIREMENTS');
        });
    });

    describe('getDistributorConstraints', () => {
        it('returns 3000x3000 for DistroKid', () => {
            const constraints = ImageGeneration.getDistributorConstraints(createMockProfile('distrokid'));

            expect(constraints.width).toBe(3000);
            expect(constraints.height).toBe(3000);
            expect(constraints.aspectRatio).toBe('1:1');
        });

        it('returns 3000x3000 for TuneCore', () => {
            const constraints = ImageGeneration.getDistributorConstraints(createMockProfile('tunecore'));

            expect(constraints.width).toBe(3000);
            expect(constraints.height).toBe(3000);
        });

        it('returns industry defaults when no distributor', () => {
            const constraints = ImageGeneration.getDistributorConstraints(createMockProfile());

            expect(constraints.width).toBe(3000);
            expect(constraints.height).toBe(3000);
        });
    });

    describe('Edge Cases', () => {
        it('works without userProfile', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            // Should not throw
            await ImageGeneration.generateImages({
                prompt: 'A simple image'
            });

            expect(mockGenerateImage).toHaveBeenCalled();
        });

        it('explicit aspectRatio is respected even for cover art when isCoverArt is not set', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'Album cover',
                aspectRatio: '4:3', // Explicit but not isCoverArt mode
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            expect(callArgs.aspectRatio).toBe('4:3');
        });

        it('handles unknown distributor gracefully', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            // Should not throw
            await ImageGeneration.generateImages({
                prompt: 'Album cover',
                isCoverArt: true,
                userProfile: createMockProfile('unknown_distributor')
            });

            expect(mockGenerateImage).toHaveBeenCalled();
        });
    });

    describe('Distributor-Specific Requirements', () => {
        it('includes DistroKid-specific context', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'Album cover',
                isCoverArt: true,
                userProfile: createMockProfile('distrokid')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            expect(callArgs.prompt).toContain('3000x3000');
            expect(callArgs.prompt).toContain('RGB');
        });

        it('includes TuneCore-specific context', async () => {
            const mockGenerateImage = vi.fn().mockResolvedValue({
                data: { images: [{ id: 'img-1', url: 'https://example.com/image.png' }] }
            });
            vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);

            await ImageGeneration.generateImages({
                prompt: 'Album cover',
                isCoverArt: true,
                userProfile: createMockProfile('tunecore')
            });

            const callArgs = mockGenerateImage.mock.calls[0][0];
            expect(callArgs.prompt).toContain('3000x3000');
        });
    });
});
