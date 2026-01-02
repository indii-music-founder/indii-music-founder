import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Editing } from '../EditingService';
import { AI } from '../../ai/AIService';
import { firebaseAI } from '../../ai/FirebaseAIService';

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

            const mockResponse = {
                data: {
                    candidates: [{
                        content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'edited-step' } }] }
                    }]
                }
            };
            mockHttpsCallable.mockResolvedValue(mockResponse);

            // Fix: Mock parseJSON for the result parsing if used in multiMaskEdit?
            // multiMaskEdit uses `Editing.editImage` which calls httpsCallable directly.
            // The test mocks `httpsCallable` just above.
            // But `editImage` returns `{ id, url, prompt }`
            // Wait, multiMaskEdit implementation iterates and calls `editImage`.
            // So relying on `editImage` is correct.

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
            expect(firstCallArgs.referenceImage).toBe('ref1');
            expect(firstCallArgs.prompt).toBe('edit1');

            // Check second step (uses result of first as input)
            const secondCallArgs = mockHttpsCallable.mock.calls[1][0];
            expect(secondCallArgs.image).toBe('edited-step'); // Input is output of join
            expect(secondCallArgs.prompt).toBe('edit2');
        });
    });
});

