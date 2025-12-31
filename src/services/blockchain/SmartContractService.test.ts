
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartContractService } from './SmartContractService';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    collection: (db: any, col: string) => mockCollection(col),
    addDoc: (ref: any, data: any) => mockAddDoc(ref, data),
    getDocs: (q: any) => mockGetDocs(q),
    query: (ref: any, ...args: any[]) => mockQuery(ref, ...args),
    where: (field: string, op: string, val: any) => mockWhere(field, op, val),
    Timestamp: {
        now: () => ({ toISOString: () => new Date().toISOString() })
    }
}));

// Mock the db export from firebase service
vi.mock('@/services/firebase', () => ({
    db: {}
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

    it('should deploy a split contract and return an address', async () => {
        const address = await smartContractService.deploySplitContract({
            isrc: 'US-XYZ-26-00001',
            payees: [
                { walletAddress: '0xA', percentage: 50, role: 'Artist' },
                { walletAddress: '0xB', percentage: 50, role: 'Label' }
            ]
        });
        expect(address).toMatch(/^0x/);
        expect(address.length).toBeGreaterThan(10);
        // Verify persistence was called
        expect(mockCollection).toHaveBeenCalledWith('smart_contracts');
        expect(mockAddDoc).toHaveBeenCalled();
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

    it('should record transactions to the immutable ledger', async () => {
        const isrc = 'US-LEDGER-TEST';
        await smartContractService.deploySplitContract({
            isrc,
            payees: [{ walletAddress: '0xA', percentage: 100, role: 'Solo' }]
        });

        // Test the read back
        const history = await smartContractService.getChainOfCustody(isrc);

        // Verify query structure
        expect(mockCollection).toHaveBeenCalledWith('ledger');
        expect(mockWhere).toHaveBeenCalledWith('entityId', '==', isrc);

        expect(history).toHaveLength(1);
        expect(history[0].action).toBe('SPLIT_EXECUTION');
    });

    it('should mint tokens (SongShares)', async () => {
        // Setup mock for this specific call if needed, otherwise default works
        mockGetDocs.mockResolvedValueOnce({
            docs: [
                {
                    data: () => ({
                        hash: 'mock-hash',
                        timestamp: new Date().toISOString(),
                        action: 'TOKEN_MINT',
                        entityId: 'US-TOKEN',
                        details: 'Mock details'
                    })
                }
            ]
        });

        const tokenAddr = await smartContractService.tokenizeAsset('US-TOKEN', 100);
        expect(tokenAddr).toMatch(/^0xToken/);

        const history = await smartContractService.getChainOfCustody('US-TOKEN');
        expect(history[0].action).toBe('TOKEN_MINT');
    });
});
