import { describe, it, expect, vi } from 'vitest';
import { RoyaltyService, RevenueReportItem } from '@/services/finance/RoyaltyService';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { db } from '@/services/firebase';
import { doc, collection, getDocs, query, where } from 'firebase/firestore';

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

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    runTransaction: vi.fn(async (db, cb) => {
        const transaction = {
            get: vi.fn(async (ref) => ({
                exists: () => true,
                data: () => ({ balance: 100, totalExpense: 100 })
            })),
            update: vi.fn(),
            set: vi.fn()
        };
        return await cb(transaction);
    }),
    addDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn()
}));

describe('RoyaltyService', () => {
    const mockMetadata: Record<string, ExtendedGoldenMetadata> = {
        'US-RC1-23-00001': {
            id: 'release_123',
            trackTitle: 'Alpha Track',
            artistName: 'Indie Artist',
            isrc: 'US-RC1-23-00001',
            explicit: false,
            genre: 'Electronic',
            labelName: 'IndiiOS',
            splits: [
                { legalName: 'Producer B', role: 'producer', percentage: 50, email: 'producer@example.com' },
                { legalName: 'Artist A', role: 'songwriter', percentage: 50, email: 'artist@example.com' }
            ],
            pro: 'ASCAP',
            publisher: 'IndiiOS Publishing',
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

    it('should calculate splits correctly and apply recoupment', async () => {
        const result = await RoyaltyService.ingestRevenueReport('report_001', mockRevenue, mockMetadata);

        expect(result.success).toBe(true);
        // 150 gross - 100 recoupment = 50 unallocated
        // 50% of 50 = 25 for each payee
        expect(result.payoutCount).toBe(2);
    });
});
