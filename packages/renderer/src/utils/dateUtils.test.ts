import { describe, it, expect } from 'vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { toDateString, extractDatePart, splitFirst } from './dateUtils';

describe('dateUtils', () => {
    describe('toDateString', () => {
        it('should return a date string in YYYY-MM-DD format from a Date object', () => {
            const date = new Date('2026-03-17T10:30:00Z');
            const result = toDateString(date);
            expect(result).toBe('2026-03-17');
        });

        it('should handle dates at different times', () => {
            const date1 = new Date('2026-03-17T00:00:00.000Z');
            const date2 = new Date('2026-03-17T23:59:59.999Z');
            expect(toDateString(date1)).toBe('2026-03-17');
            expect(toDateString(date2)).toBe('2026-03-17');
        });

        it('should handle no arguments by using the current date', () => {
            // Can't easily test exact date since it changes, but we can verify format
            const result = toDateString();
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
        it('should extract the date part from an ISO string', () => {
            expect(extractDatePart('2026-03-17T10:30:00Z')).toBe('2026-03-17');
            expect(extractDatePart('2026-03-17T00:00:00.000Z')).toBe('2026-03-17');
        });

        it('should return the original string if there is no T', () => {
            expect(extractDatePart('2026-03-17')).toBe('2026-03-17');
            expect(extractDatePart('invalid-date')).toBe('invalid-date');
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
        it('should split by the first occurrence of a delimiter and return the first part', () => {
            expect(splitFirst('image/png', '/')).toBe('image');
            expect(splitFirst('foo@bar.com', '@')).toBe('foo');
            expect(splitFirst('a-b-c', '-')).toBe('a');
        });

        it('should return the original string if the delimiter is not found', () => {
            expect(splitFirst('nodelim', '@')).toBe('nodelim');
            expect(splitFirst('nodelim', '/')).toBe('nodelim');
        });

        it('should return an empty string if the string starts with the delimiter', () => {
            expect(splitFirst('/image/png', '/')).toBe('');
            expect(splitFirst('@foo', '@')).toBe('');
        });

        it('should return the string before the first delimiter even if it appears multiple times', () => {
            expect(splitFirst('part1/part2/part3', '/')).toBe('part1');
        });

        it('should handle empty string inputs', () => {
            expect(splitFirst('', '/')).toBe('');
        });

        it('should handle empty delimiter', () => {
            // When delimiter is '', indexOf('') is 0.
            // So str.substring(0, 0) should return ''.
            expect(splitFirst('hello', '')).toBe('');
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
