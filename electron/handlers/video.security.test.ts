import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';
import { ipcMain } from 'electron';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn(() => '/mock/documents') },
    fs: {
        promises: { mkdir: vi.fn() },
        createWriteStream: vi.fn(),
    },
    fetch: vi.fn(),
    shell: { showItemInFolder: vi.fn() }
}));

// Mock electron
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app,
    shell: mocks.shell,
    default: {
        ipcMain: mocks.ipcMain,
        app: mocks.app,
        shell: mocks.shell
    }
}));

// Mock fs
vi.mock('fs', () => ({
    default: mocks.fs,
    promises: mocks.fs.promises,
    createWriteStream: mocks.fs.createWriteStream
}));

// Mock stream/promises
vi.mock('stream/promises', () => ({
    pipeline: vi.fn(),
    default: { pipeline: vi.fn() }
}));

// Mock other utils
vi.mock('../utils/ipc-security', () => ({ validateSender: vi.fn() }));
vi.mock('../utils/network-security', () => ({ validateSafeUrlAsync: vi.fn(async () => { }) }));

global.fetch = mocks.fetch;

describe('Security: Video Handlers', () => {
    let handlers: Record<string, (...args: any[]) => Promise<any>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Setup handler capture
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

    describe('video:save-asset', () => {
        it('should validate sender', async () => {
            const { validateSender } = await import('../utils/ipc-security');
            (validateSender as any).mockImplementationOnce(() => {
                throw new Error('Security: Unauthorized sender URL');
            });

            await expect(invoke('video:save-asset', { senderFrame: { url: 'bad://url' } }, 'http://example.com/video.mp4', 'test.mp4'))
                .rejects.toThrow('Security: Unauthorized sender URL');
        });

        it('should block non-http/https URLs', async () => {
            await expect(invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'file:///etc/passwd', 'passwd.txt'))
                .rejects.toThrow(/Validation Error/);
        });

        it('should block Path Traversal in filename', async () => {
            await expect(invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'https://example.com/video.mp4', '../passwd'))
                .rejects.toThrow(/Invalid filename/);
        });

        it('should block Absolute Paths in filename', async () => {
            await expect(invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'https://example.com/video.mp4', '/etc/passwd'))
                .rejects.toThrow(/Invalid filename/);
        });

        it('should sanitize filename correctly', async () => {
            mocks.fetch.mockResolvedValue({
                ok: true,
                body: new ReadableStream({
                    start(controller) {
                        controller.close();
                    }
                })
            });

            // Note: We need to mock Readable.fromWeb if used, which we handled in global mock if strictly needed,
            // but our mock of pipeline accepts whatever.

            await invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'http://example.com/video.mp4', 'valid/file.mp4');

            // Should create directory
            expect(mocks.fs.promises.mkdir).toHaveBeenCalled();
            // Should write to cleaned path
            const calls = mocks.fs.createWriteStream.mock.calls;
            const lastPath = calls[calls.length - 1][0] as string;

            // 'valid/../../file.mp4' -> basename 'file.mp4' -> 'file.mp4'
            // or if passed 'foo/bar' -> 'bar' -> 'bar'
            expect(lastPath).toMatch(/file.mp4$/);
        });
    });

    describe('video:open-folder', () => {
        it('should block path traversal', async () => {
            await expect(invoke('video:open-folder', { senderFrame: { url: 'file://valid' } }, '../../../../../etc/passwd'))
                .rejects.toThrow(/Security Warning/);
        });

        it('should allow valid asset path', async () => {
            // Mock path.resolve behaviour if complex, but default node path works
            await invoke('video:open-folder', { senderFrame: { url: 'file://valid' } }, '/mock/documents/IndiiOS/Assets/Video/file.mp4');
            expect(mocks.shell.showItemInFolder).toHaveBeenCalled();
        });
    });
});
