import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDeepLink } from './deeplink';

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('DeepLink Handler Security', () => {
    let mockWindow: any;

    beforeEach(() => {
        mockWindow = {
            isMinimized: vi.fn().mockReturnValue(false),
            restore: vi.fn(),
            show: vi.fn(),
            focus: vi.fn(),
            webContents: {
                send: vi.fn()
            }
        };
        vi.clearAllMocks();
    });

    describe('isDeepLinkSafe', () => {
        it('should allow valid simple URLs', () => {
            handleDeepLink('indii-os://callback', mockWindow);
            expect(mockWindow.webContents.send).toHaveBeenCalled();
        });

        it('should allow URLs with valid query parameters', () => {
            handleDeepLink('indii-os://callback?token=abc-123&uid=456', mockWindow);
            expect(mockWindow.webContents.send).toHaveBeenCalled();
        });

        it('should allow URLs with a valid hostname', () => {
            handleDeepLink('indii-os://app/callback', mockWindow);
            expect(mockWindow.webContents.send).toHaveBeenCalled();
        });

        it('should allow URLs with encoded valid characters', () => {
            handleDeepLink('indii-os://callback?q=hello%20world', mockWindow);
            expect(mockWindow.webContents.send).toHaveBeenCalled();
        });

        it('should reject non-indii-os protocols', () => {
            handleDeepLink('http://example.com/callback', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('https://example.com', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('file:///etc/passwd', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('javascript:alert(1)', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();
        });

        it('should reject private IP hostnames (SSRF protection)', () => {
            const privateIps = [
                'localhost',
                '127.0.0.1',
                '127.1.2.3',
                '0.0.0.0',
                '10.0.0.1',
                '172.16.0.1',
                '172.31.255.255',
                '192.168.1.1',
                '169.254.169.254', // AWS metadata service
                '::1'
            ];

            privateIps.forEach(ip => {
                vi.clearAllMocks();
                handleDeepLink(`indii-os://${ip}/callback`, mockWindow);
                expect(mockWindow.webContents.send).not.toHaveBeenCalled();
            });
        });

        it('should reject URLs with invalid path or query characters', () => {
            // Note: URL parsing encodes < and > in search part, but we can test other ways to break the regex

            // XSS attempts that break the allowed char set
            handleDeepLink('indii-os://callback;javascript:alert(1)', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('indii-os://callback"onmouseover="alert(1)', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('indii-os://callback?token=123"onmouseover="alert(1)', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('indii-os://callback?token=123\'', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('indii-os://callback?token=123{', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            // Path traversal attempts
            handleDeepLink('indii-os://callback/../../../etc/passwd', mockWindow);
            // new URL() handles ../../ but if we have non-standard characters, it should block it

            handleDeepLink('indii-os://callback/\u0000', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();
        });

        it('should handle malformed URLs gracefully', () => {
            handleDeepLink('not-a-valid-url-at-all:////', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();

            handleDeepLink('', mockWindow);
            expect(mockWindow.webContents.send).not.toHaveBeenCalled();
        });
    });

    describe('window handling', () => {
        it('should restore minimized window', () => {
            mockWindow.isMinimized.mockReturnValue(true);
            handleDeepLink('indii-os://callback', mockWindow);
            expect(mockWindow.restore).toHaveBeenCalled();
            expect(mockWindow.show).toHaveBeenCalled();
            expect(mockWindow.focus).toHaveBeenCalled();
        });

        it('should not throw if window is null', () => {
            expect(() => handleDeepLink('indii-os://callback', null)).not.toThrow();
        });
    });
});
