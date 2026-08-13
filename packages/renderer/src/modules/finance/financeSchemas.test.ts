import { describe, it, expect } from 'vitest';
import {
    ExpenseCategorySchema,
    ExpenseSchema,
    ReceiptScanResultSchema,
    sumPaidExpenses,
} from './schemas';

describe('Finance Schemas', () => {
    describe('ExpenseCategorySchema', () => {
        it('should accept valid categories', () => {
            expect(ExpenseCategorySchema.parse('Software / Plugins')).toBe('Software / Plugins');
            expect(() => ExpenseCategorySchema.parse('Random')).toThrow();
        });
    });

    describe('ExpenseSchema', () => {
        it('should validate valid expense', () => {
             const data = {
                 userId: 'user1',
                 vendor: 'AWS',
                 amount: 100.50,
                 category: 'Software / Plugins',
                 date: '2023-10-27',
             };
             expect(ExpenseSchema.parse(data).amount).toBe(100.50);
        });

        it('keeps payment and evidence states explicit when supplied', () => {
             const result = ExpenseSchema.parse({
                 userId: 'user1',
                 vendor: 'AWS',
                 amount: 100.50,
                 category: 'Software / Plugins',
                 date: '2023-10-27',
                 paymentStatus: 'expected',
                 evidenceStatus: 'unverified',
             });

             expect(result.paymentStatus).toBe('expected');
             expect(result.evidenceStatus).toBe('unverified');
        });

        it('never counts expected or legacy unclassified records as money spent', () => {
             const base = {
                 userId: 'user1',
                 vendor: 'Vendor',
                 category: 'Equipment',
                 date: '2026-10-10',
                 evidenceStatus: 'unverified' as const,
             };

             expect(sumPaidExpenses([
                 { ...base, amount: 100, paymentStatus: 'paid' },
                 { ...base, amount: 85, paymentStatus: 'expected' },
                 { ...base, amount: 20 },
             ])).toBe(100);
        });

        it('should require positive amount', () => {
             const data = {
                 userId: 'user1',
                 vendor: 'AWS',
                 amount: -10,
                 category: 'Software / Plugins',
                 date: '2023-10-27',
             };
             expect(() => ExpenseSchema.parse(data)).toThrow();
        });

        it('should validate date format YYYY-MM-DD', () => {
             const base = {
                 userId: 'user1',
                 vendor: 'AWS',
                 amount: 10,
                 category: 'Software / Plugins',
             };
             expect(ExpenseSchema.parse({ ...base, date: '2023-01-01' }).date).toBe('2023-01-01');

             expect(() => ExpenseSchema.parse({ ...base, date: '01-01-2023' })).toThrow();
             expect(() => ExpenseSchema.parse({ ...base, date: '2023/01/01' })).toThrow();
        });
    });

    describe('ReceiptScanResultSchema', () => {
        it('should allow partial data', () => {
            const data = {
                amount: 50
            };
            const result = ReceiptScanResultSchema.parse(data);
            expect(result.amount).toBe(50);
            expect(result.vendor).toBeUndefined();
        });
    });
});
