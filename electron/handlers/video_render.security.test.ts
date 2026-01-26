import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn((name) => `/mock/${name}`) },
    fs: {
        promises: { mkdir: vi.fn() },
        createWriteStream: vi.fn(),
        realpathSync: vi.fn((p) => p), // Default passthrough
    },
    render: vi.fn(),
}));

// Mock electron
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app,
    shell: { showItemInFolder: vi.fn() },
    default: {
        ipcMain: mocks.ipcMain,
        app: mocks.app
    }
}));

// Mock ElectronRenderService
vi.mock('../services/ElectronRenderService', () => ({
    electronRenderService: {
        render: mocks.render
    }
}));

// Mock fs
vi.mock('fs', () => ({
    default: mocks.fs,
    promises: mocks.fs.promises,
    createWriteStream: mocks.fs.createWriteStream,
    realpathSync: mocks.fs.realpathSync
}));

// Mock utils
vi.mock('../utils/ipc-security', () => ({ validateSender: vi.fn() }));

describe('Security: Video Render Handler', () => {
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
        // Path traversal to /etc/passwd.mp4
        const maliciousPath = '/mock/documents/../../etc/passwd.mp4';
        const config = {
            compositionId: 'test-comp',
            outputLocation: maliciousPath
        };

        // We mock realpathSync to simulate that the traversal works on file system level
        // if the security check wasn't enforcing allowed roots.
        // Our mock passes through, so realpathSync('/mock/documents/../../etc') -> '/mock/documents/../../etc'
        // But path.resolve would resolve it.
        // Wait, validateSafeVideoOutputPath uses fs.realpathSync(dir).
        // Since we are using node's path module, path.dirname('/mock/documents/../../etc/passwd.mp4')
        // is '/mock/documents/../../etc'.
        // Then fs.realpathSync is called on that.
        // We need to mock fs.realpathSync to return the resolved path to simulate the attack.
        mocks.fs.realpathSync.mockReturnValueOnce('/etc');

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, config))
            .rejects.toThrow(/Security Violation/);

        expect(mocks.render).not.toHaveBeenCalled();
    });

    it('should BLOCK invalid extensions', async () => {
        const config = {
            compositionId: 'test-comp',
            outputLocation: '/mock/documents/test.exe'
        };

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, config))
            .rejects.toThrow(/Security Violation: File type/);
    });

    it('should ALLOW valid paths in allowed directories', async () => {
        const validPath = '/mock/documents/IndiiOS/Exports/video.mp4';
        const config = {
            compositionId: 'test-comp',
            outputLocation: validPath
        };

        // realpathSync passes through by default (from our mock setup),
        // so dir '/mock/documents/IndiiOS/Exports' is returned.
        // allowedRoots contains '/mock/documents'.
        // Check: '/mock/documents/IndiiOS/Exports'.startsWith('/mock/documents') -> true.
        // But validateSafeVideoOutputPath also resolves roots.
        // mocks.fs.realpathSync resolves '/mock/documents' to '/mock/documents'.

        // We need to make sure realpathSync works for the dir too.
        mocks.fs.realpathSync.mockReturnValueOnce('/mock/documents/IndiiOS/Exports'); // for dir
        // And for roots... validation calls realpathSync on roots too.
        // our default mock returns input, so it works.

        await invoke('video:render', { senderFrame: { url: 'file://valid' } }, config);

        expect(mocks.render).toHaveBeenCalledWith(config);
    });
});
