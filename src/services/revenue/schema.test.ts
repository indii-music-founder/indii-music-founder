import { describe, it, expect } from 'vitest';
import {
    RevenueEntrySchema,
    EarningsSummarySchema
} from './schema';

describe('Revenue Schemas', () => {
    describe('RevenueEntrySchema', () => {
        it('should use defaults', () => {
            const data = {
                userId: 'user1'
            };
            const result = RevenueEntrySchema.parse(data);
            expect(result.amount).toBe(0);
            expect(result.currency).toBe('USD');
            expect(result.source).toBe('other');
            expect(result.status).toBe('completed');
        });

        it('should validate status enum', () => {
             const base = { userId: 'user1' };
             expect(RevenueEntrySchema.parse({ ...base, status: 'pending' }).status).toBe('pending');
             expect(() => RevenueEntrySchema.parse({ ...base, status: 'unknown' })).toThrow();
        });
    });

    describe('EarningsSummarySchema', () => {
        it('should validate complex nested structure', () => {
            const data = {
                period: {
                    startDate: '2023-01-01',
                    endDate: '2023-01-31'
                },
                byPlatform: [
                    { platformName: 'Spotify', revenue: 100 }
                ],
                // Defaults should handle the rest
            };
            const result = EarningsSummarySchema.parse(data);
            expect(result.totalGrossRevenue).toBe(0);
            expect(result.byPlatform).toHaveLength(1);
            expect(result.byPlatform[0].platformName).toBe('Spotify');
            expect(result.byPlatform[0].streams).toBe(0); // Default
        });
    });
});
