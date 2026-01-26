import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn(() => '/mock/documents') },
    fs: {

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerVideoHandlers } from './video';
import { ipcMain } from 'electron';

// Mock Electron
vi.mock('electron', () => {
    const mockShell = {
        showItemInFolder: vi.fn()
    };
    const mockApp = {
        getPath: (name: string) => {
            if (name === 'documents') return '/mock/documents';
            return '/tmp';
        }
    };
    const mockIpcMain = {
        handle: vi.fn()
    };

    return {
        app: mockApp,
        ipcMain: mockIpcMain,
        shell: mockShell,
        // CommonJS compatibility
        default: {
            app: mockApp,
            ipcMain: mockIpcMain,
            shell: mockShell
        }
    };
});

// Mock fs
vi.mock('fs', async (importOriginal) => {
    const mod = await importOriginal() as any;
    const mocked = {
        ...mod,
        promises: {
            mkdir: vi.fn(),
        },
        createWriteStream: vi.fn(),
    },
    // Mock fetch globally
    fetch: vi.fn(),
    shell: {
        showItemInFolder: vi.fn(),
    },
}));

// Mock modules
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app,
    shell: mocks.shell,
}));
vi.mock('fs', () => ({
    default: mocks.fs,
    promises: mocks.fs.promises,
    createWriteStream: mocks.fs.createWriteStream
}));
// Fix: Mock needs to handle the named export correctly when imported via ES modules
vi.mock('stream/promises', () => {
    return {
        pipeline: vi.fn(),
        default: { pipeline: vi.fn() } // Fallback if it tries to import default
    }
});
vi.mock('stream', () => ({
    Readable: { fromWeb: vi.fn() },
    default: { Readable: { fromWeb: vi.fn() } }
}));

global.fetch = mocks.fetch;

// Import handler setup
import { registerVideoHandlers } from './video';

describe('🛡️ Shield: Video Handler Security Test', () => {
    let handlers: Record<string, any> = {};
        realpathSync: vi.fn((p) => p),
    };
    return {
        ...mocked,
        default: mocked
    };
});

// Mock path for consistent behavior across OS
vi.mock('path', async () => {
    const actual = await vi.importActual<any>('path');
    const mocked = {
        ...actual,
        basename: (p: string) => p.split(/[\\/]/).pop(),
        dirname: (p: string) => p.split(/[\\/]/).slice(0, -1).join('/') || '.',
        extname: (p: string) => {
            const base = p.split(/[\\/]/).pop() || '';
            const idx = base.lastIndexOf('.');
            return idx > 0 ? base.slice(idx) : '';
        },
        resolve: (...args: string[]) => args.join('/').replace(/\/+/g, '/'),
        join: (...args: string[]) => args.join('/').replace(/\/+/g, '/'),
        normalize: (p: string) => p
    };
    return {
        ...mocked,
        default: mocked
    };
});

// Mock stream/promises
vi.mock('stream/promises', () => ({
    pipeline: vi.fn(),
    default: {
        pipeline: vi.fn()
    }
}));

// Mock fetch - Global
global.fetch = vi.fn();

// Mock IPC Security
vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));

// Mock Network Security
vi.mock('../utils/network-security', () => ({
    validateSafeUrlAsync: vi.fn(async () => {})
}));

