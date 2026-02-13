import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron modules
const mockIpcMain = {
    handle: vi.fn()
};

const mockBrowserWindow = vi.fn();
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
    });

    it('should register social:connect-oauth handler', async () => {
        // Import after mocks are set up
        await import('./social');

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
            'social:connect-oauth',
            expect.any(Function)
        );
    });

    it('should register social:get-token handler', async () => {
        await import('./social');

        expect(mockIpcMain.handle).toHaveBeenCalledWith(
            'social:get-token',
            expect.any(Function)
        );
    });

    describe('social:connect-oauth', () => {
        it('should validate sender before processing', async () => {
            let oauthHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler;
                }
            });

            await import('./social');

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
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should create BrowserWindow for OAuth flow', async () => {
            let oauthHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler;
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

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                oauthHandler(mockEvent, 'twitter');

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
            }
        });

        it('should load mock OAuth page', async () => {
            let oauthHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler;
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

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                oauthHandler(mockEvent, 'twitter');

                expect(mockWindow.loadURL).toHaveBeenCalled();
                const loadedUrl = mockWindow.loadURL.mock.calls[0][0];
                expect(loadedUrl).toContain('data:text/html');
            }
        });
    });

    describe('social:get-token', () => {
        it('should validate sender before processing', async () => {
            let tokenHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler;
                }
            });

            await import('./social');

            expect(tokenHandler).toBeDefined();

            const mockEvent = { sender: {} };

            if (tokenHandler) {
                await tokenHandler(mockEvent, 'twitter');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should call credential service to get token', async () => {
            let tokenHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler;
                }
            });

            mockCredentialService.getCredentials.mockResolvedValue({
                accessToken: 'test-token'
            });

            await import('./social');

            const mockEvent = { sender: {} };

            if (tokenHandler) {
                await tokenHandler(mockEvent, 'twitter');
                expect(mockCredentialService.getCredentials).toHaveBeenCalledWith('social_twitter');
            }
        });
    });
});