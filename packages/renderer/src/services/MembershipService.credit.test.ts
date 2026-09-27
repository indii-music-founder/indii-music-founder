import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.unmock('@/services/MembershipService');
import { MembershipService } from './MembershipService';
import { doc, getDoc, runTransaction } from 'firebase/firestore';

const mockWallet = {
    userId: 'user-credit-1',
    balanceCredits: 500,
    autoTopUp: false,
    autoTopUpThreshold: 100,
    currency: 'USD',
    createdAt: 1000,
    updatedAt: 1000,
};

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'user-credit-1' } },
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    runTransaction: vi.fn(),
    increment: vi.fn(n => n),
    query: vi.fn(),
    where: vi.fn(),
    getCountFromServer: vi.fn(),
}));

describe('MembershipService (Credit Wallet & Micro-Transactions)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getCreditBalance', () => {
        it('returns zero when wallet does not exist', async () => {
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => false,
                data: () => null,
            } as any);

            const balance = await MembershipService.getCreditBalance('user-credit-1');
            expect(balance).toBe(0);
        });

        it('returns balanceCredits from wallet document', async () => {
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockWallet,
            } as any);

            const balance = await MembershipService.getCreditBalance('user-credit-1');
            expect(balance).toBe(500);
        });
    });

    describe('canDeductCredits', () => {
        it('checks if wallet has sufficient credit balance', async () => {
            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockWallet,
            } as any);

            const check = await MembershipService.canDeductCredits(100, 'user-credit-1');
            expect(check.allowed).toBe(true);
            expect(check.balance).toBe(500);
            expect(check.required).toBe(100);

            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => mockWallet,
            } as any);

            const checkOver = await MembershipService.canDeductCredits(600, 'user-credit-1');
            expect(checkOver.allowed).toBe(false);
            expect(checkOver.balance).toBe(500);
            expect(checkOver.required).toBe(600);
        });
    });

    describe('deductCredits', () => {
        it('deducts credits atomically and generates transaction', async () => {
            const mockTx = {
                get: vi.fn().mockResolvedValue({
                    exists: () => true,
                    data: () => ({ ...mockWallet, balanceCredits: 500 }),
                }),
                set: vi.fn(),
                update: vi.fn(),
            };

            vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
                return callback(mockTx as any);
            });

            const result = await MembershipService.deductCredits(
                50,
                'AI Image Generation',
                'ref-img-1',
                'user-credit-1'
            );

            expect(result.success).toBe(true);
            expect(result.balanceAfter).toBe(450);
            expect(result.transactionId).toBeDefined();
            expect(mockTx.update).toHaveBeenCalled();
            expect(mockTx.set).toHaveBeenCalled();
        });

        it('fails closed when balance is insufficient', async () => {
            const mockTx = {
                get: vi.fn().mockResolvedValue({
                    exists: () => true,
                    data: () => ({ ...mockWallet, balanceCredits: 30 }),
                }),
                set: vi.fn(),
                update: vi.fn(),
            };

            vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
                return callback(mockTx as any);
            });

            vi.mocked(getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ ...mockWallet, balanceCredits: 30 }),
            } as any);

            const result = await MembershipService.deductCredits(
                50,
                'AI Image Generation',
                'ref-img-1',
                'user-credit-1'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient credits');
            expect(result.balanceAfter).toBe(30);
        });
    });

    describe('addCredits', () => {
        it('adds credits and records a purchase transaction', async () => {
            const mockTx = {
                get: vi.fn().mockResolvedValue({
                    exists: () => true,
                    data: () => ({ ...mockWallet, balanceCredits: 500 }),
                }),
                set: vi.fn(),
                update: vi.fn(),
            };

            vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
                return callback(mockTx as any);
            });

            const result = await MembershipService.addCredits(
                2500,
                'Growth Pack Purchase',
                'PURCHASE',
                'pi_stripe_abc',
                'user-credit-1'
            );

            expect(result.success).toBe(true);
            expect(result.balanceAfter).toBe(3000);
            expect(result.transactionId).toBeDefined();
            expect(mockTx.update).toHaveBeenCalled();
        });
    });
});
