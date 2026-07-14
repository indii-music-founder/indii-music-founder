import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getMediaDurationFromFile,
    getMediaDurationFromUrl,
    getMediaDurationFromBackend,
    isBackendResolvableStorageUri,
    resolveMediaDurationSeconds,
    durationSecondsToFrames,
} from './mediaMetadata';

const mockCallable = vi.fn();

vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockCallable,
}));

vi.mock('@/services/firebase', () => ({
    functionsWest1: {},
}));

vi.mock('@/utils/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn() },
}));

/** Stand in for an HTMLVideoElement/HTMLAudioElement whose loading lifecycle we control by hand. */
class FakeMediaElement {
    duration = 0;
    onloadedmetadata: (() => void) | null = null;
    onerror: (() => void) | null = null;
    preload = '';
    src = '';
    removeAttribute = vi.fn();
    load = vi.fn();
}

describe('mediaMetadata', () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let lastElement: FakeMediaElement;

    beforeEach(() => {
        vi.useFakeTimers();
        mockCallable.mockReset();
        createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((() => {
            lastElement = new FakeMediaElement();
            return lastElement;
        }) as unknown as typeof document.createElement);
    });

    afterEach(() => {
        createElementSpy.mockRestore();
        vi.useRealTimers();
    });

    describe('durationSecondsToFrames', () => {
        it('converts seconds to frames at the given fps', () => {
            expect(durationSecondsToFrames(10, 30)).toBe(300);
            expect(durationSecondsToFrames(2.5, 24)).toBe(60);
        });

        it('falls back to the documented default for non-finite or non-positive input', () => {
            expect(durationSecondsToFrames(0, 30)).toBe(150);
            expect(durationSecondsToFrames(-5, 30)).toBe(150);
            expect(durationSecondsToFrames(NaN, 30)).toBe(150);
            expect(durationSecondsToFrames(Infinity, 30)).toBe(150);
        });

        it('honors a custom fallback', () => {
            expect(durationSecondsToFrames(0, 30, 90)).toBe(90);
        });

        it('defaults fps to 30 when fps is invalid', () => {
            expect(durationSecondsToFrames(2, 0)).toBe(60);
            expect(durationSecondsToFrames(2, NaN)).toBe(60);
        });

        it('never returns less than 1 frame for a positive duration', () => {
            expect(durationSecondsToFrames(0.001, 1)).toBe(1);
        });
    });

    describe('isBackendResolvableStorageUri', () => {
        it('accepts gs:// URIs', () => {
            expect(isBackendResolvableStorageUri('gs://my-bucket/path/file.mp4')).toBe(true);
        });

        it('accepts Firebase Storage download URLs', () => {
            expect(isBackendResolvableStorageUri('https://firebasestorage.googleapis.com/v0/b/proj.appspot.com/o/vid.mp4?alt=media')).toBe(true);
        });

        it('accepts storage.googleapis.com URLs', () => {
            expect(isBackendResolvableStorageUri('https://storage.googleapis.com/my-bucket/vid.mp4')).toBe(true);
        });

        it('rejects blob URLs', () => {
            expect(isBackendResolvableStorageUri('blob:https://app.indii.music/1234-5678')).toBe(false);
        });

        it('rejects arbitrary external URLs', () => {
            expect(isBackendResolvableStorageUri('https://example.com/video.mp4')).toBe(false);
        });

        it('rejects malformed URLs without throwing', () => {
            expect(isBackendResolvableStorageUri('not a url')).toBe(false);
        });
    });

    describe('getMediaDurationFromFile', () => {
        it('resolves 0 immediately for non-audio/video files', async () => {
            const file = new File(['x'], 'image.png', { type: 'image/png' });
            await expect(getMediaDurationFromFile(file)).resolves.toBe(0);
            expect(createElementSpy).not.toHaveBeenCalled();
        });

        it('resolves the element duration once metadata loads', async () => {
            const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
            URL.createObjectURL = vi.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = vi.fn();

            const promise = getMediaDurationFromFile(file);
            lastElement!.duration = 42;
            lastElement!.onloadedmetadata?.();

            await expect(promise).resolves.toBe(42);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });

        it('resolves 0 if the element errors', async () => {
            const file = new File(['x'], 'clip.mp3', { type: 'audio/mpeg' });
            URL.createObjectURL = vi.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = vi.fn();

            const promise = getMediaDurationFromFile(file);
            lastElement!.onerror?.();

            await expect(promise).resolves.toBe(0);
        });

        it('resolves 0 on timeout without a metadata event', async () => {
            const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
            URL.createObjectURL = vi.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = vi.fn();

            const promise = getMediaDurationFromFile(file);
            vi.advanceTimersByTime(8000);

            await expect(promise).resolves.toBe(0);
        });
    });

    describe('getMediaDurationFromUrl', () => {
        it('resolves 0 immediately for images without probing the DOM', async () => {
            await expect(getMediaDurationFromUrl('https://example.com/pic.png', 'image')).resolves.toBe(0);
            expect(createElementSpy).not.toHaveBeenCalled();
        });

        it('resolves the probed duration for a video URL', async () => {
            const promise = getMediaDurationFromUrl('https://storage.googleapis.com/bucket/vid.mp4', 'video');
            lastElement!.duration = 12.5;
            lastElement!.onloadedmetadata?.();
            await expect(promise).resolves.toBe(12.5);
        });

        it('treats a non-finite duration (e.g. streamed source) as unresolved', async () => {
            const promise = getMediaDurationFromUrl('https://storage.googleapis.com/bucket/vid.mp4', 'video');
            lastElement!.duration = Infinity;
            lastElement!.onloadedmetadata?.();
            await expect(promise).resolves.toBe(0);
        });
    });

    describe('getMediaDurationFromBackend', () => {
        it('returns the durationSeconds from a successful call', async () => {
            mockCallable.mockResolvedValue({ data: { durationSeconds: 33 } });
            await expect(getMediaDurationFromBackend('gs://bucket/vid.mp4')).resolves.toBe(33);
        });

        it('returns 0 when the callable throws', async () => {
            mockCallable.mockRejectedValue(new Error('backend down'));
            await expect(getMediaDurationFromBackend('gs://bucket/vid.mp4')).resolves.toBe(0);
        });

        it('returns 0 when the backend reports a non-finite/zero duration', async () => {
            mockCallable.mockResolvedValue({ data: { durationSeconds: 0 } });
            await expect(getMediaDurationFromBackend('gs://bucket/vid.mp4')).resolves.toBe(0);
        });
    });

    describe('resolveMediaDurationSeconds', () => {
        it('returns 0 immediately for images', async () => {
            await expect(resolveMediaDurationSeconds('https://storage.googleapis.com/bucket/pic.png', 'image')).resolves.toBe(0);
            expect(createElementSpy).not.toHaveBeenCalled();
            expect(mockCallable).not.toHaveBeenCalled();
        });

        it('prefers the fast client-side probe when it succeeds', async () => {
            const promise = resolveMediaDurationSeconds('https://storage.googleapis.com/bucket/vid.mp4', 'video');
            lastElement!.duration = 7;
            lastElement!.onloadedmetadata?.();

            await expect(promise).resolves.toBe(7);
            expect(mockCallable).not.toHaveBeenCalled();
        });

        it('falls back to the backend when the client probe fails and the URL is Storage-resolvable', async () => {
            mockCallable.mockResolvedValue({ data: { durationSeconds: 21 } });

            const promise = resolveMediaDurationSeconds('https://storage.googleapis.com/bucket/vid.mp4', 'video');
            lastElement!.onerror?.();

            await expect(promise).resolves.toBe(21);
            expect(mockCallable).toHaveBeenCalledWith({ uri: 'https://storage.googleapis.com/bucket/vid.mp4' });
        });

        it('does not call the backend for a non-Storage URL (e.g. blob:) and returns 0', async () => {
            const promise = resolveMediaDurationSeconds('blob:https://app.indii.music/local-file', 'video');
            lastElement!.onerror?.();

            await expect(promise).resolves.toBe(0);
            expect(mockCallable).not.toHaveBeenCalled();
        });
    });
});
