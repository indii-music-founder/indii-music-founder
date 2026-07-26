import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: vi.fn() },
}));

import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { AppErrorCode } from '@/shared/types/errors';
import { generateImageDirectly } from './DirectImageGenerator';

describe('generateImageDirectly', () => {
    it('delegates through the canonical reservation and Storage-result service', async () => {
        vi.mocked(ImageGeneration.generateImages).mockResolvedValue([{
            id: 'job-1',
            url: 'https://storage.example/preview.png',
            storageUri: 'gs://project/creative/user/image/outputs/generated.png',
            prompt: 'A record cover',
        }]);

        await expect(generateImageDirectly({
            prompt: 'A record cover',
            model: 'gemini-3-pro-image-preview',
            numberOfImages: 1,
        })).resolves.toEqual(['https://storage.example/preview.png']);

        expect(ImageGeneration.generateImages).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'A record cover',
            count: 1,
            model: 'pro',
        }));
    });

    it('turns upstream capacity failures into product-neutral retryable errors', async () => {
        vi.mocked(ImageGeneration.generateImages).mockRejectedValue(new Error('RESOURCE_EXHAUSTED: rate limit'));

        await expect(generateImageDirectly({ prompt: 'A record cover' })).rejects.toMatchObject({
            code: AppErrorCode.RATE_LIMITED,
            details: { retryable: true },
        });
    });
});
