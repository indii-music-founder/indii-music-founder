import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateSecureHex, generateSecureId } from './security';

describe('security utils', () => {
    describe('generateSecureHex', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should generate a valid hex string of the specified length', () => {
            const hex = generateSecureHex(10);
            expect(hex).toHaveLength(10);
            expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
        });

        it('should throw an error if globalThis.crypto is undefined', () => {
            // Use vi.stubGlobal to safely mock global object
            vi.stubGlobal('crypto', undefined);

            expect(() => generateSecureHex(10)).toThrowError(
                '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
            );

            vi.unstubAllGlobals();
        });

        it('should throw an error if crypto.getRandomValues is not a function', () => {
            vi.stubGlobal('crypto', {});

            expect(() => generateSecureHex(10)).toThrowError(
                '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
            );

            vi.unstubAllGlobals();
        });
    });

    describe('generateSecureId', () => {
        it('should generate a secure ID with the given prefix', () => {
            const id = generateSecureId('test', 8);
            expect(id.startsWith('test_')).toBe(true);

            const parts = id.split('_');
            expect(parts).toHaveLength(3);
            expect(parts[0]).toBe('test');
            expect(!isNaN(Number(parts[1]))).toBe(true);
            expect(parts[2]).toHaveLength(8);
        });

        it('should use default prefix "id" and length 9 if not provided', () => {
            const id = generateSecureId();
            expect(id.startsWith('id_')).toBe(true);

            const parts = id.split('_');
            expect(parts).toHaveLength(3);
            expect(parts[0]).toBe('id');
            expect(parts[2]).toHaveLength(9);
        });
    });
});
