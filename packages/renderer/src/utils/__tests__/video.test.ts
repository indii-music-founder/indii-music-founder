import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractVideoFrameAt } from '../video';

// Mock resolveStorageUrl to avoid firebase/network dependency
vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn((url) => Promise.resolve(url)),
}));

describe('Video Frame Extraction Utility (ISSUE-515)', () => {
    let mockVideoElement: any;
    let mockCanvasElement: any;
    let mockContext: any;

    beforeEach(() => {
        vi.useFakeTimers();

        mockContext = {
            drawImage: vi.fn(),
        };

        mockCanvasElement = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => mockContext),
            toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockframedata'),
        };

        let onloadedmetadata: any = null;
        let onseeked: any = null;
        let onerror: any = null;

        mockVideoElement = {
            crossOrigin: '',
            preload: '',
            src: '',
            muted: false,
            playsInline: false,
            duration: 10,
            videoWidth: 640,
            videoHeight: 360,
            currentTime: 0,
            pause: vi.fn(),
            load: vi.fn(),
            removeAttribute: vi.fn(),
            remove: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            get onloadedmetadata() { return onloadedmetadata; },
            set onloadedmetadata(val) { onloadedmetadata = val; },
            get onseeked() { return onseeked; },
            set onseeked(val) { onseeked = val; },
            get onerror() { return onerror; },
            set onerror(val) { onerror = val; },
        };

        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'video') return mockVideoElement;
            if (tagName === 'canvas') return mockCanvasElement;
            return {} as any;
        });

        // Mock requestAnimationFrame
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('rejects videos exceeding memory safety thresholds (100MB)', async () => {
        // Large data URL (representing > 100MB raw bytes)
        const hugePayload = 'data:video/mp4;base64,' + 'a'.repeat(150 * 1024 * 1024);
        
        await expect(
            extractVideoFrameAt(hugePayload, 2.0, { maxDataUriBytes: 100 * 1024 * 1024 })
        ).rejects.toThrow(/too large for browser-side extraction/);
    });

    it('aligns seek requests to target frame boundaries under 24 FPS temporal default', async () => {
        vi.useRealTimers();
        const extractionPromise = extractVideoFrameAt('http://example.com/test.mp4', 2.37, { fps: 24 });

        // Let microtasks run so event handler properties are assigned
        await new Promise(resolve => setTimeout(resolve, 0));

        // Trigger loadedmetadata
        mockVideoElement.onloadedmetadata();

        // 2.37s should align to 2.375s at 24 FPS (rounded to nearest 1/24)
        expect(mockVideoElement.currentTime).toBeCloseTo(2.375);

        // Trigger seeked
        mockVideoElement.onseeked();

        const result = await extractionPromise;
        expect(result.dataUrl).toBe('data:image/jpeg;base64,mockframedata');
    });

    it('respects abort signals during frame extraction process', async () => {
        const controller = new AbortController();
        const extractionPromise = extractVideoFrameAt('http://example.com/test.mp4', 1.0, {
            signal: controller.signal,
        });

        controller.abort();

        await expect(extractionPromise).rejects.toThrow('Operation cancelled');
    });
});
