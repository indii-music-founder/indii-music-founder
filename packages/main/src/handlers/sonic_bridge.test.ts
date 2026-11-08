import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSonicBridgeHandlers, _resetWatcherForTesting } from './sonic_bridge';
import { accessControlService } from '../security/AccessControlService';
import { dialog, BrowserWindow } from 'electron';
import chokidar from 'chokidar';

const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn(),
    },
    grantAccess: vi.fn(),
    verifyAccess: vi.fn().mockReturnValue(true),
    showOpenDialog: vi.fn(),
    fromWebContents: vi.fn(),
    watch: vi.fn(),
}));

vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    dialog: {
        showOpenDialog: mocks.showOpenDialog,
    },
    BrowserWindow: {
        fromWebContents: mocks.fromWebContents,
    },
    app: {
        isPackaged: false,
        getAppPath: () => '/app',
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn(),
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        grantAccess: mocks.grantAccess,
        verifyAccess: mocks.verifyAccess,
    },
}));

vi.mock('chokidar', () => ({
    default: {
        watch: mocks.watch,
    },
}));

describe('Sonic Bridge IPC Handlers', () => {
    let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> = {};
    let mockWatcher: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
    let watcherCallbacks: Record<string, (...args: unknown[]) => void> = {};

    beforeEach(async () => {
        vi.clearAllMocks();
        handlers = {};
        watcherCallbacks = {};

        await _resetWatcherForTesting();

        mockWatcher = {
            on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
                watcherCallbacks[event] = cb;
                return mockWatcher;
            }),
            close: vi.fn().mockResolvedValue(undefined),
        };
        mocks.watch.mockReturnValue(mockWatcher);

        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
            handlers[channel] = handler;
        });

        registerSonicBridgeHandlers();
    });

    const createMockWindow = () => {
        const emitter = new EventEmitter();
        return Object.assign(emitter, {
            isDestroyed: vi.fn().mockReturnValue(false),
            webContents: {
                isDestroyed: vi.fn().mockReturnValue(false),
                send: vi.fn(),
            },
        });
    };

    it('registers sonic bridge handlers', () => {
        expect(handlers['sonic-bridge:watch-folder']).toBeDefined();
        expect(handlers['sonic-bridge:stop-watching']).toBeDefined();
    });

    it('grants accessControlService permission to chosen watchPath upon folder selection', async () => {
        const win = createMockWindow();
        mocks.fromWebContents.mockReturnValue(win);
        mocks.showOpenDialog.mockResolvedValue({
            canceled: false,
            filePaths: ['/Users/artist/Music/Ableton/Bounces'],
        });

        const result = await handlers['sonic-bridge:watch-folder']({ sender: {} }) as { success: boolean; path?: string };

        expect(result.success).toBe(true);
        expect(result.path).toBe('/Users/artist/Music/Ableton/Bounces');
        expect(mocks.grantAccess).toHaveBeenCalledWith('/Users/artist/Music/Ableton/Bounces');
        expect(mocks.watch).toHaveBeenCalledWith('/Users/artist/Music/Ableton/Bounces', expect.objectContaining({ depth: 0 }));
    });

    it('grants accessControlService permission to newly added bounce files and dispatches event', async () => {
        const win = createMockWindow();
        mocks.fromWebContents.mockReturnValue(win);
        mocks.showOpenDialog.mockResolvedValue({
            canceled: false,
            filePaths: ['/Users/artist/Music/Ableton/Bounces'],
        });

        await handlers['sonic-bridge:watch-folder']({ sender: {} });

        expect(watcherCallbacks['add']).toBeDefined();

        // Simulate DAW bounce appearing in directory
        const newBouncePath = '/Users/artist/Music/Ableton/Bounces/NewTrack_Master_v1.wav';
        watcherCallbacks['add'](newBouncePath);

        expect(mocks.grantAccess).toHaveBeenCalledWith(newBouncePath);
        expect(win.webContents.send).toHaveBeenCalledWith('sonic-bridge:new-bounce', {
            path: newBouncePath,
            name: 'NewTrack_Master_v1.wav',
            timestamp: expect.any(Number),
        });
    });

    it('cleans up watcher when the renderer window closes', async () => {
        const win = createMockWindow();
        mocks.fromWebContents.mockReturnValue(win);
        mocks.showOpenDialog.mockResolvedValue({
            canceled: false,
            filePaths: ['/Users/artist/Music/Ableton/Bounces'],
        });

        await handlers['sonic-bridge:watch-folder']({ sender: {} });

        expect(mockWatcher.close).not.toHaveBeenCalled();

        // Emit window closed event
        win.emit('closed');

        expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('stops watching cleanly via sonic-bridge:stop-watching', async () => {
        const win = createMockWindow();
        mocks.fromWebContents.mockReturnValue(win);
        mocks.showOpenDialog.mockResolvedValue({
            canceled: false,
            filePaths: ['/Users/artist/Music/Ableton/Bounces'],
        });

        await handlers['sonic-bridge:watch-folder']({ sender: {} });

        const stopResult = await handlers['sonic-bridge:stop-watching']({ sender: {} }) as { success: boolean };
        expect(stopResult.success).toBe(true);
        expect(mockWatcher.close).toHaveBeenCalled();
    });
});
