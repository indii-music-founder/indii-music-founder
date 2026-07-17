import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin', () => ({
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: Object.assign(vi.fn(), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    }),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

import {
    calculateProvisionalAllocation,
    processRoyaltyAllocations,
} from '../functions/finance/calculateRoyaltyAllocations';

function makeFirestore(seed: Record<string, Record<string, unknown>>) {
    const store = new Map(Object.entries(seed));
    const reference = (path: string): any => ({
        path,
        get: async () => ({
            exists: store.has(path),
            data: () => store.get(path),
        }),
        set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
            store.set(path, options?.merge ? { ...store.get(path), ...data } : data);
        },
        collection: (name: string) => collection(`${path}/${name}`),
    });
    const collection = (path: string): any => ({
        doc: (id: string) => reference(`${path}/${id}`),
    });
    const firestore = {
        collection,
        runTransaction: async (callback: (transaction: any) => Promise<unknown>) => callback({
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: Record<string, unknown>, options?: { merge?: boolean }) => {
                store.set(ref.path, options?.merge ? { ...store.get(ref.path), ...data } : data);
            },
        }),
    };
    return { firestore, store };
}

describe('calculateProvisionalAllocation', () => {
    it('applies recoupment before recording-owner splits and conserves every micro', () => {
        const result = calculateProvisionalAllocation({
            grossRevenueMicros: 150_000_000,
            recoupmentBalanceMicros: 100_000_000,
            recordingSplits: [
                { legalName: 'Artist', email: 'artist@example.com', role: 'performer', percentage: 50 },
                { legalName: 'Producer', email: 'producer@example.com', role: 'producer', percentage: 50 },
            ],
            legacySplits: [],
        });

        expect(result).toEqual({
            status: 'held_for_reconciliation',
            recoupmentAppliedMicros: 100_000_000,
            remainingRecoupmentMicros: 0,
            distributableMicros: 50_000_000,
            allocations: [
                expect.objectContaining({ recipientEmail: 'artist@example.com', amountMicros: 25_000_000 }),
                expect.objectContaining({ recipientEmail: 'producer@example.com', amountMicros: 25_000_000 }),
            ],
        });
        expect(result.allocations.reduce((total, item) => total + item.amountMicros, 0)).toBe(50_000_000);
    });

    it('prefers explicit recording splits over legacy/composition-oriented splits', () => {
        const result = calculateProvisionalAllocation({
            grossRevenueMicros: 10_000_000,
            recoupmentBalanceMicros: 0,
            recordingSplits: [
                { legalName: 'Master Owner', email: 'master@example.com', role: 'performer', percentage: 100 },
            ],
            legacySplits: [
                { legalName: 'Writer', email: 'writer@example.com', role: 'songwriter', percentage: 100 },
            ],
        });

        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0]?.recipientEmail).toBe('master@example.com');
    });

    it('blocks the obligation when split percentages do not total 100 instead of normalizing or inventing a label share', () => {
        const result = calculateProvisionalAllocation({
            grossRevenueMicros: 10_000_000,
            recoupmentBalanceMicros: 0,
            recordingSplits: [],
            legacySplits: [
                { legalName: 'Artist', email: 'artist@example.com', role: 'performer', percentage: 80 },
            ],
        });

        expect(result.status).toBe('blocked_invalid_splits');
        expect(result.allocations).toEqual([]);
        expect(result.blockReason).toMatch(/100/);
    });

    it('uses deterministic largest-remainder rounding without losing a micro', () => {
        const result = calculateProvisionalAllocation({
            grossRevenueMicros: 1,
            recoupmentBalanceMicros: 0,
            recordingSplits: [
                { legalName: 'A', email: 'a@example.com', role: 'performer', percentage: 33.33 },
                { legalName: 'B', email: 'b@example.com', role: 'producer', percentage: 33.33 },
                { legalName: 'C', email: 'c@example.com', role: 'other', percentage: 33.34 },
            ],
            legacySplits: [],
        });

        expect(result.allocations.reduce((total, item) => total + item.amountMicros, 0)).toBe(1);
        expect(result.allocations.find(item => item.recipientEmail === 'c@example.com')?.amountMicros).toBe(1);
    });
});

describe('processRoyaltyAllocations', () => {
    it('creates owner-readable held obligations from the receipt and owner catalog, then becomes idempotent', async () => {
        const { firestore, store } = makeFirestore({
            'dsr_processed_reports/dsr-1': {
                userId: 'owner-1',
                reportId: 'RPT-1',
                earningsIds: ['earn-1'],
            },
            'earnings/earn-1': {
                userId: 'owner-1',
                sourceReceiptId: 'dsr-1',
                trackId: 'track-1',
                releaseId: 'release-1',
                isrc: 'USABC2600001',
                netRevenue: 12.5,
                currencyCode: 'USD',
                sourceTrust: 'user_uploaded_unverified',
                reconciliationStatus: 'pending_review',
                period: { startDate: '2026-06-01', endDate: '2026-06-30' },
            },
            'users/owner-1/tracks/track-1': {
                recordingSplits: [{
                    legalName: 'Master Owner',
                    email: 'master@example.com',
                    role: 'performer',
                    percentage: 100,
                }],
            },
        });

        const first = await processRoyaltyAllocations('owner-1', 'dsr-1', firestore as never);

        expect(first).toEqual(expect.objectContaining({
            processedEarnings: 1,
            heldPayouts: 1,
            blockedEarnings: 0,
        }));
        const payouts = [...store.entries()].filter(([path]) => path.startsWith('payouts/'));
        expect(payouts).toHaveLength(1);
        expect(payouts[0]?.[1]).toEqual(expect.objectContaining({
            userId: 'owner-1',
            recipientEmail: 'master@example.com',
            amountMicros: 12_500_000,
            status: 'held_for_reconciliation',
            taxStatus: 'not_calculated',
        }));
        expect(store.get('earnings/earn-1')).toEqual(expect.objectContaining({
            allocationStatus: 'held_for_reconciliation',
        }));

        const second = await processRoyaltyAllocations('owner-1', 'dsr-1', firestore as never);
        expect(second).toEqual(expect.objectContaining({
            processedEarnings: 0,
            alreadyProcessedEarnings: 1,
            heldPayouts: 0,
        }));
        expect([...store.keys()].filter(path => path.startsWith('payouts/'))).toHaveLength(1);
    });

    it('does not expose another owner receipt through the callable processor', async () => {
        const { firestore } = makeFirestore({
            'dsr_processed_reports/dsr-1': {
                userId: 'owner-1',
                earningsIds: ['earn-1'],
            },
        });

        await expect(processRoyaltyAllocations('attacker', 'dsr-1', firestore as never))
            .rejects.toThrow(/not found for this owner/);
    });
});
