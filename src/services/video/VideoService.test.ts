/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI service before importing VideoService
vi.mock('../ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn(),
        generateVideo: vi.fn(),
        parseJSON: vi.fn()
    },
    AI: {
        generateContent: vi.fn(),
        generateVideo: vi.fn(),
        parseJSON: vi.fn()
    }
}));

// Mock env
vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key',
        firebaseConfig: {}
    },
    firebaseConfig: {}
}));

// Mock AI models config
vi.mock('@/core/config/ai-models', () => ({
    APPROVED_MODELS: {
        TEXT_AGENT: 'gemini-3.1-pro-preview',
        TEXT_FAST: 'gemini-3.1-pro-preview',
        IMAGE_GEN: 'gemini-3-pro-image-preview',
        VIDEO_GEN: 'veo-3.1-generate-preview'
    },
    AI_MODELS: {
        TEXT: { AGENT: 'gemini-3.1-pro-preview', FAST: 'gemini-3.1-pro-preview' },
        VIDEO: { GENERATION: 'veo-3.1-generate-preview', EDIT: 'veo-3.1-generate-preview' }
    },
    AI_CONFIG: {
        THINKING: { HIGH: { thinkingConfig: { thinkingLevel: 'HIGH' } } }
    },
    IMAGE_FAST: 'gemini-3-pro-image-preview',
    AUDIO_PRO: 'gemini-3.1-pro-preview',
    AUDIO_FLASH: 'gemini-3.1-pro-preview',
    VIDEO_GEN: 'veo-3.1-generate-preview',
    BROWSER_AGENT: 'gemini-3.1-pro-preview',
    EMBEDDING_DEFAULT: 'gemini-embedding-001',
    validateModels: () => { },
    ModelIdSchema: { parse: (v: string) => v }
}));

// Mock MembershipService to avoid Firebase initialization
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        checkVideoDurationQuota: vi.fn().mockResolvedValue({ allowed: true, maxDuration: 60, tierName: 'Pro' }),
        getCurrentTier: vi.fn().mockResolvedValue('pro'),
        getUpgradeMessage: vi.fn().mockReturnValue('Upgrade please'),
        formatDuration: vi.fn().mockReturnValue('1 minute'),
        incrementUsage: vi.fn()
    },
    TIER_LIMITS: { free: {}, pro: {}, enterprise: {} }
}));

// Mock store to prevent side effects from dynamic imports
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            currentOrganizationId: 'test-org-id',
            userProfile: { id: 'test-user-id' }
        }))
    }
}));

import { Video, VideoService } from './VideoService';
import { GenAI as AI } from '../ai/GenAI';

