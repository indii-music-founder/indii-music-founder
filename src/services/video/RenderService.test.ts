
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderService, RenderConfig } from './RenderService';

describe('RenderService', () => {
    let service: RenderService;
    const mockElectronAPI = {
        video: {
            render: vi.fn(),
        },
    };

    beforeEach(() => {
        // Mock window.electronAPI
        // Mock window.electronAPI
        Object.defineProperty(global.window, 'electronAPI', {
            value: mockElectronAPI,
            writable: true
        });
        service = new RenderService();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should call electronAPI.video.render with config', async () => {
        const config: RenderConfig = {
            compositionId: 'test-comp',
            inputProps: { foo: 'bar' },
        };
        const expectedPath = '/path/to/video.mp4';

        mockElectronAPI.video.render.mockResolvedValue(expectedPath);

        const result = await service.renderComposition(config);

        expect(mockElectronAPI.video.render).toHaveBeenCalledWith(expect.objectContaining(config));
        expect(result).toBe(expectedPath);
    });

    it('should throw error if electronAPI is not available', async () => {
        Object.defineProperty(global.window, 'electronAPI', {
            value: undefined,
            writable: true
        });

        const config: RenderConfig = {
            compositionId: 'test-comp',
            inputProps: {},
        };

        await expect(service.renderComposition(config)).rejects.toThrow('Electron Render API not available');
    });

    it('should propagate errors from IPC', async () => {
        const config: RenderConfig = {
            compositionId: 'test-comp',
            inputProps: {},
        };

        mockElectronAPI.video.render.mockRejectedValue(new Error('IPC Error'));

        await expect(service.renderComposition(config)).rejects.toThrow('Failed to render composition: IPC Error');
    });
});
