import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mocks
const mockHandle = vi.fn();
const mockGetVersion = vi.fn(() => '1.0.0');
const mockShowOpenDialog = vi.fn();
const mockShowSaveDialog = vi.fn();
const mockValidateSender = vi.fn();
const mockGrantAccess = vi.fn();
const mockFromWebContents = vi.fn();
const mockSetContentProtection = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockPrintToPDF = vi.fn().mockResolvedValue(Buffer.from('pdf-data'));
const mockClose = vi.fn();

// Constructor Spy
const mockBrowserWindowConstructor = vi.fn();

// Create a Plain MockBrowserWindow function
const MockBrowserWindow = function(options: any) {
    mockBrowserWindowConstructor(options);
    return {
        loadURL: mockLoadURL,
        webContents: {
            printToPDF: mockPrintToPDF
        },
        close: mockClose,
        setContentProtection: mockSetContentProtection
    };
};
// Attach static methods
(MockBrowserWindow as any).fromWebContents = mockFromWebContents;

vi.mock('electron', () => ({
    app: {
        getVersion: mockGetVersion
    },
    ipcMain: {
        handle: mockHandle
    },
    BrowserWindow: MockBrowserWindow,
    dialog: {
        showOpenDialog: mockShowOpenDialog,
        showSaveDialog: mockShowSaveDialog
    }
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mockValidateSender
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        grantAccess: mockGrantAccess
    }
}));

describe('System Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default mock implementations if needed
        mockFromWebContents.mockReturnValue({
            setContentProtection: mockSetContentProtection
        });
    });

    it('should register all system handlers', async () => {
        const { registerSystemHandlers } = await import('./system');
        registerSystemHandlers();

        expect(mockHandle).toHaveBeenCalledWith('get-platform', expect.any(Function));
        expect(mockHandle).toHaveBeenCalledWith('get-app-version', expect.any(Function));
        expect(mockHandle).toHaveBeenCalledWith('privacy:toggle-protection', expect.any(Function));
        expect(mockHandle).toHaveBeenCalledWith('system:select-file', expect.any(Function));
        expect(mockHandle).toHaveBeenCalledWith('system:select-directory', expect.any(Function));
        expect(mockHandle).toHaveBeenCalledWith('system:restart-ai', expect.any(Function));
        expect(mockHandle).toHaveBeenCalledWith('system:save-pdf', expect.any(Function));
    });

    describe('get-platform', () => {
        it('should return platform and validate sender', async () => {
            let platformHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
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
            let versionHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
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
                expect(mockGetVersion).toHaveBeenCalled();
                expect(result).toBe('1.0.0');
            }
        });
    });

    describe('privacy:toggle-protection', () => {
        it('should toggle content protection and validate sender', async () => {
            let protectionHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
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
            let selectFileHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            mockShowOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/file.txt']
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            const mockEvent = { sender: {} };

            if (selectFileHandler) {
                const result = await selectFileHandler(mockEvent);
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(mockShowOpenDialog).toHaveBeenCalledWith(expect.anything(), {
                    title: 'Select File',
                    properties: ['openFile'],
                    filters: undefined
                });
                expect(mockGrantAccess).toHaveBeenCalledWith('/path/to/file.txt');
                expect(result).toBe('/path/to/file.txt');
            }
        });

        it('should return null if dialog is canceled', async () => {
            let selectFileHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            mockShowOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            const mockEvent = { sender: {} };

            if (selectFileHandler) {
                const result = await selectFileHandler(mockEvent);
                expect(result).toBeNull();
            }
        });

        it('should apply custom options', async () => {
            let selectFileHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-file') {
                    selectFileHandler = handler;
                }
            });

            mockShowOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/file.pdf']
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            const mockEvent = { sender: {} };
            const options = {
                title: 'Select PDF',
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            };

            if (selectFileHandler) {
                await selectFileHandler(mockEvent, options);
                expect(mockShowOpenDialog).toHaveBeenCalledWith(expect.anything(), {
                    title: 'Select PDF',
                    properties: ['openFile'],
                    filters: options.filters
                });
            }
        });
    });

    describe('system:select-directory', () => {
        it('should open directory dialog and return selected directory', async () => {
            let selectDirHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-directory') {
                    selectDirHandler = handler;
                }
            });

            mockShowOpenDialog.mockResolvedValue({
                canceled: false,
                filePaths: ['/path/to/directory']
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            const mockEvent = { sender: {} };

            if (selectDirHandler) {
                const result = await selectDirHandler(mockEvent);
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(mockShowOpenDialog).toHaveBeenCalledWith(expect.anything(), {
                    title: 'Select Directory',
                    properties: ['openDirectory']
                });
                expect(mockGrantAccess).toHaveBeenCalledWith('/path/to/directory');
                expect(result).toBe('/path/to/directory');
            }
        });

        it('should return null if dialog is canceled', async () => {
            let selectDirHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'system:select-directory') {
                    selectDirHandler = handler;
                }
            });

            mockShowOpenDialog.mockResolvedValue({
                canceled: true,
                filePaths: []
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            const mockEvent = { sender: {} };

            if (selectDirHandler) {
                const result = await selectDirHandler(mockEvent);
                expect(result).toBeNull();
            }
        });
    });

    describe('system:save-pdf', () => {
        it('should generate and save PDF', async () => {
            let savePdfHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'system:save-pdf') {
                    savePdfHandler = handler;
                }
            });

            mockShowSaveDialog.mockResolvedValue({
                canceled: false,
                filePath: '/path/to/output.pdf'
            });

            // Mock fs/promises
            const mockWriteFile = vi.fn().mockResolvedValue(undefined);
            vi.doMock('fs/promises', () => ({
                writeFile: mockWriteFile
            }));

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

            const mockEvent = { sender: {} };
            const htmlContent = '<h1>Test Document</h1>';

            if (savePdfHandler) {
                const result = await savePdfHandler(mockEvent, htmlContent, 'test-document');
                expect(mockValidateSender).toHaveBeenCalledWith(mockEvent);
                expect(result.success).toBe(true);
                expect(result.filePath).toBe('/path/to/output.pdf');

                // Verify print window logic - check constructor calls
                expect(mockBrowserWindowConstructor).toHaveBeenCalledWith(expect.objectContaining({
                    webPreferences: expect.objectContaining({ offscreen: true })
                }));
            }
        });

        it('should handle cancellation', async () => {
            let savePdfHandler: ((...args: any[]) => any) | undefined;

            mockHandle.mockImplementation((channel, handler) => {
                if (channel === 'system:save-pdf') {
                    savePdfHandler = handler;
                }
            });

            mockShowSaveDialog.mockResolvedValue({
                canceled: true
            });

            const { registerSystemHandlers } = await import('./system');
            registerSystemHandlers();

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
