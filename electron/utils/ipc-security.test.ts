import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateSender } from './ipc-security';

describe('Sentinel: IPC Validation Security', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('validateSender (IPC Hijack Protection)', () => {
        const mockEvent = (url: string) => ({
            senderFrame: { url }
        } as any);

        it('should accept file:// URLs (Production)', () => {
            expect(() => validateSender(mockEvent('file:///app/index.html'))).not.toThrow();
        });

        it('should accept indii-os:// URLs (Deep Links)', () => {
            expect(() => validateSender(mockEvent('indii-os://open/project/123'))).not.toThrow();
        });

        it('should accept Dev Server URL when configured', () => {
            process.env.VITE_DEV_SERVER_URL = 'http://localhost:4242';
            expect(() => validateSender(mockEvent('http://localhost:4242/'))).not.toThrow();
            expect(() => validateSender(mockEvent('http://localhost:4242/subpath'))).not.toThrow();
        });

        it('should REJECT Dev Server URL when NOT configured', () => {
            delete process.env.VITE_DEV_SERVER_URL;
            expect(() => validateSender(mockEvent('http://localhost:4242/'))).toThrow('Unauthorized sender URL');
        });

        it('should REJECT arbitrary HTTP URLs', () => {
            process.env.VITE_DEV_SERVER_URL = 'http://localhost:4242';
            expect(() => validateSender(mockEvent('http://evil.com/'))).toThrow('Unauthorized sender URL');
        });

        it('should REJECT arbitrary HTTPS URLs', () => {
             process.env.VITE_DEV_SERVER_URL = 'http://localhost:4242';
             expect(() => validateSender(mockEvent('https://google.com/'))).toThrow('Unauthorized sender URL');
        });

        it('should REJECT URLs that merely start with the dev URL but are different domains (Prefix Attack)', () => {
             process.env.VITE_DEV_SERVER_URL = 'http://localhost:4242';
             // This tests the vulnerability: "http://localhost:4242.evil.com/" starts with "http://localhost:4242"
             // But it should be blocked because it's a different origin.
             expect(() => validateSender(mockEvent('http://localhost:4242.evil.com/'))).toThrow('Unauthorized sender URL');
        });

        it('should reject empty/undefined URLs', () => {
            expect(() => validateSender(mockEvent(''))).toThrow('Unauthorized IPC Sender');
            expect(() => validateSender({} as any)).toThrow('Missing sender frame');
        });
    });
});
