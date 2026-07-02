import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoyaltyService, RevenueReportItem } from '@/services/finance/RoyaltyService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import * as firestore from 'firebase/firestore';


// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {
        type: 'firestore'
    },
    auth: {
        currentUser: { uid: 'test-user', email: 'test@example.com' }
    },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Stateful in-memory Firestore: persisted docs survive across calls within a test,
// so duplicate-ingestion and partial-retry scenarios exercise real claim state.
vi.mock('firebase/firestore', () => {
    const store = new Map<string, Record<string, unknown>>();
    let autoIdCounter = 0;
    return {
        __store: store,
        collection: vi.fn((_db: unknown, name: string) => ({ __collection: name })),
        doc: vi.fn((dbOrCollection: unknown, collectionName?: string, id?: string) => {
            if (typeof collectionName === 'string' && typeof id === 'string') {
                return { path: `${collectionName}/${id}` };
            }
            const parent = (dbOrCollection as { __collection?: string })?.__collection ?? 'auto';
            autoIdCounter++;
            return { path: `${parent}/auto-${autoIdCounter}` };
        }),
        runTransaction: vi.fn(async (_db: unknown, cb: (tx: unknown) => Promise<unknown>) => {
            const transaction = {
                get: async (ref: { path: string }) => ({
                    exists: () => store.has(ref.path),
                    data: () => store.get(ref.path)
                }),
                set: (ref: { path: string }, data: Record<string, unknown>) => {
                    store.set(ref.path, data);
                },
                update: (ref: { path: string }, data: Record<string, unknown>) => {
                    if (!store.has(ref.path)) {
                        throw new Error(`update() on missing doc ${ref.path}`);
                    }
                    store.set(ref.path, { ...store.get(ref.path), ...data });
                }
            };
            return await cb(transaction);
        }),
        setDoc: vi.fn(async (ref: { path: string }, data: Record<string, unknown>) => {
            store.set(ref.path, data);
        }),
        addDoc: vi.fn(),
        serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn()
    };
});

const store = (firestore as unknown as { __store: Map<string, Record<string, unknown>> }).__store;

const docsIn = (collectionName: string) =>
    [...store.entries()].filter(([path]) => path.startsWith(`${collectionName}/`));

