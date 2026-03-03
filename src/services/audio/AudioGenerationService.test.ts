import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioGenerationService } from './AudioGenerationService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { CloudStorageService } from '@/services/CloudStorageService';
import { audioPersistenceService } from '@/services/audio/AudioPersistenceService';
import { audioAnalysisService } from '@/services/audio/AudioAnalysisService';
import { useStore } from '@/core/store';

// --- Mocks ---

const mockAddGeneratedAsset = vi.fn();

// Precise mock for Gemini response structure
const mockRawResponse = {
    response: {
        candidates: [
            {
                content: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'audio/wav',
                                data: 'mock_base64_data',
                            }
                        }
                    ]
                }
            }
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
        text: () => '',
        inlineDataParts: [],
        functionCalls: [],
        thoughtSummary: ''
    }
};

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        rawGenerateContent: vi.fn(),
    }
}));

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        uploadAudio: vi.fn().mockResolvedValue('https://mock.storage/audio.wav'),
        dataURItoBlob: vi.fn().mockResolvedValue(new Blob(['mock audio'], { type: 'audio/wav' })),
    }
}));

vi.mock('@/services/audio/AudioPersistenceService', () => ({
    audioPersistenceService: {
        saveAudioMetadata: vi.fn().mockResolvedValue(undefined),
    }
}));

vi.mock('@/services/audio/AudioAnalysisService', () => ({
    audioAnalysisService: {
        analyze: vi.fn(),
        analyzeDeep: vi.fn().mockResolvedValue({
            features: { bpm: 120, key: 'C', energy: 0.8, loudness: -12 },
            fromCache: false,
        }),
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user' } },
}));

// Mock Zustand Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            addGeneratedAsset: mockAddGeneratedAsset,
        })),
    }
}));

describe('AudioGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should coordinate generation, upload, and persistence for SoundFX', async () => {
        // 1. Setup mock result from AI
        vi.mocked(firebaseAI.rawGenerateContent).mockResolvedValueOnce(mockRawResponse as any);

        // 2. Run service
        const result = await audioGenerationService.generateSoundFX({
            prompt: 'Explosion',
            durationSeconds: 5,
            analyze: true,
        });

        // 3. Verifications
        expect(firebaseAI.rawGenerateContent).toHaveBeenCalled();
        expect(CloudStorageService.uploadAudio).toHaveBeenCalledWith(
            'data:audio/wav;base64,mock_base64_data',
            expect.any(String),
            'test-user',
            'audio/wav'
        );
        expect(audioPersistenceService.saveAudioMetadata).toHaveBeenCalled();
        expect(mockAddGeneratedAsset).toHaveBeenCalled();

        expect(result.storageUrl).toBe('https://mock.storage/audio.wav');
        expect(result.bpm).toBe(120); // From mocked analysis
        expect(result.key).toBe('C');
    });

    it('should coordinate generation for Music', async () => {
        vi.mocked(firebaseAI.rawGenerateContent).mockResolvedValueOnce(mockRawResponse as any);

        const result = await audioGenerationService.generateMusic({
            prompt: 'Epic Orchestral',
            genre: 'Cinematic',
            mood: 'Epic',
            tempo: 'fast',
            durationSeconds: 30,
            analyze: true
        });

        expect(firebaseAI.rawGenerateContent).toHaveBeenCalled();
        expect(CloudStorageService.uploadAudio).toHaveBeenCalled();
        expect(result.bpm).toBe(120);
    });

    it('should coordinate generation for TTS', async () => {
        vi.mocked(firebaseAI.rawGenerateContent).mockResolvedValueOnce(mockRawResponse as any);

        const result = await audioGenerationService.generateTTS({
            text: 'Hello world',
            voicePreset: 'Kore',
            analyze: false
        });

        expect(firebaseAI.rawGenerateContent).toHaveBeenCalled();
        expect(CloudStorageService.uploadAudio).toHaveBeenCalled();
        expect(result.bpm).toBeUndefined(); // Analyze was false
    });
});
