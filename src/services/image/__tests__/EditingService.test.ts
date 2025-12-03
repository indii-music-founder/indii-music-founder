import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Editing } from '../EditingService';
import { AI } from '../../ai/AIService';

// Mock AI service
// Mock AI service
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
            (AI.generateContent as any)
                .mockResolvedValueOnce({ text: () => JSON.stringify({ scenes: ['Scene 1', 'Scene 2'] }) }) // Planner
                .mockResolvedValueOnce({ text: () => 'Visual Context' }) // Context Analysis
                .mockResolvedValueOnce({ // Frame 1
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: { mimeType: 'image/png', data: 'frame1' }
                            }]
                        }
                    }]
                })
                .mockResolvedValueOnce({ text: () => 'Visual Context 2' }) // Context Analysis 2
                .mockResolvedValueOnce({ // Frame 2
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: { mimeType: 'image/png', data: 'frame2' }
                            }]
                        }
                    }]
                });

            (AI.parseJSON as any).mockReturnValue({ scenes: ['Scene 1', 'Scene 2'] });

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
});
