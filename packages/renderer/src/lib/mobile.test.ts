/**
 * Mobile Utilities Test Suite
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    haptic,
    isMobile,
    isIOS,
    isAndroid,
    isStandalone,
    canShare,
    isOnline,
} from './mobile';

describe('Mobile Utilities', () => {
    describe('Haptic Feedback', () => {
        beforeEach(() => {
            // Mock navigator.vibrate
            vi.stubGlobal('navigator', {
                ...navigator,
                vibrate: vi.fn(),
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should call vibrate with correct pattern for light haptic', () => {
            haptic('light');
            expect(navigator.vibrate).toHaveBeenCalledWith(10);
        });

        it('should call vibrate with correct pattern for medium haptic', () => {
            haptic('medium');
            expect(navigator.vibrate).toHaveBeenCalledWith(20);
        });

        it('should call vibrate with correct pattern for heavy haptic', () => {
            haptic('heavy');
            expect(navigator.vibrate).toHaveBeenCalledWith(30);
        });

        it('should call vibrate with correct pattern for success haptic', () => {
            haptic('success');
            expect(navigator.vibrate).toHaveBeenCalledWith([10, 50, 10]);
        });

        it('should call vibrate with correct pattern for warning haptic', () => {
            haptic('warning');
            expect(navigator.vibrate).toHaveBeenCalledWith([20, 100, 20, 100, 20]);
        });

        it('should call vibrate with correct pattern for error haptic', () => {
            haptic('error');
            expect(navigator.vibrate).toHaveBeenCalledWith([50, 100, 50]);
        });

        it('should not throw if vibrate is not supported', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                vibrate: undefined,
            });

            expect(() => haptic('light')).not.toThrow();
        });
    });

    describe('Device Detection', () => {
        it('should detect mobile devices', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            });

            expect(isMobile()).toBe(true);
        });

        it('should detect iOS devices', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
            });

            expect(isIOS()).toBe(true);
        });

        it('should detect Android devices', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                userAgent: 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
            });

            expect(isAndroid()).toBe(true);
        });

        it('should detect desktop devices', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            });

            expect(isMobile()).toBe(false);
            expect(isIOS()).toBe(false);
            expect(isAndroid()).toBe(false);
        });

        it('should detect standalone mode', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockImplementation((query: string) => ({
                    matches: query === '(display-mode: standalone)',
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                })),
            });

            expect(isStandalone()).toBe(true);
        });
    });

    describe('Native Share', () => {
        it('should return true if share is supported', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                share: vi.fn(),
                canShare: vi.fn().mockReturnValue(true),
            });

            expect(canShare()).toBe(true);
        });

        it('should return false if share is not supported', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                share: undefined,
            });

            expect(canShare()).toBe(false);
        });

        it('should check specific data if provided', () => {
            const canShareMock = vi.fn().mockReturnValue(true);
            vi.stubGlobal('navigator', {
                ...navigator,
                share: vi.fn(),
                canShare: canShareMock,
            });

            const data = { title: 'Test', url: 'https://example.com' };
            canShare(data);

            expect(canShareMock).toHaveBeenCalledWith(data);
        });
    });

    describe('Network Status', () => {
        it('should return true if online', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                onLine: true,
            });

            expect(isOnline()).toBe(true);
        });

        it('should return false if offline', () => {
            vi.stubGlobal('navigator', {
                ...navigator,
                onLine: false,
            });

            expect(isOnline()).toBe(false);
        });
    });
});
