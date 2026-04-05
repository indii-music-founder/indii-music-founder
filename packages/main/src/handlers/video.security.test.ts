import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';

// Hoisted mocks for use in vi.mock
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: {
        getPath: (name: string) => {
            if (name === 'documents') return '/mock/documents';
            return '/tmp';
        }
    },
    shell: { showItemInFolder: vi.fn() },
    fs: {
        promises: { mkdir: vi.fn() },
        createWriteStream: vi.fn(),
        realpathSync: vi.fn((p) => p),
    },
    fetch: vi.fn(),
    validateSender: vi.fn(),
    validateSafeUrlAsync: vi.fn().mockResolvedValue(undefined),
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

// Mock fs
vi.mock('fs', () => ({
    default: mocks.fs,
    promises: mocks.fs.promises,
    createWriteStream: mocks.fs.createWriteStream,
    realpathSync: mocks.fs.realpathSync
}));

// Mock stream/promises
vi.mock('stream/promises', () => ({
    pipeline: vi.fn().mockResolvedValue(undefined),
    default: { pipeline: vi.fn().mockResolvedValue(undefined) }
}));

// Mock stream
vi.mock('stream', () => ({
    Readable: { fromWeb: vi.fn() },
    default: { Readable: { fromWeb: vi.fn() } }
}));

// Mock IPC Security
vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

// Mock Network Security
vi.mock('../utils/network-security', () => ({
    validateSafeUrlAsync: mocks.validateSafeUrlAsync
}));

// Set global fetch
global.fetch = mocks.fetch;

describe('🛡️ Shield: Video Handler Security Test', () => {
    let handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });
        registerVideoHandlers();
    });

    const invoke = async (channel: string, sender: unknown, ...args: unknown[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler(sender, ...args);
    };

    describe('video:save-asset', () => {
        it('should validate sender', async () => {
            mocks.validateSender.mockImplementationOnce(() => {
                throw new Error('Security Violation');
            });

            await expect(invoke('video:save-asset', { senderFrame: { url: 'bad://url' } }, 'http://example.com/video.mp4', 'test.mp4'))
                .rejects.toThrow('Security Violation');
        });

        it('should block non-http/https URLs', async () => {
            // FetchUrlSchema.parse rejects file:// protocol via Zod refine — exact error depends on Zod internals
            await expect(invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'file:///etc/passwd', 'passwd.txt'))
                .rejects.toThrow();
        });

        it('should block local IPs (SSRF prevention)', async () => {
            // FetchUrlSchema.parse or validateSafeUrlAsync blocks private IPs
            await expect(invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'http://127.0.0.1/secret.json', 'test.mp4'))
                .rejects.toThrow();
        });

        it('should sanitize filename to prevent path traversal', async () => {
            mocks.fetch.mockResolvedValue({
                ok: true,
                body: {
                    getReader: () => ({ read: () => Promise.resolve({ done: true }), releaseLock: () => { } })
                }
            });

            // Path Traversal Attack
            // Should be rejected due to security policy
            await expect(invoke(
                'video:save-asset',
                { senderFrame: { url: 'file:///app/index.html' } },
                'http://example.com/video.mp4',
                '../../../../etc/passwd'
            )).rejects.toThrow(/Invalid filename: Path traversal detected/);
        });
    });

    describe('video:open-folder', () => {
        it('should block path traversal outside asset directory', async () => {
            await expect(invoke('video:open-folder', { senderFrame: { url: 'file://valid' } }, '../../../../../etc/passwd'))
                .rejects.toThrow(/Access Denied|Security|Unauthorized/i);
        });
    });
});
