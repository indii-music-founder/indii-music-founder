import { describe, it, expect } from 'vitest';
import { validateSender } from './ipc-security';

describe('Sentinel: IPC Validation Security', () => {
    describe('validateSender (IPC Hijack Protection)', () => {
        const mockEvent = (url: string) => ({
            senderFrame: { url }
        } as any);

        it('should accept file:// URLs', () => {
            expect(() => validateSender(mockEvent('file:///app/index.html'))).not.toThrow();
        });

        it('should accept http:// URLs (Dev)', () => {
            expect(() => validateSender(mockEvent('http://localhost:4242/'))).not.toThrow();
        });

        it('should accept https:// URLs', () => {
            expect(() => validateSender(mockEvent('https://app.indii.os/'))).not.toThrow();
        });

        it('should reject external protocols', () => {
             expect(() => validateSender(mockEvent('ftp://malicious.com'))).toThrow('Security: Unauthorized sender protocol');
        });

        it('should reject empty/undefined URLs', () => {
            expect(() => validateSender(mockEvent(''))).toThrow('Security: Invalid sender URL');
            expect(() => validateSender({} as any)).toThrow('Security: Missing sender frame');
        });
    });
});
