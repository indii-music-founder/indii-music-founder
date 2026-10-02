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
    });

    it('exports a singleton instance and class definition', () => {
        expect(service).toBeDefined();
        expect(typeof service.upscaleToPrintReady).toBe('function');
    });
});
