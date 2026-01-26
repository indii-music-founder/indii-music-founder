import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';
import { ipcMain } from 'electron';

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
    render: vi.fn(),
    validateSender: vi.fn(),
    app: { getPath: vi.fn(() => '/mock/documents') },
    render: vi.fn().mockResolvedValue('/mock/output.mp4'),
    verifyAccess: vi.fn(),
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
    app: mocks.app,
    shell: { showItemInFolder: vi.fn() },
    default: {
        ipcMain: mocks.ipcMain,
        app: mocks.app
        app: mocks.app,
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
// Mock security utils
vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

vi.mock('../utils/network-security', () => ({
    validateSafeUrlAsync: vi.fn()
}));

describe('Security: Video Render Handler', () => {
// Mock AccessControlService
vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: mocks.verifyAccess
    }
}));

// Mock utils
vi.mock('../utils/ipc-security', () => ({ validateSender: vi.fn() }));

describe('Security: Video Render Handler', () => {
vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: vi.fn((path: string) => {
        if (path === '/etc/passwd') throw new Error('Security Violation: Access to system directories is denied');
        // Allow others
    })
}));

describe('Security: Video Render', () => {
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

        // Capture handlers
        // Setup handler capture
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
    const invoke = async (channel: string, sender: any, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler(sender, ...args);
    };

    it('should allow render with valid config and no explicit output location', async () => {
        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, { compositionId: 'test-comp' }))
            .resolves.toBe('/mock/output.mp4');
    });

    it('should block render with unauthorized output location', async () => {
        // Mock access control to deny
        mocks.verifyAccess.mockReturnValue(false);

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, {
            compositionId: 'test-comp',
            outputLocation: '/bad/location.mp4'
        })).rejects.toThrow(/Security Violation|Unauthorized|Access Denied/i);

        expect(mocks.verifyAccess).toHaveBeenCalledWith('/bad/location.mp4');
    });

    it('should block system directories via validateSafeDistributionSource', async () => {
        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, {
            compositionId: 'test-comp',
            outputLocation: '/etc/passwd'
        })).rejects.toThrow(/Security Violation/i);

        // verifyAccess might not be called if validation fails first
    });

    it('should allow render with authorized output location', async () => {
        // Mock access control to allow
        mocks.verifyAccess.mockReturnValue(true);

        await expect(invoke('video:render', { senderFrame: { url: 'file://valid' } }, {
            compositionId: 'test-comp',
            outputLocation: '/mock/documents/IndiiOS/Exports/safe.mp4'
        })).resolves.toBe('/mock/output.mp4');

        expect(mocks.verifyAccess).toHaveBeenCalledWith('/mock/documents/IndiiOS/Exports/safe.mp4');
    });
});
