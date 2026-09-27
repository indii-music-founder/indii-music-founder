/**
 * Structural tests for the generate_image instrument's resolution contract
 * (issues #319/#320): the agent path must carry an explicit imageSize —
 * defaulting to the model's full 4k capability — instead of silently
 * omitting it and landing on the provider's ~1K default.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    generateImages: vi.fn(),
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGenerationService: class {
        generateImages = mocks.generateImages;
    },
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn(async () => ({ allowed: true, reason: null })),
    },
}));

vi.mock('@/services/cache/CacheService', () => ({
    CacheService: class {
        set = vi.fn();
        get = vi.fn();
    },
}));

import { ImageGenerationInstrument } from './ImageGenerationInstrument';

function generatedResult() {
    return [{
        id: 'img-1',
        url: 'data:image/png;base64,AAAA',
        metadata: { resolution: '4k' },
    }];
}

describe('ImageGenerationInstrument — resolution contract (#319/#320)', () => {
    let instrument: ImageGenerationInstrument;

    beforeEach(() => {
        instrument = new ImageGenerationInstrument();
        mocks.generateImages.mockReset();
        mocks.generateImages.mockResolvedValue(generatedResult());
    });

    it('defaults to the full 4k capability so agent art is print-eligible', async () => {
        await instrument.execute({ prompt: 'An LP cover of a neon Detroit skyline' });

        expect(mocks.generateImages).toHaveBeenCalledTimes(1);
        expect(mocks.generateImages.mock.calls[0][0]).toEqual(expect.objectContaining({
            imageSize: '4k',
        }));
    });

    it('passes an explicit imageSize through to the generation service', async () => {
        await instrument.execute({ prompt: 'A cassette J-card layout', imageSize: '2k' });

        expect(mocks.generateImages.mock.calls[0][0]).toEqual(expect.objectContaining({
            imageSize: '2k',
        }));
    });

    it('declares 4k as the maximum resolution in its constraints', () => {
        expect(instrument.metadata.constraints?.maxResolution).toBe('4096x4096');
        const imageSizeInput = instrument.inputs.find(input => input.name === 'imageSize');
        expect(imageSizeInput, 'instrument must declare an imageSize input').toBeDefined();
        expect(imageSizeInput?.defaultValue).toBe('4k');
    });

    it('rejects an unsupported imageSize instead of downgrading it', async () => {
        const validation = await instrument.validateInputs({ prompt: 'A valid prompt over ten chars', imageSize: '3000x3000' });
        expect(validation.valid).toBe(false);
        const result = await instrument.execute({ prompt: 'A valid prompt over ten chars', imageSize: '3000x3000' });
        expect(result.success).toBe(false);
        expect(String(result.error)).toMatch(/imageSize/i);
        expect(mocks.generateImages).not.toHaveBeenCalled();
    });
});
