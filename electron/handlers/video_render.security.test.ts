import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';
import { ipcMain } from 'electron';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: {
        getPath: (name: string) => {
            if (name === 'documents') return '/mock/documents';
            if (name === 'userData') return '/mock/userData';
            return '/mock/temp';
        }
    },
    shell: { showItemInFolder: vi.fn() },
    render: vi.fn().mockResolvedValue('/mock/output.mp4'),
    validateSender: vi.fn(),
    verifyAccess: vi.fn().mockReturnValue(true),
    fs: {
        promises: { mkdir: vi.fn().mockResolvedValue(undefined) },
        createWriteStream: vi.fn(),
        realpathSync: vi.fn((p) => p),
    }
}));

// Mock Electron
vi.mock('electron', () => ({
    app: mocks.app,
    ipcMain: mocks.ipcMain,
    shell: mocks.shell,
    default: {
        app: mocks.app,
        ipcMain: mocks.ipcMain,
        shell: mocks.shell
    }
}));

// Mock ElectronRenderService
vi.mock('../services/ElectronRenderService', () => ({
    electronRenderService: {
        render: mocks.render
    }
}));

// Mock AccessControlService
vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: mocks.verifyAccess
    }
}));

// Mock IPC Security
vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

// Mock fs
vi.mock('fs', () => ({
    default: mocks.fs,
    promises: mocks.fs.promises,
    createWriteStream: mocks.fs.createWriteStream,
    realpathSync: mocks.fs.realpathSync
}));

describe('🛡️ Shield: Video Render Security Test', () => {
    let handlers: Record<string, (...args: any[]) => Promise<any>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });
        registerVideoHandlers();
    });

    const invoke = async (channel: string, sender: any, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler(sender, ...args);
    };

    it('should BLOCK malicious output paths (Path Traversal)', async () => {
        const maliciousPath = '/mock/documents/../../etc/passwd.mp4';
        const config = {
            compositionId: 'test-comp',
            outputLocation: maliciousPath
        };

        // Simulate realpath resolving to a sensitive directory
        mocks.fs.realpathSync.mockReturnValueOnce('/etc');

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, config))
            .rejects.toThrow(/Security Violation|Access Denied/i);
    });

    it('should BLOCK unauthorized output locations via AccessControlService', async () => {
        mocks.verifyAccess.mockReturnValueOnce(false);

        const config = {
            compositionId: 'test-comp',
            outputLocation: '/unauthorized/path/video.mp4'
        };

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, config))
            .rejects.toThrow(/Security Violation|Unauthorized|Access Denied/i);
    });

    it('should BLOCK disallowed extensions', async () => {
        const config = {
            compositionId: 'test-comp',
            outputLocation: '/mock/documents/IndiiOS/malware.exe'
        };

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, config))
            .rejects.toThrow(/File type .* is not allowed/i);
    });

    it('should ALLOW valid output paths in IndiiOS folder', async () => {
        const validPath = '/mock/documents/IndiiOS/my-video.mp4';
        const config = {
            compositionId: 'test-comp',
            outputLocation: validPath
        };

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, config))
            .resolves.toBe('/mock/output.mp4');

        expect(mocks.render).toHaveBeenCalledWith(config);
    });
});
