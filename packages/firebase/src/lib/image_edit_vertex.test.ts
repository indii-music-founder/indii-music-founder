import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

    afterEach(() => {
        // Clean up env vars to prevent test pollution
        delete process.env.GCLOUD_PROJECT;
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

    it('should use the standard API-key client when mask is provided', async () => {
        const data = {
            prompt: 'test prompt',
            image: 'base64-source',
            mask: 'base64-mask'
        };

        process.env.GCLOUD_PROJECT = 'test-project';

        await service.edit(data);

        // The service uses a single apiKey-based client for all edit operations
        expect(mockConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ apiKey: 'mock-api-key' })
        );
        expect(mockGenerateContent).toHaveBeenCalled();
    });
});
