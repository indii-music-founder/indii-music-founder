import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerUpscaleHandlers, resetEngineCache } from './upscale';

const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn(),
    },
    runUpscale: vi.fn(),
    probeEngine: vi.fn(),
    ensureEngineAssets: vi.fn(),
}));

vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: {
        isPackaged: false,
        getPath: () => '/tmp/userdata',
        getAppPath: () => '/app',
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn(),
}));

vi.mock('../services/upscale/UpscaleExecutor', () => ({
    runUpscale: mocks.runUpscale,
    probeEngine: mocks.probeEngine,
}));

vi.mock('../services/upscale/EngineAssetManager', () => ({
    ensureEngineAssets: mocks.ensureEngineAssets,
}));

describe('Upscale IPC Handlers', () => {
    let handlers: Record<string, (event: unknown, raw: unknown) => Promise<unknown>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        resetEngineCache();

        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (event: unknown, raw: unknown) => Promise<unknown>) => {
            handlers[channel] = handler;
        });

        mocks.ensureEngineAssets.mockResolvedValue({
            enginePath: '/tmp/engine/bin',
            version: '1.0.0',
            fromCache: true,
        });

        registerUpscaleHandlers();
    });

    const createMockSender = () => {
        const emitter = new EventEmitter();
        return Object.assign(emitter, {
            isDestroyed: vi.fn().mockReturnValue(false),
            send: vi.fn(),
        });
    };

    it('registers all upscale handlers', () => {
        expect(handlers['upscale:ensure-engine']).toBeDefined();
        expect(handlers['upscale:probe']).toBeDefined();
        expect(handlers['upscale:run']).toBeDefined();
        expect(handlers['upscale:cancel']).toBeDefined();
    });

    it('rejects duplicate requestId when run is already active', async () => {
        const sender = createMockSender();
        const event = { sender };

        let resolveUpscale!: (val: unknown) => void;
        const pendingUpscale = new Promise((resolve) => {
            resolveUpscale = resolve;
        });
        mocks.runUpscale.mockImplementation(() => pendingUpscale);

        const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        // Start first run
        const run1Promise = handlers['upscale:run'](event, {
            requestId: 'req-dup-12345',
            dataUrl: validDataUrl,
            scale: 2,
        });

        // Wait until first run is active
        await vi.waitFor(() => expect(mocks.runUpscale).toHaveBeenCalled());

        // Attempt second run with same requestId before first finishes
        await expect(handlers['upscale:run'](event, {
            requestId: 'req-dup-12345',
            dataUrl: validDataUrl,
            scale: 4,
        })).rejects.toThrow("An upscale run with requestId 'req-dup-12345' is already in progress.");

        // Let the first run fail/finish
        resolveUpscale({ outputPath: '/nonexistent/path', durationMs: 10 });
        await expect(run1Promise).rejects.toThrow();
    });

    it('aborts controller when sender destroyed event fires', async () => {
        const sender = createMockSender();
        const event = { sender };

        let capturedSignal: AbortSignal | undefined;
        mocks.runUpscale.mockImplementation(async (opts: { signal?: AbortSignal }) => {
            capturedSignal = opts.signal;
            return new Promise((_, reject) => {
                opts.signal?.addEventListener('abort', () => {
                    reject(new Error('upscale: aborted'));
                });
            });
        });

        const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const runPromise = handlers['upscale:run'](event, {
            requestId: 'req-abort-12345',
            dataUrl: validDataUrl,
            scale: 2,
        });

        // Wait a tick for runUpscale to be invoked
        await vi.waitFor(() => expect(capturedSignal).toBeDefined());
        expect(capturedSignal?.aborted).toBe(false);

        // Emit destroyed event on sender
        sender.emit('destroyed');

        expect(capturedSignal?.aborted).toBe(true);
        await expect(runPromise).rejects.toThrow('upscale: aborted');
    });

    it('cancels active run via upscale:cancel', async () => {
        const sender = createMockSender();
        const event = { sender };

        let capturedSignal: AbortSignal | undefined;
        mocks.runUpscale.mockImplementation(async (opts: { signal?: AbortSignal }) => {
            capturedSignal = opts.signal;
            return new Promise((_, reject) => {
                opts.signal?.addEventListener('abort', () => {
                    reject(new Error('upscale: aborted'));
                });
            });
        });

        const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const runPromise = handlers['upscale:run'](event, {
            requestId: 'req-cancel-12345',
            dataUrl: validDataUrl,
            scale: 2,
        });

        await vi.waitFor(() => expect(capturedSignal).toBeDefined());

        const cancelResult = await handlers['upscale:cancel'](event, { requestId: 'req-cancel-12345' }) as { cancelled: boolean };
        expect(cancelResult.cancelled).toBe(true);
        expect(capturedSignal?.aborted).toBe(true);

        await expect(runPromise).rejects.toThrow('upscale: aborted');
    });
});