describe('Security: Video Handlers', () => {
    let handlers: Record<string, (...args: any[]) => Promise<any>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        (ipcMain.handle as any).mockImplementation((name: string, fn: (...args: any[]) => any) => {
            handlers[name] = fn;
        });
        registerVideoHandlers();
    });

    const invoke = async (channel: string, sender: any, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler(sender, ...args); // Pass mocked event with sender
    };

    it('should FAIL if validateSender is missing and compromised renderer calls it', async () => {
        // This test simulates the "current state" where validateSender is missing.
        // It SHOULD pass if the code is vulnerable (which it is), but we want to assert the FIX.
        // So we will expect it to FAIL after we apply the fix.
        // For now, let's just write the test case that assumes the fix is in place.

        // Mock a suspicious sender (e.g., from an iframe or wrong origin if we had strict origin checks)
        // But validateSender checks if senderFrame.url matches the main window URL.
        const maliciousEvent = {
            senderFrame: {
                url: 'https://evil.com/malicious.html'
            }
        };

        // We expect this to throw/return error once we add validateSender
        // Currently it would succeed.
        // After fix: should throw "Security Warning: unauthorized sender"
        await expect(invoke('video:save-asset', maliciousEvent, 'http://example.com/video.mp4', 'video.mp4'))
            .rejects.toThrow(/Security Warning|Unauthorized/);
    });

    it('should BLOCK non-http/https URLs (SSRF/LFI Prevention)', async () => {
        const event = { senderFrame: { url: 'file:///app/index.html' } }; // Legit sender

        // Attempt file scheme
        await expect(invoke('video:save-asset', event, 'file:///etc/passwd', 'passwd.txt'))
            .rejects.toThrow(/Invalid URL protocol/);

        // Attempt other schemes
        await expect(invoke('video:save-asset', event, 'ftp://example.com/file', 'file.txt'))
            .rejects.toThrow(/Invalid URL protocol/);
    });

    it('should BLOCK Path Traversal in filename', async () => {
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        mocks.fetch.mockResolvedValue({
            ok: true,
            body: 'mock-stream'
        });

        // The current regex replace(/[^a-z0-9.]/gi, '_') replaces slashes, but we want to be strict.
        // If we strictly validate "filename" to be simple, we prevent any confusion.
        // Let's assume we want to block ".." explicitly even if regex handles it,
        // OR rely on our fix to reject it.

        // Let's pass ".." as filename.
        // Current code: safeName = "..". destination = ".../Assets/Video/.." -> ".../Assets/Video/parent"
        // New code should reject ".."

        await expect(invoke('video:save-asset', event, 'https://example.com/video.mp4', '..'))
             .rejects.toThrow(/Invalid filename/);
    });

    it('should BLOCK Path Traversal with separators even if regex cleans them', async () => {
        // If we implement strict validation, we should reject names that *would* be traversal if not cleaned.
        // Defense in depth: Reject "foo/../bar" instead of cleaning it to "foo_.._bar".
        const event = { senderFrame: { url: 'file:///app/index.html' } };

        await expect(invoke('video:save-asset', event, 'https://example.com/video.mp4', 'foo/../bar'))
             .rejects.toThrow(/Invalid filename/);
    describe('video:save-asset', () => {
        it('should validate sender', async () => {
            const handler = handlers['video:save-asset'];
            expect(handler).toBeDefined();

            const { validateSender } = await import('../utils/ipc-security');

            // Mock validateSender to throw to verify it's called
            (validateSender as any).mockImplementationOnce(() => {
                throw new Error('Security: Unauthorized sender URL');
            });

            await expect(handler({ senderFrame: { url: 'bad://url' } }, 'http://example.com/video.mp4', 'test.mp4'))
                .rejects.toThrow('Security: Unauthorized sender URL');
        });

        it('should block non-http/https URLs', async () => {
            await expect(invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'file:///etc/passwd', 'passwd.txt'))
                .rejects.toThrow(/Validation Error/);
        });
        it('should block SSRF (Local IP)', async () => {
            const handler = handlers['video:save-asset'];

            // Should throw due to validation schema
            await expect(handler({ senderFrame: { url: 'file://valid' } }, 'http://127.0.0.1/secret.json', 'test.mp4'))
                .rejects.toThrow(/Invalid URL/);
        });

        it('should block SSRF via DNS resolution (validateSafeUrlAsync)', async () => {
            const handler = handlers['video:save-asset'];
            const { validateSafeUrlAsync } = await import('../utils/network-security');

            // Mock validation failure (Simulate DNS resolving to private IP)
            (validateSafeUrlAsync as any).mockImplementationOnce(async () => {
                throw new Error('Security Violation: Domain resolves to private IP');
            });

            // URL looks valid to schema (public domain) but fails DNS check
            await expect(handler({ senderFrame: { url: 'file://valid' } }, 'http://localtest.me/secret.json', 'test.mp4'))
                .rejects.toThrow('Security Violation: Domain resolves to private IP');
        });

        it('should sanitize filename to prevent path traversal', async () => {
            const handler = handlers['video:save-asset'];
            const fs = await import('fs');

            // Mock successful fetch
            (global.fetch as any).mockResolvedValue({
                ok: true,
                body: new ReadableStream({
                    start(controller) {
                        controller.close();
                    }
                })
                body: new ReadableStream(), // Empty stream
                statusText: 'OK'
            });

            // Attack: Try to write to /etc/passwd
            await handler(
                { senderFrame: { url: 'file:///app/index.html' } },
                'http://example.com/video.mp4',
                '../../../../etc/passwd'
            );

            await invoke('video:save-asset', { senderFrame: { url: 'file://valid' } }, 'http://example.com/video.mp4', 'valid/file.mp4');
            // Verify: Path should be sanitized to just 'passwd' inside the asset dir
            // Mock path is /mock/documents/IndiiOS/Assets/Video
            expect(fs.createWriteStream).toHaveBeenCalledWith(
                expect.stringMatching(/\/IndiiOS\/Assets\/Video\/passwd$/)
            );

            // Explicitly verify it did NOT try to write to /etc/passwd
            // Note: Since we mock path.join, the result is predictable
            const calls = (fs.createWriteStream as any).mock.calls;
            const lastCallPath = calls[calls.length - 1][0];
            expect(lastCallPath).not.toContain('../');
            expect(lastCallPath).not.toMatch(/^\/etc\/passwd/);
        });
    });

    describe('video:open-folder', () => {
        it('should validate sender', async () => {
            const handler = handlers['video:open-folder'];
            const { validateSender } = await import('../utils/ipc-security');
             (validateSender as any).mockImplementationOnce(() => {
                throw new Error('Security: Unauthorized sender URL');
            });

            await expect(handler({ senderFrame: { url: 'bad://url' } }))
                .rejects.toThrow('Security: Unauthorized sender URL');
        });

        it('should block path traversal outside asset directory', async () => {
             const handler = handlers['video:open-folder'];

             // Attack: try to open /etc/passwd via traversal
             // The mock documents path is /mock/documents
             // Asset path: /mock/documents/IndiiOS/Assets/Video
             // Traversal: ../../../../../etc/passwd

             await expect(handler({ senderFrame: { url: 'file://valid' } }, '../../../../../etc/passwd'))
                .rejects.toThrow(/Access Denied|Security/);
        });

        it('should block partial directory name matching', async () => {
            const handler = handlers['video:open-folder'];
            const shell = await import('electron').then(m => m.shell);

            // Asset Dir: /mock/documents/IndiiOS/Assets/Video
            // Attack Path: /mock/documents/IndiiOS/Assets/Video_Secret

            // This simulates a sibling directory that shares the prefix "Video"
            const attackPath = '/mock/documents/IndiiOS/Assets/Video_Secret';

            await expect(handler({ senderFrame: { url: 'file://valid' } }, attackPath))
                .rejects.toThrow(/Access Denied/);

            expect(shell.showItemInFolder).not.toHaveBeenCalled();
       });
    });
});
