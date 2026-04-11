import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSecureId, generateSecureHex } from './security';

describe('Security Utilities', () => {
  describe('generateSecureHex', () => {
    let originalCrypto: Crypto;

    beforeEach(() => {
      // Save original crypto
      originalCrypto = globalThis.crypto;
    });

    afterEach(() => {
      // Restore original crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      });
    });

    it('should generate a string of the exact requested length', () => {
      expect(generateSecureHex(10)).toHaveLength(10);
      expect(generateSecureHex(15)).toHaveLength(15); // Odd length
      expect(generateSecureHex(32)).toHaveLength(32);
      expect(generateSecureHex(1)).toHaveLength(1);
      expect(generateSecureHex(0)).toHaveLength(0);
    });

    it('should only contain valid hex characters', () => {
      const hex = generateSecureHex(100);
      expect(hex).toMatch(/^[0-9a-f]+$/);
    });

    it('should throw an error if crypto.getRandomValues is not available', () => {
      // Temporarily mock crypto to not have getRandomValues
      Object.defineProperty(globalThis, 'crypto', {
        value: { getRandomValues: undefined },
        writable: true,
        configurable: true,
      });

      expect(() => generateSecureHex(10)).toThrow(
        '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
      );
    });

    it('should throw an error if crypto is deleted from globalThis', () => {
      // Temporarily mock globalThis.crypto to not exist using Object.defineProperty
      // which allows the existing afterEach hook to properly restore it.
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined, // this effectively simulates the property being missing
        writable: true,
        configurable: true,
      });

      // To fully simulate deletion and ensure the global proxy handles it as missing:
      delete (globalThis as any).crypto;

      expect(() => generateSecureHex(10)).toThrow(
        '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
      );
    });

    it('should throw an error if crypto is null', () => {
      // Temporarily mock crypto to be null
      Object.defineProperty(globalThis, 'crypto', {
        value: null,
        writable: true,
        configurable: true,
      });

      expect(() => generateSecureHex(10)).toThrow(
        '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
      );
    });

    it('should throw an error if crypto itself is undefined', () => {
      // Temporarily mock crypto to be undefined
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => generateSecureHex(10)).toThrow(
        '[Security] crypto.getRandomValues is required but not available. Cannot generate secure random values.'
      );
    });
  });

  describe('generateSecureId', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should generate an ID with the default prefix "id" and default hex length 9', () => {
      vi.setSystemTime(new Date(1600000000000));

      // We don't mock getRandomValues here to test real output format,
      // just checking length and structure.
      const id = generateSecureId();

      const parts = id.split('_');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('id');
      expect(parts[1]).toBe('1600000000000');
      expect(parts[2]).toHaveLength(9);
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });

    it('should use a custom prefix and length', () => {
      vi.setSystemTime(new Date(1650000000000));

      const id = generateSecureId('custom_job', 16);

      const parts = id.split('_');
      // custom_job is 2 parts when split by _
      expect(parts.length).toBeGreaterThanOrEqual(3);

      const prefix = id.substring(0, id.indexOf('_1650000000000'));
      expect(prefix).toBe('custom_job');

      const hexPart = parts[parts.length - 1];
      expect(hexPart).toBeDefined();
      if (hexPart) {
        expect(hexPart).toHaveLength(16);
        expect(hexPart).toMatch(/^[0-9a-f]+$/);
      }
    });

    it('should handle empty prefix', () => {
      vi.setSystemTime(new Date(1700000000000));
      const id = generateSecureId('', 5);

      expect(id.startsWith('_1700000000000_')).toBe(true);
      const hexPart = id.split('_')[2];
      expect(hexPart).toBeDefined();
      if (hexPart) {
        expect(hexPart).toHaveLength(5);
      }
    });
  });
});
