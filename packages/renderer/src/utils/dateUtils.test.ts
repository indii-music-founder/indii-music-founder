import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { toDateString, extractDatePart, splitFirst } from './dateUtils';

describe('dateUtils', () => {
    describe('toDateString', () => {
        beforeEach(() => {
            // Mock system time to make default new Date() predictable
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-03-17T10:30:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should extract the date portion from a specific Date object', () => {
            const date = new Date('2025-12-25T15:00:00Z');
            expect(toDateString(date)).toBe('2025-12-25');
        });

        it('should use the current date if no argument is provided', () => {
            expect(toDateString()).toBe('2026-03-17');
        });
    });

    describe('extractDatePart', () => {
        it('should extract the date portion from a valid ISO string', () => {
            expect(extractDatePart('2026-03-17T10:30:00Z')).toBe('2026-03-17');
        });

        it('should return the string as-is if there is no "T"', () => {
            expect(extractDatePart('2026-03-17')).toBe('2026-03-17');
        });

        it('should handle an empty string gracefully', () => {
            expect(extractDatePart('')).toBe('');
        });
    });

    describe('splitFirst', () => {
        it('should split by the first occurrence of the delimiter and return the first part', () => {
            expect(splitFirst('image/png', '/')).toBe('image');
        });

        it('should return the original string if the delimiter is not found', () => {
            expect(splitFirst('foo@bar.com', '/')).toBe('foo@bar.com');
        });

        it('should return an empty string if the string starts with the delimiter', () => {
            expect(splitFirst('@username', '@')).toBe('');
        });

        it('should handle an empty string input correctly', () => {
            expect(splitFirst('', '@')).toBe('');
        });

        it('should only split on the first occurrence', () => {
            expect(splitFirst('a/b/c', '/')).toBe('a');
        });
    });
});
