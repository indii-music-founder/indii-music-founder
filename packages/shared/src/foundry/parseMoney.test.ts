import { describe, it, expect } from 'vitest';
import { parseMoneyAmount } from './parseMoney';

describe('parseMoneyAmount (ISSUE-1443)', () => {
    it('parses US format', () => {
        expect(parseMoneyAmount('1,234.56')).toBe(1234.56);
        expect(parseMoneyAmount('$1,234.56')).toBe(1234.56);
        expect(parseMoneyAmount('0.99')).toBe(0.99);
    });

    it('parses EU format without silently corrupting magnitude', () => {
        expect(parseMoneyAmount('1.234,56')).toBe(1234.56);
        expect(parseMoneyAmount('1.234.567,89')).toBe(1234567.89);
        expect(parseMoneyAmount('12,50')).toBe(12.5);
    });

    it('treats accounting parentheses as negative', () => {
        expect(parseMoneyAmount('(0.50)')).toBe(-0.5);
        expect(parseMoneyAmount('(1.234,56)')).toBe(-1234.56);
        expect(parseMoneyAmount('-0.50')).toBe(-0.5);
    });

    it('auto-detects decimal separator when both separators appear', () => {
        expect(parseMoneyAmount('1.234,56')).toBe(1234.56);
        expect(parseMoneyAmount('1,234.56')).toBe(1234.56);
    });

    it('honours explicit format hints', () => {
        expect(parseMoneyAmount('1.234', 'eu')).toBe(1234);
        expect(parseMoneyAmount('1,234', 'us')).toBe(1234);
    });

    it('returns null for unparseable input instead of a wrong number', () => {
        expect(parseMoneyAmount('')).toBeNull();
        expect(parseMoneyAmount('N/A')).toBeNull();
        expect(parseMoneyAmount('--')).toBeNull();
    });
});
