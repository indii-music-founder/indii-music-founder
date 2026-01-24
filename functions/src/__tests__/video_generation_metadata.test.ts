
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { generateVideoFn } from '../lib/video_generation';

// Use vi.hoisted to define mocks
const mocks = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockDoc = vi.fn(() => ({
        set: mockSet
    }));
    const mockCollection = vi.fn(() => ({
        doc: mockDoc
    }));

    return {
        firestore: {
            collection: mockCollection,
            doc: mockDoc,
            set: mockSet
        }
    };
});

// Mock firebase-admin
vi.mock('firebase-admin', () => {
    return {
        firestore: Object.assign(
            vi.fn(() => ({
                collection: mocks.firestore.collection
            })),
            {
                FieldValue: {
                    serverTimestamp: vi.fn(() => 'TIMESTAMP')
                }
            }
        ),
        storage: vi.fn(() => ({
            bucket: () => ({
                file: () => ({
                    save: vi.fn(),
                    publicUrl: () => 'https://mock.url/video.mp4'
                })
            })
        }))
    };
});

global.fetch = vi.fn();

describe('Video Generation Metadata', () => {
    let mockInngestClient: any;
    let mockGeminiApiKey: any;
    let mockStep: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockInngestClient = {
            createFunction: vi.fn((config, trigger, handler) => handler)
        };

        mockGeminiApiKey = {
            value: vi.fn(() => 'mock-api-key')
        };

        mockStep = {
            run: vi.fn(async (name, fn) => fn()),
            sleep: vi.fn()
        };
    });

    it('should persist Veo 3.1 metadata to Firestore on completion', async () => {
        const handler = generateVideoFn(mockInngestClient, mockGeminiApiKey);

        const event = {
            data: {
                jobId: 'job-123',
                prompt: 'test prompt',
                userId: 'user-123',
                options: {
                    aspectRatio: '16:9'
                }
            }
        };

        // Mock Google AI responses
        // 1. Trigger response
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ name: 'projects/123/locations/us-central1/operations/op-123' })
        });

        // 2. Poll response (Success with Metadata)
        // Veo 3.1 response structure simulation
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                done: true,
                response: {
                    generateVideoResponse: {
                        generatedSamples: [{
                            video: {
                                uri: 'gs://bucket/video.mp4'
                            },
                            // Simulating metadata that might come from the API or be calculated
                            videoMetadata: {
                                duration: "5s",
                                mimeType: "video/mp4"
                            }
                        }]
                    }
                }
            })
        });

        await handler({ event, step: mockStep });

        // Assert Firestore update
        expect(mocks.firestore.collection).toHaveBeenCalledWith('videoJobs');
        expect(mocks.firestore.doc).toHaveBeenCalledWith('job-123');

        // Check the final update call (completed status)
        const calls = mocks.firestore.set.mock.calls;
        const completionCall = calls.find(call => call[0].status === 'completed');

        expect(completionCall).toBeDefined();
        const data = completionCall[0];

        expect(data).toHaveProperty('output');
        expect(data.output).toHaveProperty('metadata');
        expect(data.output.metadata).toEqual(expect.objectContaining({
            mime_type: 'video/mp4',
            duration_seconds: expect.any(Number), // Should handle "5s" -> 5
            fps: expect.any(Number) // Should default or be present
        }));
    });
});