describe('RoyaltyService', () => {
    const mockMetadata: Record<string, ExtendedGoldenMetadata> = {
        'US-RC1-23-00001': {
            id: 'release_123',
            trackTitle: 'Alpha Track',
            artistName: 'Indie Artist',
            isrc: 'US-RC1-23-00001',
            explicit: false,
            genre: 'Electronic',
            labelName: 'indii',
            splits: [
                { legalName: 'Producer B', role: 'producer', percentage: 50, email: 'producer@example.com' },
                { legalName: 'Artist A', role: 'songwriter', percentage: 50, email: 'artist@example.com' }
            ],
            pro: 'ASCAP',
            publisher: 'indii Publishing',
            containsSamples: false,
            isGolden: true,
            releaseType: 'Single',
            releaseDate: '2023-01-01',
            territories: ['Worldwide'],
            distributionChannels: ['streaming'],
            aiGeneratedContent: { isFullyAIGenerated: false, isPartiallyAIGenerated: false }
        }
    };

    const mockRevenue: RevenueReportItem[] = [
        {
            transactionId: 'tx_999',
            isrc: 'US-RC1-23-00001',
            platform: 'Spotify',
            territory: 'US',
            grossRevenue: 150.00,
            currency: 'USD'
        }
    ];

    beforeEach(() => {
        store.clear();
        store.set('recoupment_balances/release_123', { releaseId: 'release_123', balance: 100, totalExpense: 100, updatedAt: 'MOCK_TIMESTAMP' });
    });

    it('should calculate splits correctly and apply recoupment', async () => {
        const result = await RoyaltyService.ingestRevenueReport('report_001', mockRevenue, mockMetadata);

        expect(result.success).toBe(true);
        // 150 gross - 100 recoupment = 50 unallocated
        // 50% of 50 = 25 for each payee
        expect(result.payoutCount).toBe(2);
        expect(result.processedGroups).toBe(1);
        expect(result.skippedGroups).toBe(0);
        expect(result.alreadyProcessed).toBe(false);

        // Deterministic payout doc ids: reportId--transactionId--isrc--payee--role
        expect(store.get('payouts/report_001--tx_999--US-RC1-23-00001--producer@example.com--producer')).toMatchObject({ amount: 25, reportId: 'report_001', status: 'pending' });
        expect(store.get('payouts/report_001--tx_999--US-RC1-23-00001--artist@example.com--songwriter')).toMatchObject({ amount: 25 });

        // Recoupment fully consumed and the claim recorded atomically
        expect(store.get('recoupment_balances/release_123')).toMatchObject({ balance: 0 });
        expect(store.get('royalty_report_claims/report_001--release_123')).toMatchObject({ reportId: 'report_001', releaseId: 'release_123', payoutCount: 2, recoupmentApplied: 100 });
    });

    it('should be a no-op when the same report is ingested twice', async () => {
        const first = await RoyaltyService.ingestRevenueReport('report_001', mockRevenue, mockMetadata);
        expect(first.payoutCount).toBe(2);

        const second = await RoyaltyService.ingestRevenueReport('report_001', mockRevenue, mockMetadata);

        expect(second.success).toBe(true);
        expect(second.payoutCount).toBe(0);
        expect(second.processedGroups).toBe(0);
        expect(second.skippedGroups).toBe(1);
        expect(second.alreadyProcessed).toBe(true);

        // No duplicate payout docs and no amount drift: without the claim guard a
        // second run would see balance 0 and rewrite the docs at 75/75 instead of 25/25.
        expect(docsIn('payouts')).toHaveLength(2);
        expect(store.get('payouts/report_001--tx_999--US-RC1-23-00001--producer@example.com--producer')).toMatchObject({ amount: 25 });
        // Recoupment untouched by the duplicate run
        expect(store.get('recoupment_balances/release_123')).toMatchObject({ balance: 0 });
    });

    it('should process only unclaimed release groups on a partial retry', async () => {
        const twoReleaseMetadata: Record<string, ExtendedGoldenMetadata> = {
            ...mockMetadata,
            'US-RC1-23-00002': {
                ...mockMetadata['US-RC1-23-00001'],
                id: 'release_456',
                trackTitle: 'Beta Track',
                isrc: 'US-RC1-23-00002'
            }
        };
        const twoReleaseRevenue: RevenueReportItem[] = [
            ...mockRevenue,
            { transactionId: 'tx_1000', isrc: 'US-RC1-23-00002', platform: 'Apple Music', territory: 'US', grossRevenue: 80.00, currency: 'USD' }
        ];
        // Simulate a prior run that committed release_123 but failed before release_456
        store.set('royalty_report_claims/report_002--release_123', { reportId: 'report_002', releaseId: 'release_123', payoutCount: 2, recoupmentApplied: 100, processedAt: 'MOCK_TIMESTAMP' });

        const result = await RoyaltyService.ingestRevenueReport('report_002', twoReleaseRevenue, twoReleaseMetadata);

        expect(result.success).toBe(true);
        expect(result.skippedGroups).toBe(1);
        expect(result.processedGroups).toBe(1);
        expect(result.alreadyProcessed).toBe(false);
        // Only release_456 payouts written (no recoupment doc for it: 80 → 40/40)
        expect(result.payoutCount).toBe(2);
        expect(docsIn('payouts').every(([path]) => path.includes('US-RC1-23-00002'))).toBe(true);
        // release_123 recoupment untouched by the skipped group
        expect(store.get('recoupment_balances/release_123')).toMatchObject({ balance: 100 });
    });

    it('should reject ingestion without a reportId and write nothing', async () => {
        const result = await RoyaltyService.ingestRevenueReport('  ', mockRevenue, mockMetadata);

        expect(result.success).toBe(false);
        expect(result.error).toContain('reportId');
        expect(docsIn('payouts')).toHaveLength(0);
        expect(docsIn('royalty_report_claims')).toHaveLength(0);
        expect(store.get('recoupment_balances/release_123')).toMatchObject({ balance: 100 });
    });

    it('should merge duplicate (payee, role) splits into one deterministic payout', async () => {
        const duplicateSplitMetadata: Record<string, ExtendedGoldenMetadata> = {
            'US-RC1-23-00001': {
                ...mockMetadata['US-RC1-23-00001'],
                splits: [
                    { legalName: 'Artist A', role: 'songwriter', percentage: 50, email: 'artist@example.com' },
                    { legalName: 'Artist A', role: 'songwriter', percentage: 50, email: 'artist@example.com' }
                ]
            }
        };

        const result = await RoyaltyService.ingestRevenueReport('report_003', mockRevenue, duplicateSplitMetadata);

        expect(result.success).toBe(true);
        // 50 unallocated after recoupment; both 25s merge into a single doc for the same payee+role
        expect(result.payoutCount).toBe(1);
        expect(store.get('payouts/report_003--tx_999--US-RC1-23-00001--artist@example.com--songwriter')).toMatchObject({ amount: 50 });
    });
});
