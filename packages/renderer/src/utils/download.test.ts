import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadAsset } from './download';

vi.mock('@/utils/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}));

describe('downloadAsset', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('returns false and does not download when the fetch response is not ok', async () => {
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            blob: vi.fn(),
        }));

        await expect(downloadAsset('https://cdn.example.com/missing.mp4', 'missing.mp4'))
            .resolves.toBe(false);
        expect(clickSpy).not.toHaveBeenCalled();
    });

    it('downloads fetched assets only after a successful response', async () => {
        const blob = new Blob(['video'], { type: 'video/mp4' });
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        const createObjectURL = vi.fn().mockReturnValue('blob:video');
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            blob: vi.fn().mockResolvedValue(blob),
        }));
        vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

        await expect(downloadAsset('https://cdn.example.com/render.mp4', 'render.mp4'))
            .resolves.toBe(true);
        expect(createObjectURL).toHaveBeenCalledWith(blob);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
    });
});
