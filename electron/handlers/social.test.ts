import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-friendly handler type
type IpcHandler = (...args: unknown[]) => unknown;

// Mock Electron modules
const mockIpcMain = {
    handle: vi.fn()
};

const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockWebContentsOn = vi.fn();
const mockOn = vi.fn();
const mockClose = vi.fn();

const MockBrowserWindow = vi.fn();
MockBrowserWindow.mockImplementation(function(this: any) {
    return {
        loadURL: mockLoadURL,
        webContents: {
            on: mockWebContentsOn
        },
        on: mockOn,
        close: mockClose
    };
} as any);

const mockValidateSender = vi.fn();
const mockGetCredentials = vi.fn();
const mockCredentialService = {
    getCredentials: vi.fn()
};

vi.mock('electron', () => ({
    ipcMain: mockIpcMain,
    BrowserWindow: mockBrowserWindow,
// Define mocks
const mockHandle = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockWebContentsOn = vi.fn();
const mockOn = vi.fn();
const mockClose = vi.fn();
const mockValidateSender = vi.fn();
const mockGetCredentials = vi.fn();

// Constructor Spy
const mockBrowserWindowConstructor = vi.fn();

// MockBrowserWindow plain function
const MockBrowserWindow = function(options: any) {
    mockBrowserWindowConstructor(options);
    return {
        loadURL: mockLoadURL,
        webContents: {
            on: mockWebContentsOn
        },
        on: mockOn,
        close: mockClose
    };
};

vi.mock('electron', () => ({
    ipcMain: {
        handle: mockHandle
    },
    BrowserWindow: MockBrowserWindow,
    shell: {}
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mockValidateSender
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: mockCredentialService
    credentialService: {
        getCredentials: mockGetCredentials
    }
}));

describe('Social Handler', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('should register social:connect-oauth handler', async () => {
        // Import after mocks are set up
        await import('./social');

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockHandle).toHaveBeenCalledWith(
            'social:connect-oauth',
            expect.any(Function)
        );
    });

    it('should register social:get-token handler', async () => {
        await import('./social');

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockHandle).toHaveBeenCalledWith(
            'social:get-token',
            expect.any(Function)
        );
    });

    describe('social:connect-oauth', () => {
        it('should validate sender before processing', async () => {
            let oauthHandler: IpcHandler | undefined;
            let oauthHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler as IpcHandler;
                }
            });

            await import('./social');
            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            expect(oauthHandler).toBeDefined();

            const mockEvent = { sender: {} };
            mockBrowserWindow.mockReturnValue({
                loadURL: vi.fn(),
                webContents: {
                    on: vi.fn()
                },
                on: vi.fn(),
                close: vi.fn()
            });

            // Call the handler
            if (oauthHandler) {
                const promise = oauthHandler(mockEvent, 'twitter');

            if (oauthHandler) {
                const promise = oauthHandler(mockEvent, 'twitter');

                // Simulate window closed to resolve the promise
                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }

                await promise;
            // Call the handler
            if (oauthHandler) {
                oauthHandler(mockEvent, 'twitter');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should create BrowserWindow for OAuth flow', async () => {
            let oauthHandler: IpcHandler | undefined;
            let oauthHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler as IpcHandler;
                }
            });

            const mockWindow = {
                loadURL: vi.fn().mockResolvedValue(undefined),
                webContents: {
                    on: vi.fn()
                },
                on: vi.fn(),
                close: vi.fn()
            };

            mockBrowserWindow.mockReturnValue(mockWindow);

            await import('./social');
            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                const promise = oauthHandler(mockEvent, 'twitter');

                // Simulate window closed to resolve
                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }

                await promise;

                expect(MockBrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
                    width: 600,
                    height: 800,
                    title: 'Connect to Twitter'
                expect(mockBrowserWindow).toHaveBeenCalledWith({
                    width: 600,
                    height: 800,
                    show: true,
                    title: 'Connect to twitter',
                    autoHideMenuBar: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });
                expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(expect.objectContaining({
                    width: 600,
                    height: 800,
                    title: 'Connect to Twitter' // Use title case as per implementation logic
                }));
            }
        });

        it('should load mock OAuth page', async () => {
            let oauthHandler: IpcHandler | undefined;
            let oauthHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler as IpcHandler;
                }
            });

            const mockWindow = {
                loadURL: vi.fn().mockResolvedValue(undefined),
                webContents: {
                    on: vi.fn()
                },
                on: vi.fn(),
                close: vi.fn()
            };

            mockBrowserWindow.mockReturnValue(mockWindow);

            await import('./social');
            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                const promise = oauthHandler(mockEvent, 'twitter');

                // Simulate window closed to resolve
                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }

                await promise;

                expect(mockWindow.loadURL).toHaveBeenCalled();
                const loadedUrl = mockWindow.loadURL.mock.calls[0][0];
                expect(mockLoadURL).toHaveBeenCalled();
                const loadedUrl = mockLoadURL.mock.calls[0][0];
                expect(loadedUrl).toContain('data:text/html');
            }
        });
    });

    describe('social:get-token', () => {
        it('should validate sender before processing', async () => {
            let tokenHandler: IpcHandler | undefined;
            let tokenHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
            let tokenHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler as IpcHandler;
                }
            });

            await import('./social');
            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            expect(tokenHandler).toBeDefined();

            const mockEvent = { sender: {} };

            if (tokenHandler) {
                await tokenHandler(mockEvent, 'twitter');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should call credential service to get token', async () => {
            let tokenHandler: IpcHandler | undefined;
            let tokenHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
            let tokenHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler as IpcHandler;
                }
            });

            mockCredentialService.getCredentials.mockResolvedValue({
                accessToken: 'test-token'
            });

            await import('./social');
            mockGetCredentials.mockResolvedValue({
                accessToken: 'test-token'
            });

            await import('./social');
            mockGetCredentials.mockResolvedValue({
                accessToken: 'test-token'
            });

            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            const mockEvent = { sender: {} };

            if (tokenHandler) {
                await tokenHandler(mockEvent, 'twitter');
                expect(mockCredentialService.getCredentials).toHaveBeenCalledWith('social_twitter');
            }
        });
    });
});
                expect(mockGetCredentials).toHaveBeenCalledWith('social_twitter');
            }
        });
    });
});
                expect(mockGetCredentials).toHaveBeenCalledWith('social_twitter');
            }
        });
    });
});
