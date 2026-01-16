
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as admin from 'firebase-admin';
import { generateVideoFn } from '../lib/video_generation';

// Hoisted mocks
const mocks = vi.hoisted(() => {
    return {
        firestore: {
            collection: vi.fn(),
            doc: vi.fn(),
            set: vi.fn(),
        },
        storage: {
            bucket: vi.fn(),
            file: vi.fn(),
            save: vi.fn(),
            publicUrl: vi.fn(),
        },
        fetch: vi.fn()
    };
});

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
    firestore: Object.assign(
        vi.fn(() => ({
            collection: mocks.firestore.collection,
        })),
        {
            FieldValue: {
                serverTimestamp: vi.fn(() => 'TIMESTAMP'),
            }
        }
    ),
    storage: vi.fn(() => ({
        bucket: mocks.storage.bucket
    })),
    app: vi.fn(() => ({
        options: { projectId: 'test-project' }
    }))
}));

// Mock global fetch
global.fetch = mocks.fetch;

describe('Video Generation Pipeline (Lens)', () => {
    let handler: any;
    let mockStep: any;
    let mockEvent: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup Firestore Mocks
        mocks.firestore.collection.mockReturnValue({
            doc: mocks.firestore.doc
        });
        mocks.firestore.doc.mockReturnValue({
            set: mocks.firestore.set
        });

        // Setup Inngest Mock
        const mockInngestClient = {
            createFunction: (config: any, trigger: any, fn: any) => fn // Return the handler directly
        };

        const mockApiKey = { value: () => 'fake-api-key' };

        // Get the handler
        handler = generateVideoFn(mockInngestClient, mockApiKey);

        // Mock Step
        mockStep = {
            run: async (name: string, fn: () => Promise<any>) => {
                return await fn();
            },
            sleep: vi.fn()
        };

        // Default Event
        mockEvent = {
            data: {
                jobId: 'job-123',
                prompt: 'A cat playing piano',
                userId: 'user-123',
                options: {
                    aspectRatio: '16:9'
                }
            }
        };
    });

    it('🎥 Happy Path: Generates video and saves metadata contract', async () => {
        // 1. Mock "Trigger" (Predict Long Running)
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ name: 'operations/123' })
        });

        // 2. Mock "Poll" (Not Done -> Done)
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ done: false }) // Attempt 1
        });
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                done: true,
                response: {
                    generateVideoResponse: {
                        generatedSamples: [
                            { video: { uri: 'https://veo.google/video.mp4' } }
                        ]
                    }
                }
            }) // Attempt 2
        });

        // Execute
        const result = await handler({ event: mockEvent, step: mockStep });

        // Assertions
        expect(result.success).toBe(true);
        expect(result.videoUrl).toBe('https://veo.google/video.mp4');

        // Verify "Lens" Contract: Metadata Persistence
        // The last set call should include the metadata
        const lastSetCall = mocks.firestore.set.mock.calls[mocks.firestore.set.mock.calls.length - 1][0];

        expect(lastSetCall).toMatchObject({
            status: 'completed',
            videoUrl: 'https://veo.google/video.mp4',
            output: {
                url: 'https://veo.google/video.mp4',
                metadata: {
                    duration_seconds: 5,
                    fps: 30,
                    mime_type: 'video/mp4',
                    resolution: '1280x720'
                }
            }
        });

        // Verify Aspect Ratio Handling (16:9 -> 1280x720)
        expect(lastSetCall.output.metadata.resolution).toBe('1280x720');
    });

    it('🎥 Handles "9:16" aspect ratio correctly in metadata', async () => {
        mockEvent.data.options.aspectRatio = '9:16';

        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ name: 'operations/123' })
        });
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                done: true,
                response: {
                    generateVideoResponse: {
                        generatedSamples: [
                            { video: { uri: 'https://veo.google/video.mp4' } }
                        ]
                    }
                }
            })
        });

        await handler({ event: mockEvent, step: mockStep });

        const lastSetCall = mocks.firestore.set.mock.calls[mocks.firestore.set.mock.calls.length - 1][0];
        expect(lastSetCall.output.metadata.resolution).toBe('720x1280');
    });

    it('⚡ Flash vs Pro: Verify polling mechanism handles delays', async () => {
        // Mock Trigger
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ name: 'operations/slow' })
        });

        // Simulate "Pro" (Slow) generation: 3 polls before success
        mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ done: false }) });
        mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ done: false }) });
        mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ done: false }) });
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                done: true,
                response: {
                    generateVideoResponse: {
                        generatedSamples: [{ video: { uri: 'https://veo.google/slow.mp4' } }]
                    }
                }
            })
        });

        await handler({ event: mockEvent, step: mockStep });

        // Expect 4 sleep calls (one for each attempt loop)
        // Wait, loop logic: attempts++ -> sleep -> poll.
        // 4 polls means 4 loops.
        expect(mockStep.sleep).toHaveBeenCalledTimes(4);
    });

    it('🛑 Handles API Error Gracefully', async () => {
        // Trigger fails
        mocks.fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        });

        await expect(handler({ event: mockEvent, step: mockStep })).rejects.toThrow('Google AI Trigger Error: 500 Internal Server Error');

        // Verify status updated to failed
        expect(mocks.firestore.set).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed',
            error: expect.stringContaining('500 Internal Server Error')
        }), { merge: true });
    });

    it('🛑 Handles "SafetySettings" or Policy Violation', async () => {
        // Mock Trigger (Success)
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ name: 'operations/unsafe' })
        });

        // Mock Poll (Done but empty or error)
        mocks.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                done: true,
                response: {
                    // Simulating a response where filtered is true or samples are missing
                    generateVideoResponse: {
                        generatedSamples: [] // Empty samples usually means filtered
                    }
                }
            })
        });

        await expect(handler({ event: mockEvent, step: mockStep })).rejects.toThrow('No video data or URI/generatedSamples found');

        // The code logs error and updates status to failed
         expect(mocks.firestore.set).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed'
        }), { merge: true });
    });
});
