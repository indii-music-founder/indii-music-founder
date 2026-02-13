import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron modules
const mockIpcMain = {
    handle: vi.fn()
};

const mockApp = {
    getVersion: vi.fn(() => '1.0.0')
};

const mockBrowserWindow = {
    fromWebContents: vi.fn()
};

const mockDialog = {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
};

const mockValidateSender = vi.fn();
const mockAccessControlService = {
    grantAccess: vi.fn()
};

vi.mock('electron', () => ({
    app: mockApp,
    ipcMain: mockIpcMain,
    BrowserWindow: mockBrowserWindow,
    dialog: mockDialog
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mockValidateSender
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mockAccessControlService
}));

describe('System Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should register all system handlers', async () => {
        await import('./system');

        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-platform', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('get-app-version', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('privacy:toggle-protection', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('system:select-file', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('system:select-directory', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('system:restart-ai', expect.any(Function));
        expect(mockIpcMain.handle).toHaveBeenCalledWith('system:save-pdf', expect.any(Function));
    });

    describe('get-platform', () => {
        it('should return platform and validate sender', async () => {
            let platformHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'get-platform') {
                    platformHandler = handler;
                }
            });

            await import('./system');

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
            let versionHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'get-app-version') {
                    versionHandler = handler;
                }
            });

            await import('./system');

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
            let protectionHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'privacy:toggle-protection') {
                    protectionHandler = handler;
                }
            });

            const mockWindow = {
                setContentProtection: vi.fn()
            };

            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);

            await import('./system');

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
            let selectFileHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            const mockWindow = {};
            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/file.txt']
            });

            await import('./system');

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
            let selectFileHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            const mockWindow = {};
            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            await import('./system');

            const mockEvent = { sender: {} };

            if (selectFileHandler) {
                const result = await selectFileHandler(mockEvent);
                expect(result).toBeNull();
            }
        });

        it('should apply custom options', async () => {
            let selectFileHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            const mockWindow = {};
            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/file.pdf']
            });

            await import('./system');

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
            let selectDirHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-directory') {
                    selectDirHandler = handler;
                }
            });

            const mockWindow = {};
            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/directory']
            });

            await import('./system');

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
            let selectDirHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-directory') {
                    selectDirHandler = handler;
                }
            });

            const mockWindow = {};
            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);
            mockDialog.showOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            await import('./system');

            const mockEvent = { sender: {} };

            if (selectDirHandler) {
                const result = await selectDirHandler(mockEvent);
                expect(result).toBeNull();
            }
        });
    });

    describe('system:save-pdf', () => {
        it('should generate and save PDF', async () => {
            let savePdfHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:save-pdf') {
                    savePdfHandler = handler;
                }
            });

            const mockPrintWindow = {
                loadURL: vi.fn().mockResolvedValue(undefined),
                webContents: {
                    printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf-data'))
                },
                close: vi.fn()
            };

            const mockWindow = {};
            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);

            // Mock BrowserWindow constructor
            const OriginalBrowserWindow = (global as any).BrowserWindow;
            (global as any).BrowserWindow = function(options: any) {
                return mockPrintWindow;
            };

            mockDialog.showSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: '/path/to/output.pdf'
            });

            // Mock fs/promises
            const mockWriteFile = vi.fn().mockResolvedValue(undefined);
            vi.doMock('fs/promises', () => ({
                writeFile: mockWriteFile
            }));

            await import('./system');

            const mockEvent = { sender: {} };
            const htmlContent = '<h1>Test Document</h1>';

            if (savePdfHandler) {
                const result = await savePdfHandler(mockEvent, htmlContent, 'test-document');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(result.success).toBe(true);
                expect(result.filePath).toBe('/path/to/output.pdf');
            }

            // Restore
            (global as any).BrowserWindow = OriginalBrowserWindow;
        });

        it('should handle cancellation', async () => {
            let savePdfHandler: Function | undefined;

            mockIpcMain.handle.mockImplementation((channel, handler) => {
                if (channel === 'system:save-pdf') {
                    savePdfHandler = handler;
                }
            });

            const mockPrintWindow = {
                loadURL: vi.fn().mockResolvedValue(undefined),
                webContents: {
                    printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf-data'))
                },
                close: vi.fn()
            };

            const mockWindow = {};
            mockBrowserWindow.fromWebContents.mockReturnValue(mockWindow);

            const OriginalBrowserWindow = (global as any).BrowserWindow;
            (global as any).BrowserWindow = function(options: any) {
                return mockPrintWindow;
            };

            mockDialog.showSaveDialog.mockResolvedValue({
                canceled: true
            });

            await import('./system');

            const mockEvent = { sender: {} };
            const htmlContent = '<h1>Test Document</h1>';

            if (savePdfHandler) {
                const result = await savePdfHandler(mockEvent, htmlContent);
                expect(result.success).toBe(false);
                expect(result.error).toBe('Save cancelled');
            }

            (global as any).BrowserWindow = OriginalBrowserWindow;
        });
    });
});