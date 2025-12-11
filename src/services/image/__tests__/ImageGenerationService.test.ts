import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGeneration } from '../ImageGenerationService';
import { AI } from '../../ai/AIService';

// Mock the AI service
// Mock the AI service
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        parseJSON: vi.fn(),
    }
}));

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: (functions: any, name: string) => mockHttpsCallable
}));

vi.mock('@/services/firebase', () => ({
    functions: {}
}));

describe('ImageGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateImages', () => {
        it('should generate images successfully', async () => {
            const mockResponse = {
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'base64data'
                                }
                            }]
                        }
                    }]
                }
            };
            mockHttpsCallable.mockResolvedValue(mockResponse);

            const result = await ImageGeneration.generateImages({ prompt: 'test prompt' });

            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('data:image/png;base64,base64data');
            expect(result[0].prompt).toBe('test prompt');
            expect(mockHttpsCallable).toHaveBeenCalledTimes(1);
        });

        it('should handle errors gracefully', async () => {
            mockHttpsCallable.mockRejectedValue(new Error('AI Error'));

            await expect(ImageGeneration.generateImages({ prompt: 'test' }))
                .rejects.toThrow('AI Error');
        });
    });

    describe('remixImage', () => {
        it('should remix image successfully', async () => {
            const mockResponse = {
                response: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'remixedData'
                                }
                            }]
                        }
                    }]
                }
            };
            (AI.generateContent as any).mockResolvedValue(mockResponse);

            const result = await ImageGeneration.remixImage({
                contentImage: { mimeType: 'image/png', data: 'data1' },
                styleImage: { mimeType: 'image/png', data: 'data2' },
                prompt: 'remix'
            });

            expect(result).not.toBeNull();
            expect(result?.url).toBe('data:image/png;base64,remixedData');
        });

        it('should return null if no image generated', async () => {
            (AI.generateContent as any).mockResolvedValue({ response: { candidates: [] } });

            const result = await ImageGeneration.remixImage({
                contentImage: { mimeType: 'image/png', data: 'data1' },
                styleImage: { mimeType: 'image/png', data: 'data2' }
            });

            expect(result).toBeNull();
        });
    });

    describe('extractStyle', () => {
        it('should extract style successfully', async () => {
            const mockJSON = {
                prompt_desc: 'A description',
                style_context: 'A style',
                negative_prompt: 'Avoid this'
            };
            // Mock generateContent to return an object with a text() method
            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify(mockJSON)
            });
            (AI.parseJSON as any).mockReturnValue(mockJSON);

            const result = await ImageGeneration.extractStyle({ mimeType: 'image/png', data: 'data' });

            expect(result).toEqual(mockJSON);
        });
    });
});
