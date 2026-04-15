import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDeepLink } from './deeplink';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

vi.mock('electron', () => ({
    BrowserWindow: vi.fn()
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('handleDeepLink', () => {
    let mockWindow: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockWindow = {
            isMinimized: vi.fn().mockReturnValue(false),
            restore: vi.fn(),
            show: vi.fn(),
            focus: vi.fn(),
            webContents: {
                send: vi.fn()
            }
        };
    });

    it('should handle missing mainWindow gracefully', () => {
        handleDeepLink('indii-os://test', null);
        expect(log.warn).not.toHaveBeenCalled();
        expect(log.info).not.toHaveBeenCalled();
    });

    it('should block non-indii-os protocol URLs', () => {
        handleDeepLink('http://example.com', mockWindow);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Blocked unsafe deep link'));
        expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should block URLs with private IP hostnames', () => {
        handleDeepLink('indii-os://127.0.0.1/test', mockWindow);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Blocked unsafe deep link'));
        expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should block URLs with invalid characters in path', () => {
        handleDeepLink('indii-os://test/path+plus', mockWindow);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Blocked unsafe deep link'));
        expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should block unparseable URLs', () => {
        handleDeepLink('not-a-url', mockWindow);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Blocked unsafe deep link'));
        expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should process valid deep links', () => {
        handleDeepLink('indii-os://auth/login?token=123', mockWindow);
        expect(log.info).toHaveBeenCalledWith(expect.stringContaining('Dispatching deep link'));
        expect(mockWindow.show).toHaveBeenCalled();
        expect(mockWindow.focus).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('deeplink:received', 'indii-os://auth/login?token=123');
    });

    it('should restore window if minimized', () => {
        mockWindow.isMinimized.mockReturnValue(true);
        handleDeepLink('indii-os://auth/login', mockWindow);
        expect(mockWindow.restore).toHaveBeenCalled();
    });

    it('should catch and log errors during processing', () => {
        const error = new Error('Simulated send error');
        mockWindow.webContents.send.mockImplementation(() => {
            throw error;
        });

        handleDeepLink('indii-os://auth/login', mockWindow);

        expect(log.error).toHaveBeenCalledWith(`[Main] Error handling deep link: ${error}`);
    });
});
