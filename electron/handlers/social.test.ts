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
                const promise = oauthHandler(mockEvent, 'twitter');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should create BrowserWindow for OAuth flow', async () => {
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
                    width: 600,
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

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler;
                }
            });

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