describe('VideoService', () => {
    let service: VideoService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoService();
    });

    describe('generateMotionBrush', () => {
        const mockImage = { mimeType: 'image/png', data: 'base64ImageData' };
        const mockMask = { mimeType: 'image/png', data: 'base64MaskData' };

        it('should analyze image and generate motion video', async () => {
            // Mock the analysis response
            (AI.generateContent as any).mockResolvedValue({
                response: {
                    text: () => JSON.stringify({ video_prompt: 'Animate the water flowing' }),
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify({ video_prompt: 'Animate the water flowing' }) }]
                        }
                    }]
                }
            });
            (AI.parseJSON as any).mockReturnValue({ video_prompt: 'Animate the water flowing' });

            // Mock video generation
            (AI.generateVideo as any).mockResolvedValue('http://video-result.mp4');

            const result = await service.generateMotionBrush(mockImage, mockMask);

            expect(result).toBe('http://video-result.mp4');
            expect(AI.generateContent).toHaveBeenCalledTimes(1);
            expect(AI.generateVideo).toHaveBeenCalledTimes(1);
        });

        it('should use default prompt if analysis fails to return video_prompt', async () => {
            (AI.generateContent as any).mockResolvedValue({
                response: {
                    text: () => '{}',
                    candidates: [{
                        content: {
                            parts: [{ text: '{}' }]
                        }
                    }]
                }
            });
            (AI.parseJSON as any).mockReturnValue({});
            (AI.generateVideo as any).mockResolvedValue('http://video-result.mp4');

            const result = await service.generateMotionBrush(mockImage, mockMask);

            expect(result).toBe('http://video-result.mp4');
            // Should use "Animate" as fallback
            expect(AI.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'Animate'
                })
            );
        });

        it('should return null if video generation returns nothing', async () => {
            (AI.generateContent as any).mockResolvedValue({
                response: {
                    text: () => JSON.stringify({ video_prompt: 'test' }),
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify({ video_prompt: 'test' }) }]
                        }
                    }]
                }
            });
            (AI.parseJSON as any).mockReturnValue({ video_prompt: 'test' });
            (AI.generateVideo as any).mockResolvedValue(null);

            const result = await service.generateMotionBrush(mockImage, mockMask);

            expect(result).toBeNull();
        });

        it('should throw error if AI content generation fails', async () => {
            (AI.generateContent as any).mockRejectedValue(new Error('AI service unavailable'));

            await expect(service.generateMotionBrush(mockImage, mockMask))
                .rejects.toThrow('AI service unavailable');
        });

        it('should throw error if video generation fails', async () => {
            (AI.generateContent as any).mockResolvedValue({
                response: {
                    text: () => JSON.stringify({ video_prompt: 'test' }),
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify({ video_prompt: 'test' }) }]
                        }
                    }]
                }
            });
            (AI.parseJSON as any).mockReturnValue({ video_prompt: 'test' });
            (AI.generateVideo as any).mockRejectedValue(new Error('Video generation failed'));

            await expect(service.generateMotionBrush(mockImage, mockMask))
                .rejects.toThrow('Video generation failed');
        });
    });

    describe('generateVideo', () => {
        it('should generate video with basic options', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.mp4');

            const result = await service.generateVideo({
                prompt: 'A sunset over the ocean'
            });

            expect(result).toBe('http://video.mp4');
            expect(AI.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'A sunset over the ocean'
                })
            );
        });

        it('should handle custom resolution and aspect ratio', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.mp4');

            await service.generateVideo({
                prompt: 'test',
                resolution: '1080p',
                aspectRatio: '9:16'
            });

            expect(AI.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        resolution: '1080p',
                        aspectRatio: '9:16'
                    })
                })
            );
        });

        it('should include anchor images when provided', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.mp4');

            const anchors = [
                { mimeType: 'image/png', data: 'anchorData1' },
                { mimeType: 'image/jpeg', data: 'anchorData2' }
            ];

            await service.generateVideo({
                prompt: 'test',
                anchors
            });

            expect(AI.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        referenceImages: expect.arrayContaining([
                            expect.objectContaining({
                                referenceType: 'ASSET'
                            })
                        ])
                    })
                })
            );
        });

        it('should return null if no video generated', async () => {
            (AI.generateVideo as any).mockResolvedValue(null);

            const result = await service.generateVideo({ prompt: 'test' });

            expect(result).toBeNull();
        });

        it('should throw error on failure', async () => {
            (AI.generateVideo as any).mockRejectedValue(new Error('Generation error'));

            await expect(service.generateVideo({ prompt: 'test' }))
                .rejects.toThrow('Generation error');
        });

        it('should include input image when provided', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.mp4');

            const image = { mimeType: 'image/png', data: 'imageData' };

            await service.generateVideo({
                prompt: 'test',
                image
            });

            expect(AI.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    image: expect.objectContaining({
                        imageBytes: 'imageData',
                        mimeType: 'image/png'
                    })
                })
            );
        });
    });

    describe('generateKeyframeTransition', () => {
        const startImage = { mimeType: 'image/png', data: 'startData' };
        const endImage = { mimeType: 'image/png', data: 'endData' };

        it('should generate transition video between two keyframes', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://transition.mp4');

            const result = await service.generateKeyframeTransition(
                startImage,
                endImage,
                'Smooth morphing transition'
            );

            expect(result).toBe('http://transition.mp4');
            expect(AI.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'Smooth morphing transition',
                    image: expect.objectContaining({
                        imageBytes: 'startData'
                    }),
                    config: expect.objectContaining({
                        lastFrame: expect.stringContaining('base64')
                    })
                })
            );
        });

        it('should use default prompt if not provided', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://transition.mp4');

            await service.generateKeyframeTransition(startImage, endImage, '');

            expect(AI.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'Transition'
                })
            );
        });

        it('should return null if generation fails', async () => {
            (AI.generateVideo as any).mockResolvedValue(null);

            const result = await service.generateKeyframeTransition(
                startImage,
                endImage,
                'test'
            );

            expect(result).toBeNull();
        });

        it('should throw on error', async () => {
            (AI.generateVideo as any).mockRejectedValue(new Error('Transition failed'));

            await expect(
                service.generateKeyframeTransition(startImage, endImage, 'test')
            ).rejects.toThrow('Transition failed');
        });
    });

    describe('fetchVideoBlob', () => {
        beforeEach(() => {
            global.fetch = vi.fn();
            global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/video');
        });

        it('should fetch video and return blob URL', async () => {
            const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
            (global.fetch as any).mockResolvedValue({
                blob: () => Promise.resolve(mockBlob)
            });

            const result = await service.fetchVideoBlob('http://video.mp4');

            expect(result).toBe('blob:http://localhost/video');
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should append API key if not present in URI', async () => {
            const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
            (global.fetch as any).mockResolvedValue({
                blob: () => Promise.resolve(mockBlob)
            });

            await service.fetchVideoBlob('http://video.mp4?param=value');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('key=test-api-key')
            );
        });

        it('should not duplicate API key if already present', async () => {
            const mockBlob = new Blob(['video data'], { type: 'video/mp4' });
            (global.fetch as any).mockResolvedValue({
                blob: () => Promise.resolve(mockBlob)
            });

            await service.fetchVideoBlob('http://video.mp4?key=existing-key');

            expect(global.fetch).toHaveBeenCalledWith('http://video.mp4?key=existing-key');
        });
    });

    describe('singleton instance', () => {
        it('should export a singleton Video instance', () => {
            expect(Video).toBeInstanceOf(VideoService);
        });
    });
});
