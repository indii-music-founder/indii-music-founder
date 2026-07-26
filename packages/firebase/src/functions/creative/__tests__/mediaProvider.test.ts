import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Media provider policy: every server-side creative operation uses Vertex AI
 * through application credentials. Client/Developer API-key routing is not a
 * valid runtime mode, including in tests and local development.
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

    it('uses Vertex outside production too', async () => {
        process.env.NODE_ENV = 'test';
        delete process.env.MEDIA_PROVIDER;
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('vertex');
    });

    it('ignores an API-key override in production', async () => {
        process.env.NODE_ENV = 'production';
        process.env.MEDIA_PROVIDER = 'apikey';
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('vertex');
    });

    it('honors MEDIA_PROVIDER=vertex override outside production', async () => {
        process.env.NODE_ENV = 'development';
        process.env.MEDIA_PROVIDER = 'vertex';
        const getMediaProvider = await loadGetMediaProvider();
        expect(getMediaProvider()).toBe('vertex');
    });

    it('uses the explicit production Vertex value even when a key is present', async () => {
        process.env.NODE_ENV = 'production';
        process.env.MEDIA_PROVIDER = 'vertex';
        process.env.GEMINI_API_KEY = 'synthetic-test-key';
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
