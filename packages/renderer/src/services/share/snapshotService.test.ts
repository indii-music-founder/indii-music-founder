import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canCaptureSnapshot, captureAndShareSnapshot } from './snapshotService';

const mockShareOrDownloadImage = vi.hoisted(() => vi.fn());

vi.mock('@shared/share/shareFile', () => ({
    shareOrDownloadImage: mockShareOrDownloadImage,
}));

describe('snapshotService', () => {
    const originalElectronAPI = window.electronAPI;
    const originalImage = globalThis.Image;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    beforeEach(() => {
        vi.clearAllMocks();
        mockShareOrDownloadImage.mockResolvedValue('downloaded');
    });

    afterEach(() => {
        window.electronAPI = originalElectronAPI;
        globalThis.Image = originalImage;
        HTMLCanvasElement.prototype.toBlob = originalToBlob;
        HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('returns false on web when captureSnapshot IPC is absent', () => {
        window.electronAPI = undefined;
        expect(canCaptureSnapshot()).toBe(false);

        window.electronAPI = {} as typeof window.electronAPI;
        expect(canCaptureSnapshot()).toBe(false);
    });

    it('returns unavailable outside Electron without touching canvas', async () => {
        window.electronAPI = undefined;
        const result = await captureAndShareSnapshot();
        expect(result).toBe('unavailable');
        expect(mockShareOrDownloadImage).not.toHaveBeenCalled();
    });

    it('captures via Electron IPC, composites onto Void frame, and shares PNG blob', async () => {
        const captureSnapshot = vi.fn().mockResolvedValue({
            dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        });
        window.electronAPI = { captureSnapshot } as unknown as typeof window.electronAPI;

        expect(canCaptureSnapshot()).toBe(true);

        const fillRect = vi.fn();
        const fillText = vi.fn();
        const drawImage = vi.fn();
        HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            font: '',
            textAlign: 'left',
            textBaseline: 'alphabetic',
            fillRect,
            fillText,
            drawImage,
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            arcTo: vi.fn(),
            closePath: vi.fn(),
            clip: vi.fn(),
            stroke: vi.fn(),
            createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        });

        HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
            cb(new Blob(['png-bytes'], { type: 'image/png' }));
        });

        class MockImage {
            naturalWidth = 1200;
            naturalHeight = 800;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_val: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        globalThis.Image = MockImage as unknown as typeof Image;

        const outcome = await captureAndShareSnapshot({ fileName: 'studio-shot.png' });

        expect(captureSnapshot).toHaveBeenCalledTimes(1);
        expect(outcome).toBe('downloaded');
        expect(fillRect).toHaveBeenCalled();
        expect(drawImage).toHaveBeenCalled();
        expect(fillText).toHaveBeenCalledWith(
            'made with indii · indii.music',
            expect.any(Number),
            expect.any(Number),
        );
        expect(mockShareOrDownloadImage).toHaveBeenCalledWith(
            expect.any(Blob),
            'studio-shot.png',
            expect.objectContaining({
                title: 'indii.music Studio Snapshot',
                text: 'made with indii · indii.music',
            }),
        );
    });
});
