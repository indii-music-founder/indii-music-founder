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
const mockBrowserWindow = vi.fn();
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
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockHandle).toHaveBeenCalledWith(
            'social:connect-oauth',
            expect.any(Function)
        );
    });

    it('should register social:get-token handler', async () => {
        const { registerSocialHandlers } = await import('./social');
        registerSocialHandlers();

        expect(mockHandle).toHaveBeenCalledWith(
            'social:get-token',
            expect.any(Function)
        );
    });

    describe('social:connect-oauth', () => {
        it('should validate sender before processing', async () => {
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler as IpcHandler;
                }
            });

            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            expect(oauthHandler).toBeDefined();

            const mockEvent = { sender: {} };

            // Call the handler
            if (oauthHandler) {
                // Mock the promise resolution
                const promise = oauthHandler(mockEvent, 'twitter');

                // Simulate window closed to resolve the promise if it's waiting
                // Find the 'closed' event listener and call it
                const closeCalls = mockOn.mock.calls.filter(call => call[0] === 'closed');
                if (closeCalls.length > 0) {
                     // Invoke the callback
                     closeCalls[0][1]();
                }

                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
            }
        });

        it('should create BrowserWindow for OAuth flow', async () => {
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler as IpcHandler;
                }
            });

            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                const promise = oauthHandler(mockEvent, 'twitter');

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


                // Simulate window closed to resolve
                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }

                await promise;

                expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(expect.objectContaining({
                    width: 600,
                    height: 800,
                    title: 'Connect to Twitter' // Use title case as per implementation logic
                }));
            }
        });

        it('should load mock OAuth page', async () => {
            let oauthHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:connect-oauth') {
                    oauthHandler = handler as IpcHandler;
                }
            });

            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            const mockEvent = { sender: {} };

            if (oauthHandler) {
                const promise = oauthHandler(mockEvent, 'twitter');

                const closeCall = mockOn.mock.calls.find(c => c[0] === 'closed');
                if (closeCall) {
                    closeCall[1]();
                }

                await promise;

                expect(mockLoadURL).toHaveBeenCalled();
                const loadedUrl = mockLoadURL.mock.calls[0][0];
                expect(loadedUrl).toContain('data:text/html');
            }
        });
    });

    describe('social:get-token', () => {
        it('should validate sender before processing', async () => {
            let tokenHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler as IpcHandler;
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

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'social:get-token') {
                    tokenHandler = handler as IpcHandler;
                }
            });

            mockGetCredentials.mockResolvedValue({
                accessToken: 'test-token'
            });

            const { registerSocialHandlers } = await import('./social');
            registerSocialHandlers();

            const mockEvent = { sender: {} };

            if (tokenHandler) {
                await tokenHandler(mockEvent, 'twitter');
                expect(mockGetCredentials).toHaveBeenCalledWith('social_twitter');
            }
        });
    });
});
