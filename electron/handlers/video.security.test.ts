
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
        (ipcMain.handle as any).mockImplementation((name: string, fn: (...args: any[]) => any) => {
            handlers[name] = fn;
        });
        registerVideoHandlers();
    });

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
                body: new ReadableStream(), // Empty stream
                statusText: 'OK'
            });

            // Attack: Try to write to /etc/passwd
            await handler(
                { senderFrame: { url: 'file:///app/index.html' } },
                'http://example.com/video.mp4',
                '../../../../etc/passwd'
            );

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
    });
});
