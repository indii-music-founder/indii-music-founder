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
        constants: { R_OK: 4 },
        promises: {
            mkdir: vi.fn(),
            writeFile: vi.fn().mockResolvedValue(undefined),
            access: vi.fn().mockResolvedValue(undefined),
        },
        createWriteStream: vi.fn(),
        realpathSync: vi.fn((p) => p),
    },
    fetch: vi.fn(),
    validateSender: vi.fn(),
    validateSafeUrlAsync: vi.fn().mockResolvedValue(undefined),
    spawn: vi.fn(),
}));

const mockChild = {
    stdout: {
        on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
            if (event === 'data') {
                cb(Buffer.from(JSON.stringify({
                    streams: [{ codec_type: 'video', codec_name: 'h264', avg_frame_rate: '60/1', r_frame_rate: '60/1' }],
                    frames: [{ key_frame: 1, pkt_pts: 0 }],
                })));
            }
        }),
    },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') {
            cb(0);
        }
    }),
    kill: vi.fn(),
};

mocks.spawn.mockImplementation(() => mockChild);

vi.mock('child_process', () => ({
    spawn: mocks.spawn,
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
    constants: mocks.fs.constants,
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

        it('should save data: URIs directly to disk via Buffer without HTTP fetch', async () => {
            const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            const result = await invoke(
                'video:save-asset',
                { senderFrame: { url: 'file:///app/index.html' } },
                dataUrl,
                'print_3000.png'
            );

            expect(result).toBe('/mock/documents/indii/Assets/Video/print_3000.png');
            expect(mocks.fs.promises.writeFile).toHaveBeenCalled();
            expect(mocks.fetch).not.toHaveBeenCalled();
        });
    });

    describe('video:open-folder', () => {
        it('should block path traversal outside asset directory', async () => {
            await expect(invoke('video:open-folder', { senderFrame: { url: 'file://valid' } }, '../../../../../etc/passwd'))
                .rejects.toThrow(/Access Denied|Security|Unauthorized/i);
        });
    });

    describe('video:probe-media', () => {
        it('should validate sender', async () => {
            mocks.validateSender.mockImplementationOnce(() => {
                throw new Error('Security Violation');
            });

            await expect(invoke('video:probe-media', { senderFrame: { url: 'bad://url' } }, '/mock/documents/indii/Assets/Video/clip.mp4'))
                .rejects.toThrow('Security Violation');
        });

        it('should block path traversal', async () => {
            await expect(invoke('video:probe-media', { senderFrame: { url: 'file:///app/index.html' } }, '../../../../etc/passwd.mp4'))
                .rejects.toThrow(/Security Violation: Path traversal detected/);
        });

        it('should reject unsupported file extension', async () => {
            await expect(invoke('video:probe-media', { senderFrame: { url: 'file:///app/index.html' } }, '/mock/documents/indii/Assets/Video/script.sh'))
                .rejects.toThrow(/Security Violation: File type "\.sh" is not supported/);
        });

        it('should reject unauthorized path', async () => {
            await expect(invoke('video:probe-media', { senderFrame: { url: 'file:///app/index.html' } }, '/system/secret/clip.mp4'))
                .rejects.toThrow(/Security Violation: Access denied/);
        });

        it('should probe authorized media file via ffprobe and return parsed streams and frames', async () => {
            const mediaPath = '/mock/documents/indii/Assets/Video/intro.mp4';
            const result = (await invoke(
                'video:probe-media',
                { senderFrame: { url: 'file:///app/index.html' } },
                mediaPath
            )) as { streams: Array<{ codec_name: string }>; frames: Array<{ key_frame: number }> };

            expect(result).toBeDefined();
            expect(result.streams[0].codec_name).toBe('h264');
            expect(result.frames[0].key_frame).toBe(1);
        });
    });
});
