import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseIntelligenceService } from '../FirebaseIntelligenceService';

// Hoist mocks
const { mockGenerateSpeech, mockHttpsCallable } = vi.hoisted(() => {
    const callable = vi.fn();
    return {
        mockGenerateSpeech: callable,
        mockHttpsCallable: vi.fn(() => callable),
    };
});
const { mockResolveStorageUrl } = vi.hoisted(() => ({
    mockResolveStorageUrl: vi.fn(async () => 'https://storage.example/audio.wav'),
}));

// Mock Firebase Service
vi.mock('@/services/firebase', () => ({
    getFirebaseAI: vi.fn(() => ({})), // Return truthy to simulate "App Check Configured" or at least normal mode intent
    functions: {},
    ai: {},
    remoteConfig: {},
    auth: { currentUser: { uid: 'user-123' } },
    db: {},
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mockHttpsCallable
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: mockResolveStorageUrl,
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({ asString: () => '' }))
}));

vi.mock('@/config/env', () => ({
    env: {
        VITE_API_KEY: 'mock-key',
        apiKey: 'mock-key',
        appCheckKey: 'test-app-check-key'
    }
}));

vi.mock('../appcheck', () => ({
    isAppCheckConfigured: () => true,
    isAppCheckError: vi.fn()
}));

vi.mock('../billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(undefined),
        trackUsage: vi.fn().mockResolvedValue(undefined)
    }
}));

describe('Voice Interface QA', () => {
    let service: FirebaseIntelligenceService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateSpeech.mockResolvedValue({
            data: {
                mimeType: 'audio/wav',
                jobId: 'audio-job-1',
                libraryAssetId: 'audio-job-1',
                resultUri: 'gs://test-bucket/creative/user-123/audio/outputs/audio.wav'
            }
        });
        service = new FirebaseIntelligenceService();
    });

    it('should handle empty input gracefully', async () => {
        await expect(service.generateSpeech('', 'Kore'))
            .rejects.toThrow('Cannot generate speech for empty text');
    });

    it('should sanitize special characters', async () => {
        const result = await service.generateSpeech('Hello 🌍! @#$%^&*()', 'Kore');
        expect(result).toBeDefined();
        expect(result.audio.playbackUrl).toBe('https://storage.example/audio.wav');
        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'generateAudioV3');
        expect(mockGenerateSpeech).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'Hello 🌍! @#$%^&*()',
            voice: 'Kore',
            requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i)
        }));
    });

    it('should throw error on API failure', async () => {
        mockGenerateSpeech.mockRejectedValue(new Error('API Down'));

        await expect(service.generateSpeech('Hello', 'Kore'))
            .rejects.toThrow('API Down');
    });
});
