import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Editing } from '../EditingService';
import { AI } from '../../ai/AIService';
import { firebaseAI } from '../../ai/FirebaseAIService';

// Mock InputSanitizer
vi.mock('../../ai/utils/InputSanitizer', () => ({
    InputSanitizer: {
        sanitize: (text: string) => text,
        containsInjectionPatterns: () => false
    }
}));

// Mock FirebaseAIService
vi.mock('../../ai/FirebaseAIService', () => ({
    firebaseAI: {
        rawGenerateContent: vi.fn(),
        analyzeImage: vi.fn(),
        generateStructuredData: vi.fn()
    }
}));

// Mock AI service
// Mock AI service
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateStructuredData: vi.fn(), // Add this
        parseJSON: vi.fn(),
    }
}));

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: (_functions: any, _name: string) => mockHttpsCallable
}));

vi.mock('@/services/firebase', () => ({
    functions: {}
}));

describe('EditingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('editImage', () => {
        it('should edit image successfully', async () => {
            const mockResponse = {
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'editedData'
                                }
                            }]
                        }
                    }]
                }
            };
            mockHttpsCallable.mockResolvedValue(mockResponse);

            const result = await Editing.editImage({
                image: { mimeType: 'image/png', data: 'data' },
                prompt: 'edit'
            });

            expect(result).not.toBeNull();
            expect(result?.url).toBe('data:image/png;base64,editedData');
        });

        it('should handle masking', async () => {
            const mockResponse = {
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'editedData'
                                }
                            }]
                        }
                    }]
                }
            };
            mockHttpsCallable.mockResolvedValue(mockResponse);

            await Editing.editImage({
                image: { mimeType: 'image/png', data: 'data' },
                mask: { mimeType: 'image/png', data: 'maskData' },
                prompt: 'edit'
            });

            const callArgs = mockHttpsCallable.mock.calls[0][0];
            expect(callArgs.image).toBeDefined();
            expect(callArgs.mask).toBeDefined();
            expect(callArgs.prompt).toContain('edit');
        });
    });

    describe('generateStoryChain', () => {
        it('should generate story chain successfully', async () => {
            // Mock Planner Response
            // Mock Planner
            (firebaseAI.generateStructuredData as any).mockResolvedValue({ scenes: ['Scene 1', 'Scene 2'] });

            // Mock Visual Context Analysis (called for each frame)
            (firebaseAI.analyzeImage as any).mockResolvedValue('Visual Context');

            // Mock Frame Generation (called for each frame)
            (firebaseAI.rawGenerateContent as any).mockResolvedValue({
                response: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: { mimeType: 'image/png', data: 'frame_data' } // simplified data for both
                            }]
                        }
                    }]
                }
            });

            // We need to customize the return based on call index if we want specific 'frame1', 'frame2'
            // or just ensure it returns something valid.
            // Let's make it return dynamic data if needed, or just accept 'frame_data' for both for simplicity to pass the test.
            // Use mockImplementation if we want sequence.
            let callCount = 0;
            (firebaseAI.rawGenerateContent as any).mockImplementation(async () => {
                callCount++;
                return {
                    response: {
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: { mimeType: 'image/png', data: `frame${callCount}` }
                                }]
                            }
                        }]
                    }
                };
            });

            const result = await Editing.generateStoryChain({
                prompt: 'story',
                count: 2,
                timeDeltaLabel: '1s',
                startImage: { mimeType: 'image/png', data: 'start' }
            });

            expect(result).toHaveLength(2);
            expect(result[0].url).toBe('data:image/png;base64,frame1');
            expect(result[1].url).toBe('data:image/png;base64,frame2');
        });
    });

    describe('multiMaskEdit', () => {
        it('should process masks sequentially and return variations', async () => {
            // Mock backend responses for sequential edits
            // We expect 4 variations, and each variation has 2 masks (steps).
            // Total backend calls = variationCount (4) * masks.length (2) = 8 calls.

            // Use valid base64-like data (only alphanumeric, +, /, =)
            const mockResponse = {
                data: {
                    candidates: [{
                        content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'editedStepData123+/=' } }] }
                    }]
                }
            };
            mockHttpsCallable.mockResolvedValue(mockResponse);

            const result = await Editing.multiMaskEdit({
                image: { mimeType: 'image/png', data: 'base' },
                masks: [
                    { mimeType: 'image/png', data: 'mask1', prompt: 'edit1', colorId: 'red', referenceImage: { mimeType: 'image/jpeg', data: 'ref1' } },
                    { mimeType: 'image/png', data: 'mask2', prompt: 'edit2', colorId: 'blue' }
                ],
                variationCount: 2 // Reduced for test
            });

            expect(result).toHaveLength(2);
            expect(mockHttpsCallable).toHaveBeenCalledTimes(4); // 2 variations * 2 steps

            // Check if reference image was passed in the first call
            const firstCallArgs = mockHttpsCallable.mock.calls[0][0];
            expect(firstCallArgs.referenceImage).toBeDefined();
            expect(firstCallArgs.refMimeType).toBe('image/jpeg');
            expect(firstCallArgs.referenceImage).toBe('ref1');
            // Now includes variation suffix: "edit1 (variation 1 of 2)"
            expect(firstCallArgs.prompt).toContain('edit1');
            expect(firstCallArgs.prompt).toContain('variation');

            // Check second step (uses result of first as input)
            const secondCallArgs = mockHttpsCallable.mock.calls[1][0];
            expect(secondCallArgs.image).toBe('editedStepData123+/='); // Input is output of previous step
            expect(secondCallArgs.prompt).toContain('edit2');
        });
    });

    describe('deprecated video methods', () => {
        it('editVideo should return null and log deprecation warning', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await Editing.editVideo({
                video: { mimeType: 'video/mp4', data: 'test' },
                prompt: 'edit video'
            });

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('deprecated')
            );

            consoleSpy.mockRestore();
        });

        it('batchEditVideo should return empty array and log deprecation warning', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await Editing.batchEditVideo({
                videos: [{ mimeType: 'video/mp4', data: 'test' }],
                prompt: 'edit videos'
            });

            expect(result).toEqual([]);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('deprecated')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('batchEdit', () => {
        it('should return results and failures', async () => {
            const mockResponse = {
                data: {
                    candidates: [{
                        content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'edited' } }] }
                    }]
                }
            };

            // First call succeeds, second fails
            mockHttpsCallable
                .mockResolvedValueOnce(mockResponse)
                .mockRejectedValueOnce(new Error('Rate limit exceeded'));

            const result = await Editing.batchEdit({
                images: [
                    { mimeType: 'image/png', data: 'img1' },
                    { mimeType: 'image/png', data: 'img2' }
                ],
                prompt: 'edit'
            });

            expect(result.results).toHaveLength(1);
            expect(result.failures).toHaveLength(1);
            expect(result.failures[0].index).toBe(1);
            expect(result.failures[0].error).toContain('Rate limit');
        });
    });
});

