import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron modules
const mockIpcMain = {
    handle: vi.fn()
};

const mockApp = {
    getVersion: vi.fn(() => '1.0.0')
};

// Create a Plain MockBrowserWindow function
const mockBrowserWindowConstructor = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockPrintToPDF = vi.fn().mockResolvedValue(Buffer.from('pdf-data'));
const mockClose = vi.fn();
const mockSetContentProtection = vi.fn();
const mockFromWebContents = vi.fn();

const MockBrowserWindow = vi.fn();
MockBrowserWindow.mockImplementation(function(this: any, options: any) {
    mockBrowserWindowConstructor(options);
    return {
        loadURL: mockLoadURL,
        webContents: {
            printToPDF: mockPrintToPDF,
            on: vi.fn()
        },
        close: mockClose,
        setContentProtection: mockSetContentProtection
    };
} as any);

// Attach static methods
(MockBrowserWindow as any).fromWebContents = mockFromWebContents;

const mockDialog = {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
};

const mockValidateSender = vi.fn();
const mockAccessControlService = {
    grantAccess: vi.fn()
};

const mockWriteFile = vi.fn().mockResolvedValue(undefined);

vi.mock('electron', () => ({
    app: mockApp,
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow,
    dialog: mockDialog
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mockValidateSender
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mockAccessControlService
}));

vi.mock('fs/promises', () => ({
    writeFile: mockWriteFile
}));

// Type for handler
type IpcHandler = (event: any, ...args: any[]) => Promise<any> | any;

describe('System Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should register all system handlers', async () => {
        const { registerSystemHandlers } = await import('./system');
        registerSystemHandlers();

        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-platform', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-app-version', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('privacy:toggle-protection', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('system:select-file', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('system:select-directory', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('system:save-pdf', expect.any(Function));
    });

    describe('get-platform', () => {
        it('should return platform and validate sender', async () => {
            let platformHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'get-platform') {
                    platformHandler = handler;
                }
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            expect(platformHandler).toBeDefined();

            const mockEvent = { sender: {} };

            if (platformHandler) {
                const result = platformHandler(mockEvent);
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(result).toBe(process.platform);
            }
        });
    });

    describe('get-app-version', () => {
        it('should return app version and validate sender', async () => {
            let versionHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'get-app-version') {
                    versionHandler = handler;
                }
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            expect(versionHandler).toBeDefined();

            const mockEvent = { sender: {} };

            if (versionHandler) {
                const result = versionHandler(mockEvent);
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(mockApp.getVersion).toHaveBeenCalled();
                expect(result).toBe('1.0.0');
            }
        });
    });

    describe('privacy:toggle-protection', () => {
        it('should toggle content protection and validate sender', async () => {
            let protectionHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'privacy:toggle-protection') {
                    protectionHandler = handler;
                }
            });

            const mockWindow = {
                setContentProtection: vi.fn()
            };

            mockFromWebContents.mockReturnValue(mockWindow);

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            expect(protectionHandler).toBeDefined();

            const mockEvent = { sender: {} };

            if (protectionHandler) {
                protectionHandler(mockEvent, true);
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(mockWindow.setContentProtection).toHaveBeenCalledWith(true);
            }
        });
    });

    describe('system:select-file', () => {
        it('should open file dialog and return selected file', async () => {
            let selectFileHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            const mockWindow = {};
            mockFromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/file.txt']
            });

            const { registerSystemHandlers: register } = await import('./system');
            register();

            const mockEvent = { sender: {} };

            if (selectFileHandler) {
                const result = await selectFileHandler(mockEvent);
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
                    title: 'Select File',
                    properties: ['openFile'],
                    filters: undefined
                });
                expect(mockAccessControlService.grantAccess).toHaveBeenCalledWith('/path/to/file.txt');
                expect(result).toBe('/path/to/file.txt');
            }
        });

        it('should return null if dialog is canceled', async () => {
            let selectFileHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            const mockWindow = {};
            mockFromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            const { registerSystemHandlers: register } = await import('./system');
            register();

            const mockEvent = { sender: {} };

            if (selectFileHandler) {
                const result = await selectFileHandler(mockEvent);
                expect(result).toBeNull();
            }
        });

        it('should apply custom options', async () => {
            let selectFileHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            const mockWindow = {};
            mockFromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/file.pdf']
            });

            const { registerSystemHandlers: register } = await import('./system');
            register();

            const mockEvent = { sender: {} };
            const options = {
                title: 'Select PDF',
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            };

            if (selectFileHandler) {
                await selectFileHandler(mockEvent, options);
                expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
                    title: 'Select PDF',
                    properties: ['openFile'],
                    filters: options.filters
                });
            }
        });
    });

    describe('system:select-directory', () => {
        it('should open directory dialog and return selected directory', async () => {
            let selectDirHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-directory') {
                    selectDirHandler = handler;
                }
            });

            const mockWindow = {};
            mockFromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/directory']
            });

            const { registerSystemHandlers: register } = await import('./system');
            register();

            const mockEvent = { sender: {} };

            if (selectDirHandler) {
                const result = await selectDirHandler(mockEvent);
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(mockWindow, {
                    title: 'Select Directory',
                    properties: ['openDirectory']
                });
                expect(mockAccessControlService.grantAccess).toHaveBeenCalledWith('/path/to/directory');
                expect(result).toBe('/path/to/directory');
            }
        });

        it('should return null if dialog is canceled', async () => {
            let selectDirHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-directory') {
                    selectDirHandler = handler;
                }
            });

            const mockWindow = {};
            mockFromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            const { registerSystemHandlers: register } = await import('./system');
            register();

            const mockEvent = { sender: {} };

            if (selectDirHandler) {
                const result = await selectDirHandler(mockEvent);
                expect(result).toBeNull();
            }
        });
    });

    describe('system:save-pdf', () => {
        it('should generate and save PDF', async () => {
            let savePdfHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:save-pdf') {
                    savePdfHandler = handler;
                }
            });

            const mockWindow = {};
            mockFromWebContents.mockReturnValue(mockWindow);

            mockDialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: '/path/to/output.pdf'
            });

            const { registerSystemHandlers: register } = await import('./system');
            register();

            const mockEvent = { sender: {} };
            const htmlContent = '<h1>Test Document</h1>';

            if (savePdfHandler) {
                const result = await savePdfHandler(mockEvent, htmlContent, 'test-document');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(result.success).toBe(true);
                expect(result.filePath).toBe('/path/to/output.pdf');

                // Check if the print window was created
                expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(expect.objectContaining({
                    webPreferences: expect.objectContaining({ offscreen: true })
                }));
            }
        });

        it('should handle cancellation', async () => {
            let savePdfHandler: IpcHandler | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:save-pdf') {
                    savePdfHandler = handler;
                }
            });

            const mockWindow = {};
            mockFromWebContents.mockReturnValue(mockWindow);

            mockDialog.showSaveDialog.mockResolvedValue({
                canceled: true
            });

            const { registerSystemHandlers: register } = await import('./system');
            register();

            const mockEvent = { sender: {} };
            const htmlContent = '<h1>Test Document</h1>';

            if (savePdfHandler) {
                const result = await savePdfHandler(mockEvent, htmlContent);
                expect(result.success).toBe(false);
                expect(result.error).toBe('Save cancelled');
            }
        });
    });
});
