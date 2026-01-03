import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { firebaseAI } from '../../ai/FirebaseAIService';
import { httpsCallable } from 'firebase/functions';
import { MembershipService } from '@/services/MembershipService';

// Mock dependencies
vi.mock('../../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue("Mocked temporal analysis result.")
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user' }
    },
    db: {},
    functions: {}
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } }))
}));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        checkVideoDurationQuota: vi.fn().mockResolvedValue({ allowed: true, maxDuration: 3600, tierName: 'Pro' }),
        getCurrentTier: vi.fn().mockResolvedValue('pro'),
        getUpgradeMessage: vi.fn().mockReturnValue('Upgrade to Pro for more'),
    }
}));

describe('VideoGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateVideo', () => {
        it('should trigger video generation successfully', async () => {
            const result = await VideoGeneration.generateVideo({ prompt: 'test video' });

            expect(result).toHaveLength(1);
            expect(result[0].id).toBeDefined(); // UUID is generated dynamically
            expect(result[0].url).toBe(''); // Async job returns empty URL
            expect(httpsCallable).toHaveBeenCalled();
        });

        it('should throw error if quota is exceeded', async () => {
            vi.mocked(MembershipService.checkQuota).mockResolvedValueOnce({
                allowed: false,
                currentUsage: 10,
                maxAllowed: 10
            });

            await expect(VideoGeneration.generateVideo({ prompt: 'test video' }))
                .rejects.toThrow(/Quota exceeded/);
        });

        it('should analyze temporal context when firstFrame is provided', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'test video',
                firstFrame: 'data:image/png;base64,start'
            });

            expect(firebaseAI.analyzeImage).toHaveBeenCalled();
        });

        it('should handle long-form video generation', async () => {
            const result = await VideoGeneration.generateLongFormVideo({
                prompt: 'long video',
                totalDuration: 60
            });

            expect(result).toHaveLength(1);
            expect(result[0].id).toMatch(/^long_/);
            expect(result[0].url).toBe('');
        });
    });
});
