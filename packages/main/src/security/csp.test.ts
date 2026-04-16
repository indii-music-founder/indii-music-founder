import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCSPPolicy, applyCSP, generateNonce, setupCSPReporting, securityHeaders } from './csp';
import { session } from 'electron';
import log from 'electron-log';

// Mock electron session and log
vi.mock('electron', () => ({
    session: {
        defaultSession: {
            webRequest: {
                onHeadersReceived: vi.fn()
            }
        }
    }
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn()
    }
}));

describe('Content Security Policy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getCSPPolicy', () => {
        it('should generate a valid CSP string', () => {
            const policy = getCSPPolicy();
            expect(typeof policy).toBe('string');
            expect(policy).toContain("default-src 'self'");
            expect(policy).toContain("img-src 'self' data: blob:");
            expect(policy).toContain("font-src 'self' data:");
            expect(policy).toContain("media-src 'self' blob:");
            expect(policy).toContain("object-src 'none'");
        });
    });

    describe('securityHeaders', () => {
        it('should contain correct download headers', () => {
            expect(securityHeaders.download).toBeDefined();
            expect(securityHeaders.download['Content-Disposition']).toBe('attachment');
            expect(securityHeaders.download['X-Content-Type-Options']).toBe('nosniff');
        });
        it('should contain correct api headers', () => {
            expect(securityHeaders.api).toBeDefined();
            expect(securityHeaders.api['Content-Type']).toBe('application/json');
            expect(securityHeaders.api['X-Content-Type-Options']).toBe('nosniff');
        });
    });

    describe('generateNonce', () => {
        it('should return a 24-character base64 string (16 bytes)', () => {
            const nonce = generateNonce();
            expect(nonce).toBeDefined();
            expect(typeof nonce).toBe('string');
            // 16 bytes in base64 is 24 characters
            expect(nonce.length).toBe(24);
        });

        it('should generate unique nonces', () => {
            const nonce1 = generateNonce();
            const nonce2 = generateNonce();
            expect(nonce1).not.toBe(nonce2);
        });
    });

    describe('setupCSPReporting', () => {
        it('should not log to console if no reportUri provided in non-dev', () => {
            // isDev depends on NODE_ENV='development' during module load.
            // Vitest by default sets it to 'test', so isDev is false.
            setupCSPReporting();
            expect(log.info).not.toHaveBeenCalled();
        });

        it('should log the reportUri if provided', () => {
            setupCSPReporting('https://example.com/report');
            expect(log.info).toHaveBeenCalledWith(expect.stringContaining('https://example.com/report'));
        });
    });

    describe('applyCSP', () => {
        it('should register webRequest.onHeadersReceived', () => {
            applyCSP();
            expect(session.defaultSession.webRequest.onHeadersReceived).toHaveBeenCalled();
        });

        it('should add CSP headers to responses', () => {
            applyCSP();

            // Get the registered callback — onHeadersReceived is always called by applyCSP
            const mockedFn = vi.mocked(session.defaultSession.webRequest.onHeadersReceived);
            expect(mockedFn).toHaveBeenCalled();
            // Use a typed cast matching Electron's listener signature to satisfy strict TS
            type HeadersListener = (details: { responseHeaders: Record<string, string[]> }, cb: (r: Record<string, unknown>) => void) => void;
            const callback = mockedFn.mock.calls[0][0] as unknown as HeadersListener;

            // Simulate a request
            const cbFn = vi.fn();
            callback({ responseHeaders: { 'X-Test': ['test'] } }, cbFn);

            expect(cbFn).toHaveBeenCalled();
            const response = cbFn.mock.calls[0][0];
            expect(response.responseHeaders).toBeDefined();
            expect(response.responseHeaders['Content-Security-Policy']).toBeDefined();
            expect(response.responseHeaders['X-Content-Type-Options']).toEqual(['nosniff']);
            expect(response.responseHeaders['X-Test']).toEqual(['test']);
        });
    });
});
