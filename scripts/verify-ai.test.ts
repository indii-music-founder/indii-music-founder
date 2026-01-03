
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../src/services/video/VideoGenerationService';
import { useStore } from '../src/core/store';

// Mock dependencies
vi.mock('../src/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            currentOrganizationId: 'test-org'
        }))
    }
}));

vi.mock('../src/services/MembershipService', () => ({
    MembershipService: {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
        checkVideoDurationQuota: vi.fn().mockResolvedValue({ allowed: true, maxDuration: 60, tierName: 'Pro' }),
        getCurrentTier: vi.fn().mockResolvedValue('pro')
    }
}));

// Mock Firebase functions
const mockHttpsCallable = vi.fn();
vi.mock('../src/services/firebase', () => ({
    functions: {},
    db: {},
    auth: { currentUser: { uid: 'test-user' } }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: (functions: any, name: string) => {
        return mockHttpsCallable;
    }
}));

// Mock UUID
vi.mock('uuid', () => ({
    v4: () => 'test-uuid'
}));

describe('VideoGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHttpsCallable.mockResolvedValue({ data: { jobId: 'test-job-id' } });
    });

    it('should generate video with correct parameters', async () => {
        const result = await VideoGeneration.generateVideo({
            prompt: 'test prompt',
            resolution: '1080p',
            aspectRatio: '16:9'
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('test-uuid');
        expect(mockHttpsCallable).toHaveBeenCalledWith({
            prompt: 'test prompt',
            resolution: '1080p',
            aspectRatio: '16:9',
            orgId: 'test-org',
            jobId: 'test-uuid'
        });
    });

    it('should generate long form video', async () => {
        const result = await VideoGeneration.generateLongFormVideo({
            prompt: 'long video',
            totalDuration: 20
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('long_test-uuid');
        // Check that it calls triggerLongFormVideoJob
        expect(mockHttpsCallable).toHaveBeenCalled();
    });
});
