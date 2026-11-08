import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    ipcMainHandlers: new Map<string, (...args: unknown[]) => unknown>(),
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
    validateSafeUrlAsync: vi.fn(async (url: string) => {
        if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('169.254.169.254')) {
            throw new Error('Security Violation: Access to private network or metadata is denied.');
        }
    }),
}));

import { registerBoardroomBrowserHandlers } from './boardroomBrowser';

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

    it('opens URL in external OS browser', async () => {
        const openExternalHandler = mocks.ipcMainHandlers.get('boardroom-browser:open-external')!;
        const mockGoodEvent = { sender: { id: 1 }, senderFrame: { url: 'http://localhost:4243' } };

        const result = (await openExternalHandler(mockGoodEvent, 'https://ascap.com')) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mocks.shellOpenExternal).toHaveBeenCalledWith('https://ascap.com');
    });
});
