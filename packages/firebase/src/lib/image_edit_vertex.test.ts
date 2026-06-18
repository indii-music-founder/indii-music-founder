import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiImageService } from './image_generation';

// Mock getVertexAIClient
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

const mockVertexClient = {
    models: {
        generateContent: mockGenerateContent
    }
};

vi.mock('./vertexClient', () => ({
    getVertexAIClient: vi.fn(() => mockVertexClient),
    resetVertexAIClient: vi.fn()
}));

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

    it('should use Vertex AI client when no mask is provided', async () => {
        const data = {
            prompt: 'test prompt',
            image: 'base64-source'
        };

        await service.edit(data);

        // Verify generateContent was called from the Vertex AI client
        expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should use the Vertex AI client when mask is provided', async () => {
        const data = {
            prompt: 'test prompt',
            image: 'base64-source',
            mask: 'base64-mask'
        };

        process.env.GCLOUD_PROJECT = 'test-project';

        await service.edit(data);

        // The service uses Vertex AI client with ADC for all edit operations
        expect(mockGenerateContent).toHaveBeenCalled();
    });
});
