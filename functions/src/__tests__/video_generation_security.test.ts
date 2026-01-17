
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

describe('🛡️ Shield: Video Generation Security', () => {
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

    it('should ENFORCE Safety Settings in Veo 3.1 API Request', async () => {
        const handler = generateVideoFn(mockInngestClient, mockGeminiApiKey);

        const event = {
            data: {
                jobId: 'job-security-test',
                prompt: 'generate a chaotic explosion',
                userId: 'user-123',
                options: {
                    aspectRatio: '16:9'
                }
            }
        };

        // Mock Google AI responses
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ name: 'projects/123/locations/us-central1/operations/op-123' })
        });

        // Mock poll response
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ done: true, response: { generateVideoResponse: { generatedSamples: [] } } })
        });

        try {
            await handler({ event, step: mockStep });
        } catch (e) {
            // Ignore processing errors, we just want to check the fetch call
        }

        // Check the first fetch call (Trigger)
        const triggerCall = (global.fetch as any).mock.calls[0];
        const requestUrl = triggerCall[0];
        const requestOptions = triggerCall[1];
        const body = JSON.parse(requestOptions.body);

        console.log("Request Body:", JSON.stringify(body, null, 2));

        // 🛡️ SECURITY ASSERTION: Safety Settings must be present
        expect(body).toHaveProperty('safetySettings');
        expect(body.safetySettings).toBeInstanceOf(Array);
        expect(body.safetySettings.length).toBeGreaterThan(0);

        // Verify specific settings (e.g. HATE_SPEECH)
        const hateSpeechSetting = body.safetySettings.find((s: any) => s.category === 'HARM_CATEGORY_HATE_SPEECH');
        expect(hateSpeechSetting).toBeDefined();
        expect(hateSpeechSetting.threshold).toBe('BLOCK_MEDIUM_AND_ABOVE');
    });
});
