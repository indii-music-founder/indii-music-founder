import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';
import path from 'path';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: {
        getPath: (name: string) => {
            if (name === 'documents') return '/safe/documents';
            if (name === 'userData') return '/safe/userData';
            return '/safe/temp';
        }
    },
    shell: { showItemInFolder: vi.fn() },
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

// Mock AccessControlService
vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: mocks.verifyAccess,
        grantAccess: vi.fn()
    }
}));

// Mock IPC Security
vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

// Mock network security
vi.mock('../utils/network-security', () => ({
    validateSafeUrlAsync: vi.fn().mockResolvedValue(undefined)
}));

// Mock validation
vi.mock('../utils/validation', () => ({
    FetchUrlSchema: { parse: vi.fn() }
}));

// Mock fs
vi.mock('fs', () => ({
    default: mocks.fs,
    promises: mocks.fs.promises,
    createWriteStream: mocks.fs.createWriteStream,
    realpathSync: mocks.fs.realpathSync
}));

describe('Shield: Video Render Security Test', () => {
    let handlers: Record<string, (...args: any[]) => Promise<any>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        mocks.verifyAccess.mockReturnValue(true);
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: any) => {
            handlers[channel] = handler;
        });
        registerVideoHandlers();
    });

    const invoke = async (channel: string, sender: any, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler(sender, ...args);
    };

    const sender = { senderFrame: { url: 'file://valid' } };

    it('should BLOCK malicious output paths (Path Traversal)', async () => {
        // Path traversal that resolves outside safe root
        const maliciousPath = '/safe/documents/IndiiOS/../../etc/passwd.mp4';
        const config = {
            compositionId: 'test-comp',
            outputLocation: maliciousPath
        };

        await expect(invoke('video:render', sender, config))
            .rejects.toThrow(/Security Violation/i);
    });

    it('should BLOCK paths outside the safe root', async () => {
        const config = {
            compositionId: 'test-comp',
            outputLocation: '/etc/evil.mp4'
        };

        await expect(invoke('video:render', sender, config))
            .rejects.toThrow(/Security Violation/i);
    });

    it('should BLOCK unauthorized output locations via AccessControlService', async () => {
        mocks.verifyAccess.mockReturnValueOnce(false);

        const config = {
            compositionId: 'test-comp',
            outputLocation: '/safe/documents/IndiiOS/video.mp4'
        };

        await expect(invoke('video:render', sender, config))
            .rejects.toThrow(/Security Violation|Unauthorized/i);
    });

    it('should BLOCK disallowed extensions', async () => {
        const config = {
            compositionId: 'test-comp',
            outputLocation: '/safe/documents/IndiiOS/malware.exe'
        };

        await expect(invoke('video:render', sender, config))
            .rejects.toThrow(/File type .* is not allowed/i);
    });

    it('should ALLOW valid output paths inside IndiiOS folder', async () => {
        const validPath = '/safe/documents/IndiiOS/my-video.mp4';
        const config = {
            compositionId: 'test-comp',
            outputLocation: validPath
        };

        const result = await invoke('video:render', sender, config);
        // Handler returns the resolved path directly — no mock stubs
        expect(result).toBe(path.resolve(validPath));
    });
});
