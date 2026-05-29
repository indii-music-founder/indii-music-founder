
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartContractService } from './SmartContractService';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    getFirestore: vi.fn(),
    collection: (db: any, col: string) => mockCollection(col),
    addDoc: (ref: any, data: any) => mockAddDoc(ref, data),
    getDocs: (q: any) => mockGetDocs(q),
    query: (ref: any, ...args: any[]) => mockQuery(ref, ...args),
    where: (field: string, op: string, val: any) => mockWhere(field, op, val),
    Timestamp: {
        now: () => ({
            serverTimestamp: vi.fn(), toISOString: () => new Date().toISOString()
        })
    }
}));

// Mock the db export from firebase service
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    db: {},
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

describe('SmartContractService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock behaviors
        mockAddDoc.mockResolvedValue({ id: 'mock-doc-id' });
        mockGetDocs.mockResolvedValue({
            docs: [
                {
                    data: () => ({
                        serverTimestamp: vi.fn(),
                        hash: 'mock-hash',
                        timestamp: new Date().toISOString(),
                        action: 'SPLIT_EXECUTION',
                        entityId: 'US-LEDGER-TEST',
                        details: 'Mock details'
                    })
                }
            ]
        });
    });

    it('should require a wallet provider before deploying a split contract', async () => {
        await expect(smartContractService.deploySplitContract({
            isrc: 'US-XYZ-26-00001',
            payees: [
                { walletAddress: '0xA', percentage: 50, role: 'Artist' },
                { walletAddress: '0xB', percentage: 50, role: 'Label' }
            ]
        })).rejects.toThrow('No wallet provider available');
        expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should throw error for invalid split percentages', async () => {
        await expect(smartContractService.deploySplitContract({
            isrc: 'US-FAIL',
            payees: [
                { walletAddress: '0xA', percentage: 50, role: 'Artist' },
                { walletAddress: '0xB', percentage: 40, role: 'Label' } // Total 90
            ]
        })).rejects.toThrow('Invalid Split Configuration');
    });

    it('should read transactions from the immutable ledger', async () => {
        const isrc = 'US-LEDGER-TEST';
        const history = await smartContractService.getChainOfCustody(isrc);

        // Verify query structure
        expect(mockCollection).toHaveBeenCalledWith('ledger');
        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', isrc);

        expect(history).toHaveLength(1);
        expect(history[0]!.action).toBe('SPLIT_EXECUTION');
    });

    it('should require a wallet provider before minting SongShares', async () => {
        await expect(smartContractService.tokenizeAsset('US-TOKEN', 100))
            .rejects.toThrow('No wallet provider available');
    });
});
