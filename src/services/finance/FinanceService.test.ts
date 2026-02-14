
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { financeService } from './FinanceService';
import { auth, db } from '@/services/firebase';
import { revenueService } from '@/services/RevenueService';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    Timestamp
} from 'firebase/firestore';
import { AppErrorCode } from '@/shared/types/errors';

// Mock RevenueService
vi.mock('@/services/RevenueService', () => ({
    revenueService: {
        getUserRevenueStats: vi.fn()
    }
}));

describe('FinanceService Integration Tests', () => {
    const mockUserId = 'test-uid'; // Matches setup.ts mock

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset auth mock to default authenticated state if needed
        // setup.ts already sets auth.currentUser to { uid: 'test-uid' ... }
    });

    describe('getEarningsSummary', () => {
        it('should return aggregated stats from revenueService', async () => {
            const mockStats = {
                totalRevenue: 5000,
                pendingPayouts: 100,
                lastPayoutAmount: 4900,
                lastPayoutDate: new Date('2025-01-01'),
                revenueChange: 10,
                sources: {
                    streaming: 3000,
                    merch: 1000,
                    licensing: 500,
                    social: 500
                }
            };

            vi.mocked(revenueService.getUserRevenueStats).mockResolvedValue(mockStats as any);

            const result = await financeService.getEarningsSummary(mockUserId);

            expect(result.totalEarnings).toBe(5000);
            expect(result.sources).toHaveLength(4);
            expect(revenueService.getUserRevenueStats).toHaveBeenCalledWith(mockUserId);
        });

        it('should throw if unauthorized', async () => {
            // Temporarily mock auth to be null or different user
            const originalUser = auth.currentUser;
            // @ts-expect-error - Mocking read-only property
            auth.currentUser = { uid: 'other-user' };

            await expect(financeService.getEarningsSummary(mockUserId))
                .rejects.toThrow('Unauthorized');

            // Restore
            // @ts-expect-error - Mocking read-only property
            auth.currentUser = originalUser;
        });
    });

    describe('addExpense', () => {
        it('should add valid expense', async () => {
            const newExpense: any = {
                description: 'Studio Time',
                amount: 200,
                category: 'Production',
                date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                vendor: 'In-House Studio',
                userId: mockUserId
                // missing id/createdAt is expected for Omit
            };

            vi.mocked(addDoc).mockResolvedValue({ id: 'exp-1' } as any);

            // Mock Timestamp.now
            const now = new Date();
            vi.spyOn(Timestamp, 'now').mockReturnValue({
                toDate: () => now,
                toMillis: () => now.getTime()
            } as any);

            const result = await financeService.addExpense(newExpense);

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: mockUserId,
                    amount: 200,
                    vendor: 'In-House Studio'
                })
            );
            expect(result.id).toBe('exp-1');
        });

        it('should validate expense schema', async () => {
            const invalidExpense: any = {
                amount: -100, // Invalid amount
                userId: mockUserId
            };

            await expect(financeService.addExpense(invalidExpense))
                .rejects.toThrow();
        });
    });

    describe('fetchEarnings', () => {
        it('should return earnings from firestore', async () => {
            const mockEarnings = {
                totalEarnings: 1000,
                pendingPayouts: 0,
                currency: 'USD',
                userId: mockUserId,
                lastPayout: 500,
                lastPayoutDate: new Date().toISOString(),
                trends: {
                    earningsChange: 5,
                    payoutsChange: 0
                },
                sources: [
                    { name: 'Streaming', amount: 800, percentage: 80 },
                    { name: 'Merch', amount: 200, percentage: 20 }
                ]
            };

            vi.mocked(getDocs).mockResolvedValue({
                empty: false,
                docs: [{
                    data: () => mockEarnings
                }]
            } as any);

            const result = await financeService.fetchEarnings(mockUserId);
            expect(result).toMatchObject({ totalEarnings: 1000 });
            expect(query).toHaveBeenCalledWith(
                expect.anything(), // earnings_reports collection
                where('userId', '==', mockUserId)
            );
        });
    });
});
