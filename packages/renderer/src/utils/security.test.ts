import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateSecureId, generateSecureHex } from './security';

describe('security', () => {
    describe('generateSecureHex', () => {
        let originalCrypto: any;

        beforeEach(() => {
            originalCrypto = globalThis.crypto;
        });

        afterEach(() => {
            if (originalCrypto !== undefined) {
                Object.defineProperty(globalThis, 'crypto', {
                    value: originalCrypto,
                    writable: true,
                    configurable: true
                });
            }
        });

        it('should throw an error if crypto is not available', () => {
            // Mock globalThis.crypto to be undefined
            Object.defineProperty(globalThis, 'crypto', {
                value: undefined,
                writable: true,
                configurable: true
            });

            expect(() => generateSecureHex(16)).toThrow(
                '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
            );
        });

        it('should throw an error if crypto.getRandomValues is not available', () => {
            // Mock globalThis.crypto without getRandomValues
            Object.defineProperty(globalThis, 'crypto', {
                value: {},
                writable: true,
                configurable: true
            });

            expect(() => generateSecureHex(16)).toThrow(
                '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
            );
        });

        it('should generate a secure hex string of the correct length', () => {
            // Restore crypto just to be safe, though afterEach does it
            if (originalCrypto !== undefined) {
                Object.defineProperty(globalThis, 'crypto', {
                    value: originalCrypto,
                    writable: true,
                    configurable: true
                });
            }

            const hex = generateSecureHex(10);
            expect(typeof hex).toBe('string');
            expect(hex.length).toBe(10);
            expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
        });
    });

    describe('generateSecureId', () => {
        it('should generate a secure ID with the given prefix', () => {
            const id = generateSecureId('test');
            expect(typeof id).toBe('string');
            expect(id.startsWith('test_')).toBe(true);
            const parts = id.split('_');
            expect(parts.length).toBe(3);
            expect(parts[0]).toBe('test');
            expect(!isNaN(Number(parts[1]))).toBe(true);
            // Non-null assertion operator since parts[2] is string
            expect(parts[2]!.length).toBe(9); // default length
        });

        it('should generate a secure ID with the default prefix', () => {
            const id = generateSecureId();
            expect(typeof id).toBe('string');
            expect(id.startsWith('id_')).toBe(true);
        });

        it('should generate a secure ID with a custom length suffix', () => {
            const id = generateSecureId('test', 12);
            // Safe access using optional chaining or strict index bounds
            const parts = id.split('_');
            expect(parts.length).toBe(3);
            expect(parts[2]!.length).toBe(12);
        });
    });
});
