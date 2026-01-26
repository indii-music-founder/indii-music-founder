import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';
import { ipcMain } from 'electron';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    render: vi.fn(),
    validateSender: vi.fn(),
}));

// Mock electron
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: {
        getPath: (name: string) => {
            if (name === 'documents') return '/mock/documents';
            if (name === 'userData') return '/mock/userData';
            return '/mock/temp';
        }
    },
    shell: { showItemInFolder: vi.fn() }
}));

// Mock services
vi.mock('../services/ElectronRenderService', () => ({
    electronRenderService: {
        render: mocks.render
    }
}));

// Mock security utils
vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

vi.mock('../utils/network-security', () => ({
    validateSafeUrlAsync: vi.fn()
}));

describe('Security: Video Render Handler', () => {
    let handlers: Record<string, (...args: any[]) => Promise<any>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Capture handlers
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });

        registerVideoHandlers();
    });

    const invoke = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler({ sender: {} }, ...args);
    };

    it('should block arbitrary file write to system directories', async () => {
        const maliciousConfig = {
            compositionId: 'Main',
            outputLocation: '/etc/passwd.mp4', // System path (even with valid ext)
            inputProps: {}
        };

        // Should throw Security Violation
        await expect(invoke('video:render', maliciousConfig))
            .rejects
            .toThrow(/Security Violation/);

        // Should NOT call render
        expect(mocks.render).not.toHaveBeenCalled();
    });

    it('should block disallowed extensions', async () => {
        const maliciousConfig = {
            compositionId: 'Main',
            outputLocation: '/mock/documents/IndiiOS/malware.exe',
            inputProps: {}
        };

        await expect(invoke('video:render', maliciousConfig))
            .rejects
            .toThrow(/Output file type '.exe' is not allowed/);

        expect(mocks.render).not.toHaveBeenCalled();
    });

    it('should block paths outside allowed directories', async () => {
         const maliciousConfig = {
            compositionId: 'Main',
            outputLocation: '/mock/documents/OtherApp/video.mp4',
            inputProps: {}
        };

        await expect(invoke('video:render', maliciousConfig))
            .rejects
            .toThrow(/Output path .* is outside allowed directories/);

        expect(mocks.render).not.toHaveBeenCalled();
    });

    it('should allow valid output path in IndiiOS folder', async () => {
        const validConfig = {
            compositionId: 'Main',
            outputLocation: '/mock/documents/IndiiOS/my-video.mp4',
            inputProps: {}
        };

        // Mock render to return the path
        mocks.render.mockResolvedValue('/mock/documents/IndiiOS/my-video.mp4');

        await invoke('video:render', validConfig);

        expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({
            outputLocation: expect.stringMatching(/my-video\.mp4$/)
        }));
    });
});
