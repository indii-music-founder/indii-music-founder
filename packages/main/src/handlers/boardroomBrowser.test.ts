import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    ipcMainHandlers: new Map<string, (...args: unknown[]) => unknown>(),
    onBeforeRequest: vi.fn(),
    safeUrl: vi.fn(async (url: string) => {
        if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('169.254.169.254')) throw new Error('Security Violation: Access to private network or metadata is denied.');
    }),
    shellOpenExternal: vi.fn(),
    mockWebContents: {
        loadURL: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn(() => ''),
        canGoBack: vi.fn(() => true),
        canGoForward: vi.fn(() => false),
        goBack: vi.fn(),
        goForward: vi.fn(),
        reload: vi.fn(),
        executeJavaScript: vi.fn().mockResolvedValue({
            title: 'Spotify for Artists',
            url: 'https://artists.spotify.com',
            text: 'Track your streaming performance.',
        }),
        on: vi.fn(),
        setWindowOpenHandler: vi.fn(),
    },
    mockContentView: {
        addChildView: vi.fn(),
        removeChildView: vi.fn(),
    },
    mockParentWindow: {
        isDestroyed: vi.fn(() => false),
        contentView: {
            addChildView: vi.fn(),
            removeChildView: vi.fn(),
        },
        webContents: {
            send: vi.fn(),
        },
    },
}));

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            mocks.ipcMainHandlers.set(channel, handler);
        }),
    },
    shell: {
        openExternal: mocks.shellOpenExternal,
    },
    session: {
        fromPartition: vi.fn(() => ({
            setPermissionRequestHandler: vi.fn(),
            setPermissionCheckHandler: vi.fn(),
            webRequest: { onBeforeRequest: mocks.onBeforeRequest },
        })),
    },
    BrowserWindow: {
        fromWebContents: vi.fn(() => mocks.mockParentWindow),
    },
    WebContentsView: class MockWebContentsView {
        webContents = mocks.mockWebContents;
        setBounds = vi.fn();
        setVisible = vi.fn();
    },
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn((event: { senderFrame?: { url: string } }) => {
        if (!event?.senderFrame?.url || event.senderFrame.url.includes('malicious.com')) {
            throw new Error('Security: Unauthorized sender URL');
        }
    }),
}));

vi.mock('../utils/network-security', () => ({
    validateSafeUrlAsync: mocks.safeUrl,
}));

import { registerBoardroomBrowserHandlers } from './boardroomBrowser';

const frameRequestHandler = mocks.onBeforeRequest.mock.calls[0]?.[0] as (details: { url: string; resourceType: string }, callback: (result: { cancel: boolean }) => void) => void;

