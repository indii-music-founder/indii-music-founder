import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoyaltyPayoutService, RoyaltyPayout } from '../RoyaltyPayoutService';
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { logger } from '@/utils/logger';

vi.mock('firebase/firestore', () => {
    return {
        getFirestore: vi.fn(),
        collection: vi.fn(),
        addDoc: vi.fn(),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        updateDoc: vi.fn(),
        doc: vi.fn(),
        Timestamp: {
            now: vi.fn()
        },
        FieldValue: {
            serverTimestamp: vi.fn()
        }
    };
});

vi.mock('@/services/firebase', () => ({
    app: {}
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('RoyaltyPayoutService', () => {
    let service: RoyaltyPayoutService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new RoyaltyPayoutService();
    });

    describe('createPayout', () => {
        it('should create a pending payout successfully', async () => {
            const mockPayout = {
                artistId: 'artist-1',
                artistName: 'Test Artist',
                amount: 100,
                currency: 'USD',
                period: '2026-Q1',
                method: 'stripe' as const
            };

            const mockDocRef = { id: 'payout-123' };
            vi.mocked(addDoc).mockResolvedValue(mockDocRef as any);

            const result = await service.createPayout(mockPayout);

            expect(addDoc).toHaveBeenCalledTimes(1);
            expect(result).toBe('payout-123');
            expect(logger.info).toHaveBeenCalledWith(
                `[Royalty] Created pending payout for Test Artist (100 USD)`
            );
        });

        it('should handle errors when creating a payout', async () => {
            const mockPayout = {
                artistId: 'artist-1',
                artistName: 'Test Artist',
                amount: 100,
                currency: 'USD',
                period: '2026-Q1',
                method: 'stripe' as const
            };

            const mockError = new Error('Firestore Error');
            vi.mocked(addDoc).mockRejectedValue(mockError);

            await expect(service.createPayout(mockPayout)).rejects.toThrow('Firestore Error');
            expect(logger.error).toHaveBeenCalledWith('[Royalty] Failed to create payout:', mockError);
        });
    });

    describe('finalizePayout', () => {
        it('should mark a payout as processed successfully', async () => {
            const payoutId = 'payout-123';
            const mockDocRef = {};
            vi.mocked(doc).mockReturnValue(mockDocRef as any);
            vi.mocked(updateDoc).mockResolvedValue(undefined);

            await service.finalizePayout(payoutId);

            expect(doc).toHaveBeenCalled();
            expect(updateDoc).toHaveBeenCalledTimes(1);
            expect(logger.info).toHaveBeenCalledWith(`[Royalty] Payout ${payoutId} updated to processed`);
        });

        it('should mark a payout as failed successfully', async () => {
            const payoutId = 'payout-123';
            const mockDocRef = {};
            vi.mocked(doc).mockReturnValue(mockDocRef as any);
            vi.mocked(updateDoc).mockResolvedValue(undefined);

            await service.finalizePayout(payoutId, 'failed');

            expect(doc).toHaveBeenCalled();
            expect(updateDoc).toHaveBeenCalledTimes(1);
            expect(logger.info).toHaveBeenCalledWith(`[Royalty] Payout ${payoutId} updated to failed`);
        });

        it('should handle errors when finalizing a payout', async () => {
            const payoutId = 'payout-123';
            const mockError = new Error('Update Error');
            vi.mocked(updateDoc).mockRejectedValue(mockError);

            await service.finalizePayout(payoutId);

            expect(logger.error).toHaveBeenCalledWith('[Royalty] Failed to finalize payout:', mockError);
        });
    });

    describe('getPendingForPeriod', () => {
        it('should fetch pending payouts for a given period', async () => {
            const mockPeriod = '2026-Q1';
            const mockDocs = [
                { id: '1', data: () => ({ amount: 100 }) },
                { id: '2', data: () => ({ amount: 200 }) }
            ];
            const mockSnapshot = {
                forEach: (callback: any) => mockDocs.forEach(callback)
            };
            vi.mocked(getDocs).mockResolvedValue(mockSnapshot as any);

            const result = await service.getPendingForPeriod(mockPeriod);

            expect(getDocs).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ id: '1', amount: 100 });
            expect(result[1]).toEqual({ id: '2', amount: 200 });
        });

        it('should handle errors and return empty array when fetching fails', async () => {
            const mockError = new Error('Query Error');
            vi.mocked(getDocs).mockRejectedValue(mockError);

            const result = await service.getPendingForPeriod('2026-Q1');

            expect(result).toEqual([]);
            expect(logger.error).toHaveBeenCalledWith('[Royalty] Failed to fetch pending payouts:', mockError);
        });
    });

    describe('generateCsv', () => {
        it('should generate a valid CSV string from payouts', async () => {
            const mockPayouts: RoyaltyPayout[] = [
                {
                    id: '1',
                    artistId: 'art-1',
                    artistName: 'Artist One',
                    amount: 100,
                    currency: 'USD',
                    method: 'wire',
                    period: '2026-Q1',
                    status: 'pending'
                },
                {
                    artistId: 'art-2',
                    artistName: 'Artist Two',
                    amount: 200,
                    currency: 'EUR',
                    method: 'stripe',
                    period: '2026-Q1',
                    status: 'pending'
                }
            ];

            const result = await service.generateCsv(mockPayouts);

            const expectedLines = [
                'payoutId,artistId,artistName,amount,currency,method,period',
                '"1","art-1","Artist One","100","USD","wire","2026-Q1"',
                '"","art-2","Artist Two","200","EUR","stripe","2026-Q1"'
            ];
            expect(result).toBe(expectedLines.join('\n'));
            expect(logger.info).toHaveBeenCalledWith(`[Royalty] Generated CSV for 2 payouts.`);
        });

        it('should handle missing payout ID in CSV', async () => {
             const mockPayouts: RoyaltyPayout[] = [
                {
                    artistId: 'art-1',
                    artistName: 'Artist Missing ID',
                    amount: 150,
                    currency: 'USD',
                    method: 'wire',
                    period: '2026-Q1',
                    status: 'pending'
                }
            ];

            const result = await service.generateCsv(mockPayouts);

            const expectedLines = [
                'payoutId,artistId,artistName,amount,currency,method,period',
                '"","art-1","Artist Missing ID","150","USD","wire","2026-Q1"'
            ];
            expect(result).toBe(expectedLines.join('\n'));
        });

        it('should handle errors when generating CSV', async () => {
            const mockPayouts = null as any;

            const result = await service.generateCsv(mockPayouts);

            expect(result).toBe('');
            expect(logger.error).toHaveBeenCalled();
        });
    });
});
