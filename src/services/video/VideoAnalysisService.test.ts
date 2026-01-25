
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoAnalysisService } from './VideoAnalysisService';
import { firebaseAI } from '../ai/FirebaseAIService';
import { Part } from 'firebase/ai';

// Mock dependencies
vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateStructuredData: vi.fn(),
    },
}));

describe('VideoAnalysisService', () => {
    let service: VideoAnalysisService;

    beforeEach(() => {
        service = VideoAnalysisService.getInstance();
        vi.clearAllMocks();
    });

    describe('Video Part Generation', () => {
        it('should handle gs:// URIs correctly', async () => {
            // We can't test private method getVideoPart directly without casting or reflection,
            // but we can verify what is passed to generateStructuredData
            const mockResult = { scenes: [], suggestedCuts: [] };
            vi.mocked(firebaseAI.generateStructuredData).mockResolvedValue(mockResult);

            await service.detectScenes('gs://bucket/video.mp4');

            const callArgs = vi.mocked(firebaseAI.generateStructuredData).mock.calls[0];
            const promptParts = callArgs[0] as Part[];
            const videoPart = promptParts[1] as any;

            expect(videoPart.fileData).toBeDefined();
            expect(videoPart.fileData.fileUri).toBe('gs://bucket/video.mp4');
            expect(videoPart.fileData.mimeType).toBe('video/mp4');
        });

        it('should handle data: URIs correctly', async () => {
            const mockResult = { scenes: [], suggestedCuts: [] };
            vi.mocked(firebaseAI.generateStructuredData).mockResolvedValue(mockResult);

            await service.detectScenes('data:video/mp4;base64,abcdef');

            const callArgs = vi.mocked(firebaseAI.generateStructuredData).mock.calls[0];
            const promptParts = callArgs[0] as Part[];
            const videoPart = promptParts[1] as any;

            expect(videoPart.inlineData).toBeDefined();
            expect(videoPart.inlineData.mimeType).toBe('video/mp4');
            expect(videoPart.inlineData.data).toBe('abcdef');
        });
    });

    describe('Scene Detection', () => {
        it('should validate AI response against schema', async () => {
            const mockResponse = {
                scenes: [{
                    startTime: 0,
                    endTime: 10,
                    description: 'Intro',
                    dominantColors: ['#FF0000'],
                    sentiment: 'positive',
                    keyObjects: ['Logo']
                }],
                suggestedCuts: []
            };

            vi.mocked(firebaseAI.generateStructuredData).mockResolvedValue(mockResponse);

            const result = await service.detectScenes('gs://test.mp4');

            expect(result).toEqual(mockResponse);
            expect(firebaseAI.generateStructuredData).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining('detect distinct scenes') })]),
                expect.any(Object), // Schema
                undefined,
                undefined,
                expect.stringContaining('gemini')
            );
        });

        it('should throw if validation fails', async () => {
            const invalidResponse = {
                scenes: [{
                    startTime: -1, // Invalid negative time
                    endTime: 10,
                }]
            };

            vi.mocked(firebaseAI.generateStructuredData).mockResolvedValue(invalidResponse);

            await expect(service.detectScenes('gs://test.mp4')).rejects.toThrow();
        });
    });

    describe('Video Metadata', () => {
        it('should extract metadata correctly', async () => {
            const mockMetadata = {
                duration: 120,
                resolution: { width: 1920, height: 1080 },
                fps: 30,
                hasAudio: true,
                dominantColors: ['#000000'],
                suggestedTags: ['tech']
            };

            vi.mocked(firebaseAI.generateStructuredData).mockResolvedValue(mockMetadata);

            const result = await service.extractMetadata('gs://test.mp4');
            expect(result).toEqual(mockMetadata);
        });
    });
});
