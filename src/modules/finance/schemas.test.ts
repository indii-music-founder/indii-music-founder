import { describe, it, expect } from 'vitest';
import {
    ExpenseCategorySchema,
    ExpenseSchema,
    ReceiptScanResultSchema
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
