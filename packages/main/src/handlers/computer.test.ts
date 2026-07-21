import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerComputerHandlers } from './computer';

const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    computerExecutionService: {
        getPermissionStatus: vi.fn(() => ({ platform: 'darwin', supported: true, screenRecording: 'granted', accessibility: 'granted', guidance: [] })),
        screenshot: vi.fn().mockResolvedValue({ base64: 'x', width: 1, height: 1, displayId: 1 }),
        listApps: vi.fn().mockResolvedValue(['Safari']),
        openApp: vi.fn().mockResolvedValue(undefined),
        click: vi.fn().mockResolvedValue(undefined),
        type: vi.fn().mockResolvedValue(undefined),
        key: vi.fn().mockResolvedValue(undefined),
        scroll: vi.fn().mockResolvedValue(undefined),
        abort: vi.fn(),
        resetAbort: vi.fn(),
        isAborted: vi.fn(() => false)
    },
    computerAllowlistStore: {
        getAll: vi.fn(() => ['Safari']),
        add: vi.fn(),
        remove: vi.fn()
    }
}));

vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: { isPackaged: false, getAppPath: vi.fn(() => '/app'), getPath: vi.fn(() => '/mock/user-data') }
}));
vi.mock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/ComputerExecutionService', () => ({ computerExecutionService: mocks.computerExecutionService }));
vi.mock('../services/computer/ComputerAllowlistStore', () => ({ computerAllowlistStore: mocks.computerAllowlistStore }));

interface HandlerResult {
    success: boolean;
    error?: string;
    data?: unknown;
}

describe('🛡️ Shield: Computer IPC Security Test (ISSUE-1110/1111)', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });
        registerComputerHandlers();
    });

    const goodEvent = { senderFrame: { url: 'file:///app/index.html' } };
    const badEvent = { senderFrame: { url: 'https://evil.example.com' } };
    const invoke = async (channel: string, event: unknown, ...args: unknown[]): Promise<HandlerResult> => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    it('registers every expected computer:* channel', () => {
        const expected = [
            'computer:check-permissions', 'computer:screenshot', 'computer:list-apps', 'computer:open-app',
            'computer:click', 'computer:type', 'computer:key', 'computer:scroll',
            'computer:abort', 'computer:reset-abort', 'computer:get-abort-state',
            'computer:allowlist-get', 'computer:allowlist-add', 'computer:allowlist-remove'
        ];
        for (const channel of expected) {
            expect(handlers[channel]).toBeDefined();
        }
    });

    it('BLOCKS every channel for an untrusted sender frame', async () => {
        const result = await invoke('computer:screenshot', badEvent);
        expect(result.success).toBe(false);
        expect(mocks.computerExecutionService.screenshot).not.toHaveBeenCalled();
    });

    describe('computer:click', () => {
        it('rejects out-of-range coordinates', async () => {
            const result = await invoke('computer:click', goodEvent, { x: 99999, y: 1, button: 'left' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Validation Error/);
            expect(mocks.computerExecutionService.click).not.toHaveBeenCalled();
        });

        it('defaults button to left and forwards valid coordinates', async () => {
            const result = await invoke('computer:click', goodEvent, { x: 10, y: 20 });
            expect(result.success).toBe(true);
            expect(mocks.computerExecutionService.click).toHaveBeenCalledWith(10, 20, 'left');
        });

        it('propagates a kill-switch rejection from the service as a clean error envelope', async () => {
            mocks.computerExecutionService.click.mockRejectedValueOnce(new Error('Computer control was aborted (kill switch active).'));
            const result = await invoke('computer:click', goodEvent, { x: 1, y: 1, button: 'left' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/kill switch/i);
        });
    });

    describe('computer:type', () => {
        it('rejects text containing control characters', async () => {
            const result = await invoke('computer:type', goodEvent, { text: 'hello\x07world' });
            expect(result.success).toBe(false);
            expect(mocks.computerExecutionService.type).not.toHaveBeenCalled();
        });

        it('forwards clean text', async () => {
            const result = await invoke('computer:type', goodEvent, { text: 'hello world' });
            expect(result.success).toBe(true);
            expect(mocks.computerExecutionService.type).toHaveBeenCalledWith('hello world');
        });
    });

    describe('computer:key', () => {
        it('rejects a combo with disallowed characters', async () => {
            const result = await invoke('computer:key', goodEvent, { combo: 'cmd; rm -rf /' });
            expect(result.success).toBe(false);
            expect(mocks.computerExecutionService.key).not.toHaveBeenCalled();
        });

        it('forwards a clean combo', async () => {
            const result = await invoke('computer:key', goodEvent, { combo: 'cmd+c' });
            expect(result.success).toBe(true);
            expect(mocks.computerExecutionService.key).toHaveBeenCalledWith('cmd+c');
        });
    });

    describe('computer:scroll', () => {
        it('rejects deltas outside the bounded range', async () => {
            const result = await invoke('computer:scroll', goodEvent, { dx: 0, dy: 999999 });
            expect(result.success).toBe(false);
            expect(mocks.computerExecutionService.scroll).not.toHaveBeenCalled();
        });
    });

    describe('computer:open-app', () => {
        it('rejects an app string that looks like a CLI flag', async () => {
            const result = await invoke('computer:open-app', goodEvent, '-badflag');
            expect(result.success).toBe(false);
            expect(mocks.computerExecutionService.openApp).not.toHaveBeenCalled();
        });

        it('propagates an allowlist rejection from the service', async () => {
            mocks.computerExecutionService.openApp.mockRejectedValueOnce(new Error('App "Chrome" is not on the computer-control allowlist.'));
            const result = await invoke('computer:open-app', goodEvent, 'Chrome');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/allowlist/);
        });
    });

    describe('kill switch channels', () => {
        it('abort/reset-abort/get-abort-state all require a valid sender', async () => {
            const abortResult = await invoke('computer:abort', badEvent);
            expect(abortResult.success).toBe(false);
            expect(mocks.computerExecutionService.abort).not.toHaveBeenCalled();

            const okAbort = await invoke('computer:abort', goodEvent);
            expect(okAbort.success).toBe(true);
            expect(mocks.computerExecutionService.abort).toHaveBeenCalled();
        });
    });

    describe('allowlist management channels', () => {
        it('validates the app string on add/remove', async () => {
            const result = await invoke('computer:allowlist-add', goodEvent, '--evil');
            expect(result.success).toBe(false);
            expect(mocks.computerAllowlistStore.add).not.toHaveBeenCalled();
        });

        it('adds a valid app name', async () => {
            const result = await invoke('computer:allowlist-add', goodEvent, 'Safari');
            expect(result.success).toBe(true);
            expect(mocks.computerAllowlistStore.add).toHaveBeenCalledWith('Safari');
        });
    });
});
