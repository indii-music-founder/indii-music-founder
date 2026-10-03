import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrintReadyUpscaleService } from '../PrintReadyUpscaleService';

vi.mock('@/services/upscale/UpscalerService', () => ({
    upscalerService: {
        upscale: vi.fn(),
    },
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('PrintReadyUpscaleService', () => {
    let service: PrintReadyUpscaleService;

    beforeEach(() => {
        service = new PrintReadyUpscaleService();
        vi.clearAllMocks();

        // jsdom does not implement real canvas rasterization; return a valid 1x1 PNG dataUrl
        HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );

        // jsdom does not trigger onload for HTMLImageElement by default
        vi.stubGlobal('Image', class {
            naturalWidth = 512;
            naturalHeight = 512;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            crossOrigin = '';
            private _src = '';

            get src() {
                return this._src;
            }

            set src(val: string) {
                this._src = val;
                setTimeout(() => {
                    this.onload?.();
                }, 0);
            }
        });
    });

    it('exports a singleton instance and class definition', () => {
        expect(service).toBeDefined();
        expect(typeof service.upscaleToPrintReady).toBe('function');
    });

    it('upscales to 3000x3000px print specification and applies DPI metadata', async () => {
        // Minimal valid 1x1 base64 PNG
        const base64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const result = await service.upscaleToPrintReady({
            dataUrl: base64Png,
            targetWidth: 3000,
            targetHeight: 3000,
            dpi: 300,
        });

        expect(result.width).toBe(3000);
        expect(result.height).toBe(3000);
        expect(result.dpi).toBe(300);
        expect(result.format).toBe('image/png');
        expect(result.method).toBe('browser-bicubic');
        expect(result.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });
});
