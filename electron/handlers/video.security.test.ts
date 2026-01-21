
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
    const actual = await vi.importActual('path');
    const mocked = {
        ...actual as any,
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
