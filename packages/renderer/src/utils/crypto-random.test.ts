import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    secureRandomInt,
    secureRandomHex,
    secureRandomAlphanumeric,
    secureUUIDv4,
    secureShuffleArray,
    secureRandomPick
} from './crypto-random';

describe('crypto-random utils', () => {

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('secureRandomInt', () => {
        it('should throw RangeError if min >= max', () => {
            expect(() => secureRandomInt(10, 5)).toThrow(RangeError);
            expect(() => secureRandomInt(5, 5)).toThrow(RangeError);
        });

        it('should return a number within the specified range [min, max)', () => {
            const min = 5;
            const max = 15;
            for (let i = 0; i < 100; i++) {
                const result = secureRandomInt(min, max);
                expect(result).toBeGreaterThanOrEqual(min);
                expect(result).toBeLessThan(max);
                expect(Number.isInteger(result)).toBe(true);
            }
        });

        it('should work when mocked crypto returns high values (rejection sampling)', () => {
            const range = 6; // 11 - 5 = 6
            const maxUint32 = 0xFFFFFFFF;
            const limit = maxUint32 - (maxUint32 % range);

            const mockGetRandomValues = vi.fn((array: Uint32Array) => {
                // Mock value: exactly limit + 1 on first try, then a valid value

                // First call: returns a value above limit
                if (mockGetRandomValues.mock.calls.length === 1) {
                    array[0] = limit + 1; // triggers rejection sampling
                } else {
                    // Second call: returns a valid value
                    array[0] = 2; // 2 % 6 = 2, min + 2 = 5 + 2 = 7
                }
                return array;
            });

            vi.stubGlobal('crypto', {
                getRandomValues: mockGetRandomValues
            });

            const result = secureRandomInt(5, 11);
            expect(result).toBe(7);
            expect(mockGetRandomValues).toHaveBeenCalledTimes(2);
        });

        it('should throw RangeError if range is not finite', () => {
             expect(() => secureRandomInt(0, Infinity)).toThrow(RangeError);
        });
    });

    describe('secureRandomHex', () => {
        it('should return a string of expected length (2 * length)', () => {
            expect(secureRandomHex(8).length).toBe(16);
            expect(secureRandomHex(16).length).toBe(32);
        });

        it('should contain only valid hex characters', () => {
            const hex = secureRandomHex(32);
            expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
        });

        it('should pad single-digit hex values correctly', () => {
             vi.stubGlobal('crypto', {
                getRandomValues: (array: Uint8Array) => {
                    array[0] = 5; // 0x05 -> should be '05' not '5'
                    array[1] = 255; // 0xff -> 'ff'
                    return array;
                }
            });
            expect(secureRandomHex(2)).toBe('05ff');
        });
    });

    describe('secureRandomAlphanumeric', () => {
        it('should return a string of expected length', () => {
            expect(secureRandomAlphanumeric(10).length).toBe(10);
            expect(secureRandomAlphanumeric(24).length).toBe(24);
        });

        it('should contain only alphanumeric characters', () => {
            const str = secureRandomAlphanumeric(50);
            expect(/^[a-zA-Z0-9]+$/.test(str)).toBe(true);
        });
    });

    describe('secureUUIDv4', () => {
        it('should return a valid UUID v4 format', () => {
            const uuid = secureUUIDv4();
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuidRegex.test(uuid)).toBe(true);
        });

        it('should use crypto.randomUUID if available', () => {
            const mockRandomUUID = vi.fn(() => '12345678-1234-4234-8234-123456789012');
            vi.stubGlobal('crypto', {
                ...globalThis.crypto,
                randomUUID: mockRandomUUID
            });

            const uuid = secureUUIDv4();
            expect(mockRandomUUID).toHaveBeenCalledTimes(1);
            expect(uuid).toBe('12345678-1234-4234-8234-123456789012');
        });

        it('should use fallback implementation if crypto.randomUUID is not available', () => {
            const mockGetRandomValues = vi.fn((array: Uint8Array) => {
                for (let i = 0; i < array.length; i++) array[i] = 0;
                return array;
            });

            vi.stubGlobal('crypto', {
                getRandomValues: mockGetRandomValues
            });

            const uuid = secureUUIDv4();
            // Should be filled with 0s except version and variant
            expect(uuid).toBe('00000000-0000-4000-8000-000000000000');
            expect(mockGetRandomValues).toHaveBeenCalledTimes(1);
        });
    });

    describe('secureShuffleArray', () => {
        it('should return a new array with same length and elements', () => {
            const original = [1, 2, 3, 4, 5];
            const shuffled = secureShuffleArray(original);

            expect(shuffled).not.toBe(original);
            expect(shuffled.length).toBe(original.length);
            expect([...shuffled].sort()).toEqual([...original].sort());
        });

        it('should handle empty array', () => {
            expect(secureShuffleArray([])).toEqual([]);
        });

        it('should handle single element array', () => {
            expect(secureShuffleArray([1])).toEqual([1]);
        });
    });

    describe('secureRandomPick', () => {
        it('should throw RangeError if array is empty', () => {
            expect(() => secureRandomPick([])).toThrow(RangeError);
        });

        it('should pick an element from the array', () => {
            const array = ['apple', 'banana', 'cherry'];
            for (let i = 0; i < 20; i++) {
                const picked = secureRandomPick(array);
                expect(array).toContain(picked);
            }
        });
    });
});