describe('BoardroomBrowser IPC Handlers', () => {
    beforeEach(() => {
        mocks.ipcMainHandlers.clear();
        vi.clearAllMocks();
        registerBoardroomBrowserHandlers();
    });

    it('registers all required boardroom-browser IPC channels', () => {
        const expectedChannels = [
            'boardroom-browser:attach',
            'boardroom-browser:set-bounds',
            'boardroom-browser:navigate',
            'boardroom-browser:go-back',
            'boardroom-browser:go-forward',
            'boardroom-browser:reload',
            'boardroom-browser:capture-context',
            'boardroom-browser:detach',
            'boardroom-browser:open-external',
        ];

        expectedChannels.forEach((channel) => {
            expect(mocks.ipcMainHandlers.has(channel)).toBe(true);
        });
    });

    it('rejects unauthorized senders', async () => {
        const attachHandler = mocks.ipcMainHandlers.get('boardroom-browser:attach')!;
        const mockBadEvent = { sender: { id: 1 }, senderFrame: { url: 'https://malicious.com' } };

        const result = (await attachHandler(mockBadEvent, {})) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Unauthorized sender URL/);
    });

    it('blocks SSRF navigation attempts to localhost and metadata IPs', async () => {
        const navigateHandler = mocks.ipcMainHandlers.get('boardroom-browser:navigate')!;
        const mockGoodEvent = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };

        const resultLocal = (await navigateHandler(mockGoodEvent, { url: 'http://127.0.0.1:8080' })) as { success: boolean; error?: string };
        expect(resultLocal.success).toBe(false);
        expect(resultLocal.error).toMatch(/Security Violation/);

        const resultMetadata = (await navigateHandler(mockGoodEvent, { url: 'http://169.254.169.254/latest/meta-data' })) as { success: boolean; error?: string };
        expect(resultMetadata.success).toBe(false);
        expect(resultMetadata.error).toMatch(/Security Violation/);
    });

    it('attaches to parent window and loads valid URLs', async () => {
        const attachHandler = mocks.ipcMainHandlers.get('boardroom-browser:attach')!;
        const mockGoodEvent = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };

        const result = (await attachHandler(mockGoodEvent, { initialUrl: 'https://artists.spotify.com' })) as { success: boolean; state: unknown; error?: string };
        if (!result.success) {
            console.error('ATTACH FAILURE ERROR:', result.error);
        }
        expect(result.success).toBe(true);
        expect(mocks.mockWebContents.loadURL).toHaveBeenCalledWith('https://artists.spotify.com');
    });

    it('updates bounds and visibility', async () => {
        const setBoundsHandler = mocks.ipcMainHandlers.get('boardroom-browser:set-bounds')!;
        const mockGoodEvent = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };

        const result = (await setBoundsHandler(mockGoodEvent, {
            x: 100,
            y: 80,
            width: 600,
            height: 400,
            visible: true,
        })) as { success: boolean };

        expect(result.success).toBe(true);
    });

    it('captures text context from the active webpage', async () => {
        const captureHandler = mocks.ipcMainHandlers.get('boardroom-browser:capture-context')!;
        const mockGoodEvent = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };

        const result = (await captureHandler(mockGoodEvent)) as {
            success: boolean;
            data: { title: string; url: string; text: string };
        };

        expect(result.success).toBe(true);
        expect(result.data.title).toBe('Spotify for Artists');
        expect(result.data.text).toContain('streaming performance');
    });

    it('rejects capture during loading and after a main-frame load failure', async () => {
        const event = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };
        await mocks.ipcMainHandlers.get('boardroom-browser:detach')!(event);
        await mocks.ipcMainHandlers.get('boardroom-browser:attach')!(event, { initialUrl: 'https://artists.spotify.com' });
        const listener = (name: string) => mocks.mockWebContents.on.mock.calls.find(([channel]) => channel === name)?.[1] as (...args: unknown[]) => void;
        const capture = mocks.ipcMainHandlers.get('boardroom-browser:capture-context')!;
        listener('did-start-loading')();
        expect(await capture(event)).toMatchObject({ success: false, error: expect.stringContaining('loading or failed') });
        listener('did-fail-load')({}, -105, 'NAME_NOT_RESOLVED', 'https://bad.example', true);
        expect(await capture(event)).toMatchObject({ success: false, error: expect.stringContaining('loading or failed') });
        expect(mocks.mockWebContents.executeJavaScript).not.toHaveBeenCalled();
        listener('did-start-loading')();
        listener('did-fail-load')({}, -105, 'subframe failed', 'https://frame.example', false);
        listener('did-stop-loading')();
        expect(await capture(event)).toMatchObject({ success: true });
    });

    it('rejects a capture if navigation starts before extraction completes', async () => {
        const event = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };
        await mocks.ipcMainHandlers.get('boardroom-browser:detach')!(event);
        await mocks.ipcMainHandlers.get('boardroom-browser:attach')!(event, { initialUrl: 'https://artists.spotify.com' });
        const listener = (name: string) => mocks.mockWebContents.on.mock.calls.find(([channel]) => channel === name)?.[1] as (...args: unknown[]) => void;
        listener('did-stop-loading')();
        let complete!: (value: { title: string; url: string; text: string }) => void;
        mocks.mockWebContents.executeJavaScript.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        const result = mocks.ipcMainHandlers.get('boardroom-browser:capture-context')!(event) as Promise<unknown>;
        listener('did-start-loading')();
        complete({ title: 'Old', url: 'https://artists.spotify.com', text: 'Old content' });
        expect(await result).toMatchObject({ success: false, error: expect.stringContaining('changed') });
        listener('did-stop-loading')();
    });

    it('validates frame requests including redirect destinations', async () => {
        const blocked = vi.fn();
        frameRequestHandler({ url: 'http://127.0.0.1/private', resourceType: 'mainFrame' }, blocked);
        await vi.waitFor(() => expect(blocked).toHaveBeenCalledWith({ cancel: true }));
        const allowed = vi.fn();
        frameRequestHandler({ url: 'https://ascap.com', resourceType: 'subFrame' }, allowed);
        await vi.waitFor(() => expect(allowed).toHaveBeenCalledWith({ cancel: false }));
        const blockedFetch = vi.fn();
        frameRequestHandler({ url: 'http://169.254.169.254/metadata', resourceType: 'xhr' }, blockedFetch);
        await vi.waitFor(() => expect(blockedFetch).toHaveBeenCalledWith({ cancel: true }));
        const socket = vi.fn();
        frameRequestHandler({ url: 'ws://127.0.0.1:8080/', resourceType: 'webSocket' }, socket);
        await vi.waitFor(() => expect(socket).toHaveBeenCalledWith({ cancel: true }));
        const localAsset = vi.fn();
        frameRequestHandler({ url: 'data:image/png;base64,AA==', resourceType: 'image' }, localAsset);
        expect(localAsset).toHaveBeenCalledWith({ cancel: false });
        const image = vi.fn();
        frameRequestHandler({ url: 'https://ascap.com/image.png', resourceType: 'image' }, image);
        await vi.waitFor(() => expect(image).toHaveBeenCalledWith({ cancel: false }));
    });

    it('cancels stalled validation once and ignores a late DNS result', async () => {
        vi.useFakeTimers();
        try {
            let finish!: () => void;
            mocks.safeUrl.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
            const callback = vi.fn();
            frameRequestHandler({ url: 'https://slow.example/', resourceType: 'mainFrame' }, callback);
            await vi.advanceTimersByTimeAsync(5_000);
            expect(callback).toHaveBeenCalledOnce();
            expect(callback).toHaveBeenCalledWith({ cancel: true });
            finish();
            await Promise.resolve();
            expect(callback).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it('validates popup destinations before navigating the existing view', async () => {
        const event = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };
        await mocks.ipcMainHandlers.get('boardroom-browser:detach')!(event);
        await mocks.ipcMainHandlers.get('boardroom-browser:attach')!(event, { initialUrl: 'https://artists.spotify.com' });
        const handler = mocks.mockWebContents.setWindowOpenHandler.mock.calls.at(-1)?.[0] as (details: { url: string }) => { action: string };
        mocks.mockWebContents.loadURL.mockClear();
        expect(handler({ url: 'http://127.0.0.1/private' })).toEqual({ action: 'deny' });
        await vi.waitFor(() => expect(mocks.mockWebContents.loadURL).not.toHaveBeenCalled());
        expect(handler({ url: 'https://ascap.com' })).toEqual({ action: 'deny' });
        await vi.waitFor(() => expect(mocks.mockWebContents.loadURL).toHaveBeenCalledWith('https://ascap.com'));
        expect(mocks.mockWebContents.loadURL).toHaveBeenCalledTimes(1);
    });

    it('does not navigate to a popup after a newer page navigation starts', async () => {
        const event = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };
        await mocks.ipcMainHandlers.get('boardroom-browser:detach')!(event);
        await mocks.ipcMainHandlers.get('boardroom-browser:attach')!(event, { initialUrl: 'https://artists.spotify.com' });
        const handler = mocks.mockWebContents.setWindowOpenHandler.mock.calls.at(-1)?.[0] as (details: { url: string }) => { action: string };
        const start = mocks.mockWebContents.on.mock.calls.find(([channel]) => channel === 'did-start-loading')?.[1] as () => void;
        let finish!: () => void;
        mocks.safeUrl.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        mocks.mockWebContents.loadURL.mockClear();
        handler({ url: 'https://ascap.com' });
        start();
        finish();
        await Promise.resolve();
        await Promise.resolve();
        expect(mocks.mockWebContents.loadURL).not.toHaveBeenCalled();
    });

    it('opens URL in external OS browser', async () => {
        const openExternalHandler = mocks.ipcMainHandlers.get('boardroom-browser:open-external')!;
        const mockGoodEvent = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };

        const result = (await openExternalHandler(mockGoodEvent, 'https://ascap.com')) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mocks.shellOpenExternal).toHaveBeenCalledWith('https://ascap.com');
    });
});
