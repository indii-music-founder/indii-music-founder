import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDawHandlers } from './daw';
import { dawServer } from '../daw-server';
import { BrowserWindow } from 'electron';

const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn(),
    },
    validateSender: vi.fn(),
    getAllWindows: vi.fn(),
}));

vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    BrowserWindow: {
        getAllWindows: mocks.getAllWindows,
    },
    app: {
        isPackaged: false,
        getAppPath: () => '/app',
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender,
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('DAW Handlers & Error Handling', () => {
    let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
            handlers[channel] = handler;
        });

        registerDawHandlers();
    });

    it('registers all daw IPC endpoints', () => {
        expect(handlers['daw:start']).toBeDefined();
        expect(handlers['daw:stop']).toBeDefined();
        expect(handlers['daw:get-connection-info']).toBeDefined();
        expect(handlers['daw:get-state']).toBeDefined();
    });

    it('attaches persistent error listener to dawServer preventing uncaught exception crash', () => {
        expect(dawServer.listenerCount('error')).toBeGreaterThan(0);

        // Emitting an error on dawServer must not throw unhandled exception
        const mockError = new Error('listen EADDRINUSE: address already in use 127.0.0.1:8081');
        expect(() => {
            dawServer.emit('error', mockError);
        }).not.toThrow();
    });

    it('invokes dawServer start and stop via IPC', async () => {
        const startSpy = vi.spyOn(dawServer, 'start').mockResolvedValue(undefined);
        const stopSpy = vi.spyOn(dawServer, 'stop').mockResolvedValue(undefined);

        const mockEvent = { sender: {} };
        const startResult = await handlers['daw:start'](mockEvent);
        expect(startResult).toBe(true);
        expect(startSpy).toHaveBeenCalled();

        const stopResult = await handlers['daw:stop'](mockEvent);
        expect(stopResult).toBe(true);
        expect(stopSpy).toHaveBeenCalled();

        startSpy.mockRestore();
        stopSpy.mockRestore();
    });

    it('broadcasts state changes to active browser windows', () => {
        const mockWin = {
            isDestroyed: vi.fn().mockReturnValue(false),
            webContents: {
                isDestroyed: vi.fn().mockReturnValue(false),
                send: vi.fn(),
            },
        };
        mocks.getAllWindows.mockReturnValue([mockWin]);

        const newState = { bpm: 128, isPlaying: true, currentTime: 14.5, trackNames: ['Kick', 'Bass'] };
        dawServer.emit('state-changed', newState);

        expect(mockWin.webContents.send).toHaveBeenCalledWith('daw:state-changed', newState);
    });
});
