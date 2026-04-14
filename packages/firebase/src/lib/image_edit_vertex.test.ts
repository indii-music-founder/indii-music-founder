import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiImageService } from './image_generation';

// Mock getGeminiApiKey
vi.mock('../config/secrets', () => ({
    getGeminiApiKey: vi.fn(() => 'mock-api-key'),
    geminiApiKey: { value: vi.fn(() => 'mock-api-key') }
}));

// Mock GoogleGenAI
const mockGenerateContent = vi.fn().mockResolvedValue({
    candidates: [{
        content: {
            parts: [{
                inlineData: {
                    data: 'fake-base64-data',
                    mimeType: 'image/png'
                }
            }]
        }
    }]
});

const mockConstructor = vi.fn();

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class {
            constructor(config: any) {
                mockConstructor(config);
            }
            models = {
                generateContent: mockGenerateContent
            };
        }
    };
});

describe('GeminiImageService Dual-Client Logic', () => {
    let service: any;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new GeminiImageService();
    });

    it('should use standard client (API Key) when no mask is provided', async () => {
        const data = {
            prompt: 'test prompt',
            image: 'base64-source'
        };

        await service.edit(data);

        // Verify standard client was initialized
        expect(mockConstructor).toHaveBeenCalledWith({
            apiKey: 'mock-api-key'
        });
        expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should use Vertex AI client (ADC) when mask is provided', async () => {
        const data = {
            prompt: 'test prompt',
            image: 'base64-source',
            mask: 'base64-mask'
        };

        process.env.GCLOUD_PROJECT = 'test-project';
        
        await service.edit(data);

        // Verify Vertex client was initialized in the second call (or first call)
        // Since we clear mocks and create a new service, it should be the only call or the second if standard was called by mistake
        const vertexCall = mockConstructor.mock.calls.find(call => call[0].vertexai === true);
        expect(vertexCall).toBeDefined();
        expect(vertexCall[0]).toEqual({
            vertexai: true,
            project: 'test-project',
            location: 'us-central1'
        });
    });
});
