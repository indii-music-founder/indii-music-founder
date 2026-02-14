import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron modules
const mockIpcMain = {
    handle: vi.fn()
};

const mockBrowserWindow = vi.fn(function(this: any, opts: any) {
    Object.assign(this, {
        loadURL: vi.fn().mockResolvedValue(undefined),
        webContents: { on: vi.fn() },
        on: vi.fn(),
        close: vi.fn()
    });
    return this;
});
const mockValidateSender = vi.fn();
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

// Constructor Spy
const mockBrowserWindowConstructor = vi.fn();

// MockBrowserWindow plain function
const MockBrowserWindow = vi.fn();
MockBrowserWindow.mockImplementation(function(this: any, options: any) {
    mockBrowserWindowConstructor(options);
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

const mockValidateSender = vi.fn();
const mockGetCredentials = vi.fn();

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
}));

describe('Social Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should register social:connect-oauth handler', async () => {
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
            'social:connect-oauth',
            expect.any(Function)
        );
    });

    it('should register social:get-token handler', async () => {
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
            'social:get-token',
            expect.any(Function)
        );
    });

    describe('social:connect-oauth', () => {
        it('should validate sender before processing', async () => {
            let oauthHandler: IpcHandler | undefined;
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler;
                }
            });

            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            expect(oauthHandler).toBeDefined();

            const mockEvent = { sender: {} };

            // Call the handler
            if (oauthHandler) {
                 // Trigger the promise but don't await it yet if it hangs on window close
                 oauthHandler(mockEvent, 'twitter');

                 expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                // We don't await because it might hang waiting for window close
                // We need to trigger the closed event to resolve the promise if it awaits window close
                // But validation happens before window creation usually

                // Let's just mock window creation to return immediately or handle the promise
                const promise = oauthHandler(mockEvent, 'twitter');

                // Simulate window closed to resolve the promise if it's waiting
                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }

                await promise;
                try {
                   await promise;
                } catch (e) {
                    // Ignore errors during execution, we just want to check validation
                }

                // Mock the promise resolution
                const promise = oauthHandler(mockEvent, 'twitter');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should create BrowserWindow for OAuth flow', async () => {
            let oauthHandler: IpcHandler | undefined;
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler;
                }
            });

            const { registerSocialHandlers: register } = await import('./social');
            register();

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                oauthHandler(mockEvent, 'twitter');

                expect(mockBrowserWindow).toHaveBeenCalledWith({
                // Simulate window closed to resolve
                // We need to capture the 'on' call to trigger 'closed'
                // Since `oauthHandler` runs synchronously until `await new Promise`,
                // `mockOn` should have been called by now.

                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }


                // Simulate window closed to resolve
                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }


                // Simulate window closed to resolve
                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }

                await promise;

                expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(expect.objectContaining({
                    title: 'Connect to Twitter',
                    width: 600,
                    height: 800
                    height: 800,
                    show: true,
                    title: 'Connect to Twitter',
                    autoHideMenuBar: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true
                    }
                });
            }
        });

        it('should load mock OAuth page', async () => {
            let oauthHandler: IpcHandler | undefined;
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler;
                }
            });

            const { registerSocialHandlers: register } = await import('./social');
            register();

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                oauthHandler(mockEvent, 'twitter');

                // Get the instance created by new BrowserWindow()
                const instance = mockBrowserWindow.mock.instances[0];
                expect(instance.loadURL).toHaveBeenCalled();
                const loadedUrl = instance.loadURL.mock.calls[0][0];
                expect(loadedUrl).toContain('data:text/html');
            }
        });
    });

    describe('social:get-token', () => {
        it('should validate sender before processing', async () => {
             let tokenHandler: ((...args: any[]) => any) | undefined;
            let tokenHandler: IpcHandler | undefined;
            let tokenHandler: ((...args: any[]) => any) | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler;
                }
            });

            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            const mockEvent = { sender: {} };

            if (tokenHandler) {
                await tokenHandler(mockEvent, 'twitter');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should call credential service to get token', async () => {
            let tokenHandler: IpcHandler | undefined;
            let tokenHandler: ((...args: any[]) => any) | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler;
                }
            });

            mockCredentialService.getCredentials.mockResolvedValue({
                accessToken: 'test-token'
            });

            const { registerSocialHandlers: register } = await import('./social');
            register();

            const mockEvent = { sender: {} };

            if (tokenHandler) {
                await tokenHandler(mockEvent, 'twitter');
                expect(mockCredentialService.getCredentials).toHaveBeenCalledWith('social_twitter');
            }
        });
    });
});