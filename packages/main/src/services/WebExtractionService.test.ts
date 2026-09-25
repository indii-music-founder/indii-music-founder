import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebExtractionService } from './WebExtractionService';

const mocks = vi.hoisted(() => ({
    fromPartition: vi.fn(),
    onBeforeRequest: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    clearStorageData: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    setWindowOpenHandler: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    loadURL: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn().mockReturnValue('https://public.example/final'),
    getTitle: vi.fn().mockReturnValue('Public page'),
    executeJavaScript: vi.fn().mockResolvedValue({ title: 'Public page', text: 'page text' }),
    isDestroyed: vi.fn().mockReturnValue(false),
    destroy: vi.fn(),
    windowOpenHandler: vi.fn(),
    requestListener: undefined as unknown,
}));

vi.mock('electron', () => ({
    BrowserWindow: class {
        webContents = {
            setWindowOpenHandler: mocks.setWindowOpenHandler,
            on: mocks.addListener,
            removeListener: mocks.removeListener,
            getURL: mocks.getURL,
            getTitle: mocks.getTitle,
            executeJavaScript: mocks.executeJavaScript,
        };
        loadURL = mocks.loadURL;
        isDestroyed = mocks.isDestroyed;
        destroy = mocks.destroy;
    },
    session: {
        fromPartition: mocks.fromPartition,
    },
}));

vi.mock('node:dns', () => ({
    default: {
        promises: {
            lookup: vi.fn(async (hostname: string) => [{
                address: hostname === 'internal.example' ? '10.1.2.3' : '8.8.8.8',
            }]),
        },
    },
}));

describe('WebExtractionService', () => {
    let service: WebExtractionService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fromPartition.mockImplementation(() => ({
            setPermissionRequestHandler: mocks.setPermissionRequestHandler,
            setPermissionCheckHandler: mocks.setPermissionCheckHandler,
            on: vi.fn(),
            webRequest: {
                onBeforeRequest: (filter: unknown, listener?: unknown) => {
                    mocks.onBeforeRequest(filter, listener);
                    if (listener) mocks.requestListener = listener;
                },
            },
            clearStorageData: mocks.clearStorageData,
            clearCache: mocks.clearCache,
            removeListener: mocks.removeListener,
        }));
        mocks.requestListener = undefined;
        mocks.getURL.mockReturnValue('https://public.example/final');
        mocks.executeJavaScript.mockResolvedValue({ title: 'Public page', text: 'page text' });
        mocks.loadURL.mockResolvedValue(undefined);
        service = new WebExtractionService();
    });

    it('uses an isolated in-memory session and returns bounded text only', async () => {
        mocks.executeJavaScript.mockResolvedValue({ title: 'Public page', text: 'x'.repeat(45_000) });

        const result = await service.extract('https://public.example/start');

        expect(result.finalUrl).toBe('https://public.example/final');
        expect(result.text).toHaveLength(40_000);
        expect(result).not.toHaveProperty('screenshotBase64');
        const [partition, options] = mocks.fromPartition.mock.calls[0] as unknown as [string, { cache: boolean }];
        expect(partition).toBe('web_extract');
        expect(partition).not.toMatch(/^persist:/);
        expect(options).toEqual({ cache: false });
        expect(mocks.setPermissionRequestHandler).toHaveBeenCalled();
        expect(mocks.setPermissionCheckHandler).toHaveBeenCalled();
        expect(mocks.setWindowOpenHandler).toHaveBeenCalledWith(expect.any(Function));
        expect(mocks.destroy).toHaveBeenCalledTimes(1);
        expect(mocks.clearStorageData).toHaveBeenCalledTimes(2);
        expect(mocks.clearCache).toHaveBeenCalledTimes(2);
        expect(mocks.onBeforeRequest).toHaveBeenLastCalledWith(null, undefined);
    });

    it('rejects private destinations before creating a window', async () => {
        await expect(service.extract('http://127.0.0.1/private')).rejects.toThrow(/localhost is denied/);
        expect(mocks.fromPartition).not.toHaveBeenCalled();
    });

    it('blocks a redirect or subresource resolving to a private address', async () => {
        await service.extract('https://public.example/start');
        const listener = mocks.requestListener as ((details: { url: string }, callback: (response: { cancel?: boolean }) => void) => void);

        const response = await new Promise<{ cancel?: boolean }>(resolve => {
            listener({ url: 'https://internal.example/private' }, resolve);
        });

        expect(response).toEqual({ cancel: true });
    });

    it('blocks credential-bearing and non-HTTP subresources', async () => {
        await service.extract('https://public.example/start');
        const listener = mocks.requestListener as ((details: { url: string }, callback: (response: { cancel?: boolean }) => void) => void);

        const credentialResponse = await new Promise<{ cancel?: boolean }>(resolve => {
            listener({ url: 'https://user:secret@public.example/private' }, resolve);
        });
        const socketResponse = await new Promise<{ cancel?: boolean }>(resolve => {
            listener({ url: 'wss://public.example/socket' }, resolve);
        });
        const fileResponse = await new Promise<{ cancel?: boolean }>(resolve => {
            listener({ url: 'file:///private/account.txt' }, resolve);
        });

        expect(credentialResponse).toEqual({ cancel: true });
        expect(socketResponse).toEqual({ cancel: true });
        expect(fileResponse).toEqual({ cancel: true });
        expect(mocks.onBeforeRequest).toHaveBeenCalledWith({ urls: ['<all_urls>'] }, expect.any(Function));
    });

    it('reuses one serialized session partition and clears it between requests', async () => {
        await service.extract('https://public.example/first');
        await service.extract('https://public.example/second');

        expect(mocks.fromPartition).toHaveBeenCalledTimes(2);
        expect(mocks.fromPartition).toHaveBeenNthCalledWith(1, 'web_extract', { cache: false });
        expect(mocks.fromPartition).toHaveBeenNthCalledWith(2, 'web_extract', { cache: false });
        expect(mocks.clearStorageData).toHaveBeenCalledTimes(4);
        expect(mocks.clearCache).toHaveBeenCalledTimes(4);
    });

    it('always destroys the window and clears its session after navigation failure', async () => {
        mocks.loadURL.mockRejectedValueOnce(new Error('navigation failed'));

        await expect(service.extract('https://public.example/start')).rejects.toThrow('navigation failed');
        expect(mocks.destroy).toHaveBeenCalledTimes(1);
        expect(mocks.clearStorageData).toHaveBeenCalledTimes(2);
        expect(mocks.clearCache).toHaveBeenCalledTimes(2);
    });
});
