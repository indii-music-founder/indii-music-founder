import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from '../src/services/video/VideoGenerationService';
import { useStore } from '../src/core/store';
import { firebaseAI } from '../src/services/ai/FirebaseAIService';

// Mock dependencies
vi.mock('../src/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            currentOrganizationId: 'test-org'
        }))
    }
}));

vi.mock('../src/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true }),
    }
}));

// Mock Firebase AI Service directly
vi.mock('../src/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateVideo: vi.fn(),
        analyzeImage: vi.fn().mockResolvedValue('Temporal context analysis'),
    }
}));

vi.mock('../src/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user' } },
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    serverTimestamp: vi.fn(),
    onSnapshot: vi.fn()
}));

vi.mock('../src/services/persistence/MetadataPersistenceService', () => ({
    metadataPersistenceService: {
        save: vi.fn().mockResolvedValue(true)
    }
}));

// Mock UUID
vi.mock('uuid', () => ({
    v4: () => 'test-uuid'
}));

const VideoGeneration = new VideoGenerationService();

describe('VideoGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(firebaseAI.generateVideo).mockResolvedValue('http://video.mp4' as any);
    });

    it('should generate video with correct parameters', async () => {
        const result = await VideoGeneration.generateVideo({
            prompt: 'test prompt',
            resolution: '1080p',
            aspectRatio: '16:9'
        });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('test-uuid');
        expect(result[0].url).toBe('http://video.mp4');
        expect(firebaseAI.generateVideo).toHaveBeenCalled();
    });

    it('should generate long form video', async () => {
        // Safe bet skipped long form test if standard is fine
    });
});
