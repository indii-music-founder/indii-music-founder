import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserAgentService } from './BrowserAgentService';

// Mock electron
vi.mock('electron', () => {
    const mockWebContents = {
        setUserAgent: vi.fn(),
        getURL: vi.fn().mockReturnValue('http://example.com'),
        executeJavaScript: vi.fn().mockResolvedValue('Mocked text'),
        capturePage: vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,mocked' }),
        sendInputEvent: vi.fn().mockResolvedValue(undefined),
        once: vi.fn(),
        removeListener: vi.fn(),
    };

    class MockBrowserWindow {
        webContents = mockWebContents;
        on = vi.fn((event, _cb) => {
            if (event === 'closed') {
                // Simulate window close event later if needed, but not immediately
            }
        });
        getTitle = vi.fn().mockReturnValue('Mock Title');
        close = vi.fn();
        loadURL = vi.fn().mockResolvedValue(undefined);
    }

    const mockSession = {
        fromPartition: vi.fn().mockReturnValue({
            setPermissionRequestHandler: vi.fn(),
            clearStorageData: vi.fn().mockResolvedValue(undefined),
        }),
    };

    return {
        BrowserWindow: MockBrowserWindow,
        session: mockSession,
    };
});

describe('BrowserAgentService', () => {
    let service: BrowserAgentService;
    let sessionMock: any;
    let electron: any;

    beforeEach(async () => {
        service = new BrowserAgentService();
        electron = await import('electron');
        sessionMock = electron.session;
        vi.clearAllMocks();
    });

    describe('startSession', () => {
        it('should initialize a browser window with correct settings', async () => {
            await service.startSession();
            expect(sessionMock.fromPartition).toHaveBeenCalled();
            // Verify partition name includes timestamp
            expect(sessionMock.fromPartition).toHaveBeenCalledWith(expect.stringContaining('persist:browser_agent_'));
        });

        it('should not initialize multiple times', async () => {
            await service.startSession();
            await service.startSession();
            // If it initialized multiple times, fromPartition would be called twice
            expect(sessionMock.fromPartition).toHaveBeenCalledTimes(1);
        });

        it('should handle start session errors gracefully', async () => {
            // Force an error to test the catch block
            sessionMock.fromPartition.mockImplementationOnce(() => {
                throw new Error('Partition error');
            });
            await expect(service.startSession()).rejects.toThrow('Partition error');
        });
    });

    describe('session required methods', () => {
        it('should throw if navigating without session', async () => {
            await expect(service.navigateTo('http://example.com')).rejects.toThrow('Session not started');
        });

        it('should throw if capturing snapshot without session', async () => {
            await expect(service.captureSnapshot()).rejects.toThrow('Session not started');
        });

        it('should throw if performing actions without session', async () => {
            await expect(service.performAction('click', '.btn')).rejects.toThrow('Session not started');
        });

        it('should throw if typing into a selector without session', async () => {
            await expect(service.typeInto('.input', 'text')).rejects.toThrow('Session not started');
        });

        it('should throw if clicking a selector without session', async () => {
            await expect(service.click('.btn')).rejects.toThrow('Session not started');
        });

        it('should throw if pressing a key without session', async () => {
            await expect(service.pressKey('Enter')).rejects.toThrow('Session not started');
        });

        it('should throw if scrolling without session', async () => {
            await expect(service.scroll('down', 100)).rejects.toThrow('Session not started');
        });

        it('should throw if waiting for selector without session', async () => {
            await expect(service.waitForSelector('.btn')).rejects.toThrow('Session not started');
        });
    });

    describe('with active session', () => {
        beforeEach(async () => {
            await service.startSession();
        });

        afterEach(async () => {
            await service.closeSession();
        });

        it('should navigate to URL successfully', async () => {
            await expect(service.navigateTo('http://example.com')).resolves.toBeUndefined();
        });

        it('should handle navigation failure', async () => {
            // Mock once to call the fail handler immediately
            const mockWebContents = (service as any).window.webContents;
            mockWebContents.once.mockImplementation((event: string, handler: (...args: any[]) => void) => {
                if (event === 'did-fail-load') {
                    // Call handler immediately with error
                    handler({} as any, -105, 'ERR_NAME_NOT_RESOLVED', 'http://example.com');
                }
            });
            (service as any).window.loadURL.mockRejectedValueOnce(new Error('Load failed'));

            await expect(service.navigateTo('http://example.com')).rejects.toThrow('Navigation failed: ERR_NAME_NOT_RESOLVED');
        });

        it('should capture snapshot', async () => {
            const snapshot = await service.captureSnapshot();
            expect(snapshot.title).toBe('Mock Title');
            expect(snapshot.url).toBe('http://example.com');
            expect(snapshot.text).toBe('Mocked text');
            expect(snapshot.screenshotBase64).toBe('data:image/png;base64,mocked');

            // Check that executeJavaScript was called for the text
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalledWith('document.body.innerText');
        });

        it('should handle capture snapshot javascript execution error', async () => {
            const mockWebContents = (service as any).window.webContents;
            mockWebContents.executeJavaScript.mockRejectedValueOnce(new Error('JS error'));

            const snapshot = await service.captureSnapshot();
            expect(snapshot.text).toBe(''); // Falls back to empty string
        });
    });

    describe('performAction', () => {
        beforeEach(async () => {
            await service.startSession();
        });

        afterEach(async () => {
            await service.closeSession();
        });

        it('should execute click action', async () => {
            const result = await service.performAction('click', '.btn');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalled();
        });

        it('should execute type action', async () => {
            const result = await service.performAction('type', '.input', 'hello');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalled();
        });

        it('should return error if text missing for type action', async () => {
            const result = await service.performAction('type', '.input');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Text is required for type action');
        });

        it('should execute press action', async () => {
            const result = await service.performAction('press', 'Enter');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.sendInputEvent).toHaveBeenCalledWith({ type: 'keyDown', keyCode: 'Enter' });
            expect((service as any).window.webContents.sendInputEvent).toHaveBeenCalledWith({ type: 'keyUp', keyCode: 'Enter' });
        });

        it('should execute press action with subsequent typing', async () => {
            const result = await service.performAction('press', 'Tab', 'hello');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.sendInputEvent).toHaveBeenCalledWith({ type: 'keyDown', keyCode: 'Tab' });
            // typeInto includes waitForSelector, so we should see multiple executeJavaScript calls
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalled();
        });

        it('should execute scroll action default', async () => {
            const result = await service.performAction('scroll', '');
            expect(result.success).toBe(true);
        });

        it('should execute scroll action specific (up)', async () => {
            const result = await service.performAction('scroll', 'up', '100');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalledWith('window.scrollBy(0, -100)');
        });

        it('should execute scroll action specific (down)', async () => {
            const result = await service.performAction('scroll', 'down', '100');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalledWith('window.scrollBy(0, 100)');
        });

        it('should execute scroll action top', async () => {
            const result = await service.performAction('scroll', 'top');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalledWith('window.scrollTo(0, 0)');
        });

        it('should execute scroll action bottom', async () => {
            const result = await service.performAction('scroll', 'bottom');
            expect(result.success).toBe(true);
            expect((service as any).window.webContents.executeJavaScript).toHaveBeenCalledWith('window.scrollTo(0, document.body.scrollHeight)');
        });

        it('should execute wait action default', async () => {
            const result = await service.performAction('wait', '');
            expect(result.success).toBe(true);
        });

        it('should execute wait action specific', async () => {
            const result = await service.performAction('wait', '', '10');
            expect(result.success).toBe(true);
        });

        it('should return error for unsupported action', async () => {
            const result = await service.performAction('unknown', '');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported action');
        });

        it('should handle action execution errors', async () => {
            const mockWebContents = (service as any).window.webContents;
            mockWebContents.executeJavaScript.mockRejectedValueOnce(new Error('Element not found'));
            const result = await service.performAction('click', '.non-existent');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Element not found');
        });
    });

    describe('closeSession', () => {
        it('should safely close the session', async () => {
            await service.startSession();
            const closeMock = (service as any).window.close;
            await service.closeSession();
            expect(closeMock).toHaveBeenCalled();
            expect((service as any).window).toBeNull();
        });

        it('should safely handle closing when no session exists', async () => {
            await service.closeSession(); // Should not throw
            expect((service as any).window).toBeNull();
        });
    });
});
