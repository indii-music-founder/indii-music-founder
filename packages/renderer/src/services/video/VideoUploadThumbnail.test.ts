import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/storage', () => ({
    getDownloadURL: vi.fn(),
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    uploadBytesResumable: vi.fn(),
}));

vi.mock('../firebase', () => ({ storage: {} }));
vi.mock('@/core/logger/Logger', () => ({
    Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { VideoUploadService } from './VideoUploadService';

describe('VideoUploadService thumbnail lifecycle', () => {
    let video: HTMLVideoElement;

    beforeEach(() => {
        vi.useFakeTimers();
        video = document.createElement('video');
        vi.spyOn(video, 'load').mockImplementation(() => undefined);
        vi.spyOn(video, 'remove').mockImplementation(() => undefined);
        const createElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
            if (tagName.toLowerCase() === 'video') return video;
            return createElement(tagName);
        }) as typeof document.createElement);
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => 'blob:thumbnail-test'),
            revokeObjectURL: vi.fn(),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('releases media and event listeners when decoding times out', async () => {
        const removeListener = vi.spyOn(video, 'removeEventListener');
        const pending = VideoUploadService.generateAndUploadThumbnail(
            new Blob(['video'], { type: 'video/mp4' }),
            'videos/user/video.mp4',
        );

        await vi.advanceTimersByTimeAsync(10_000);

        await expect(pending).resolves.toBeUndefined();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:thumbnail-test');
        expect(video.remove).toHaveBeenCalledOnce();
        expect(removeListener).toHaveBeenCalledWith('loadeddata', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('seeked', expect.any(Function));
        expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    });
});
