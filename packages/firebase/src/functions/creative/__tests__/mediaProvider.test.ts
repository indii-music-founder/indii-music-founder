import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Media provider policy (production billing resilience):
 * - production defaults to Vertex AI (postpaid ADC) — no prepaid-credit cliff
 * - dev/QA defaults to the AI Studio API key so testing never drains prod quota
 * - MEDIA_PROVIDER env var overrides both
 */
describe('getMediaProvider', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    async function loadGetMediaProvider() {
        const mod = await import('../gateway');
        return mod.getMediaProvider;
    }

    it('defaults to vertex in production', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.MEDIA_PROVIDER;
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('vertex');
    });

    it('defaults to apikey outside production (dev/QA isolation)', async () => {
        process.env.NODE_ENV = 'test';
        delete process.env.MEDIA_PROVIDER;
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('apikey');
    });

    it('honors MEDIA_PROVIDER=apikey override in production', async () => {
        process.env.NODE_ENV = 'production';
        process.env.MEDIA_PROVIDER = 'apikey';
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('apikey');
    });

    it('honors MEDIA_PROVIDER=vertex override outside production', async () => {
        process.env.NODE_ENV = 'development';
        process.env.MEDIA_PROVIDER = 'vertex';
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('vertex');
    });

    it('ignores unknown MEDIA_PROVIDER values and falls back to the env default', async () => {
        process.env.NODE_ENV = 'production';
        process.env.MEDIA_PROVIDER = 'banana';
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('vertex');
    });
});
