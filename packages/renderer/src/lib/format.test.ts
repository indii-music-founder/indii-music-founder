import { describe, it, expect } from 'vitest';
import { formatFileSize } from './format';

describe('formatFileSize', () => {
    it('formats 0 bytes correctly', () => {
        expect(formatFileSize(0)).toBe('0 B');
    });

    it('formats bytes < 1024 correctly', () => {
        expect(formatFileSize(500)).toBe('500 B');
        expect(formatFileSize(1023)).toBe('1,023 B');
    });

    it('formats exactly 1024 bytes as 1 KB', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('formats kilobytes correctly', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(1024 * 1023)).toBe('1,023 KB');
    });

    it('formats megabytes correctly', () => {
        expect(formatFileSize(1024 * 1024)).toBe('1 MB');
        expect(formatFileSize(1024 * 1024 * 10.5)).toBe('10.5 MB');
    });

    it('formats gigabytes correctly with 2 decimal places', () => {
        expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
        expect(formatFileSize(1024 * 1024 * 1024 * 2.564)).toBe('2.56 GB');
        expect(formatFileSize(1024 * 1024 * 1024 * 2.565)).toBe('2.57 GB');
    });

    it('formats terabytes correctly', () => {
        expect(formatFileSize(Math.pow(1024, 4))).toBe('1 TB');
        expect(formatFileSize(Math.pow(1024, 4) * 1.25)).toBe('1.25 TB');
    });

    it('formats petabytes correctly', () => {
        expect(formatFileSize(Math.pow(1024, 5))).toBe('1 PB');
        expect(formatFileSize(Math.pow(1024, 5) * 3.14159)).toBe('3.14 PB');
    });

    it('respects locale for decimal separators', () => {
        // German uses comma as decimal separator
        const result = formatFileSize(1024 * 1.5, 'de-DE');
        // Note: Intl.NumberFormat might use non-breaking spaces or other characters depending on the environment.
        // We just want to check if the comma is present.
        expect(result).toContain('1,5');
        expect(result).toContain('KB');
    });

    it('handles large GB values with appropriate precision', () => {
        expect(formatFileSize(1024 * 1024 * 1024 * 1023.99)).toBe('1,023.99 GB');
    });
});
