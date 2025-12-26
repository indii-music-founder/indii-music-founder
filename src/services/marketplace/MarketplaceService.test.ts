import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketplaceService } from './MarketplaceService';

// --- Mocks ---

const {
    mockAddDoc,
    mockGetDocs,
    mockQuery,
    mockCollection,
    mockWhere,
    mockOrderBy,
    mockDoc,
    mockUpdateDoc
} = vi.hoisted(() => {
    return {
        mockAddDoc: vi.fn(),
        mockGetDocs: vi.fn(),
        mockQuery: vi.fn(),
        mockCollection: vi.fn(),
        mockWhere: vi.fn(),
        mockOrderBy: vi.fn(),
        mockDoc: vi.fn(),
        mockUpdateDoc: vi.fn(),
    }
});

vi.mock('@/services/firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    addDoc: mockAddDoc,
    getDocs: mockGetDocs,
    query: mockQuery,
    collection: mockCollection,
    where: mockWhere,
    orderBy: mockOrderBy,
    serverTimestamp: () => 'MOCK_TIMESTAMP',
    doc: mockDoc,
    updateDoc: mockUpdateDoc,
    increment: vi.fn(),
    Timestamp: {
        now: () => ({ toDate: () => new Date() })
    }
}));

// --- Test Suite ---

describe('MarketplaceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks
        mockCollection.mockReturnValue('MOCK_COLLECTION_REF');
    });

    describe('createProduct', () => {
        it('should successfully create a product and return the ID', async () => {
            const mockProductData = {
                sellerId: 'user-123',
                title: 'Test Album',
                description: 'A great album',
                price: 1000,
                currency: 'USD',
                type: 'album' as const,
                images: [],
                inventory: 100
            };

            mockAddDoc.mockResolvedValueOnce({ id: 'new-product-id' });

            const result = await MarketplaceService.createProduct(mockProductData);

            expect(mockCollection).toHaveBeenCalled();
            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    ...mockProductData,
                    isActive: true,
                    createdAt: 'MOCK_TIMESTAMP'
                })
            );
            expect(result).toBe('new-product-id');
        });
    });

    describe('getProductsByArtist', () => {
        it('should fetch and format products correctly', async () => {
            const mockDocs = [
                {
                    id: 'prod-1',
                    data: () => ({
                        title: 'Product 1',
                        sellerId: 'artist-1',
                        price: 500,
                        createdAt: { toDate: () => new Date('2025-01-01') }
                    })
                },
                {
                    id: 'prod-2',
                    data: () => ({
                        title: 'Product 2',
                        sellerId: 'artist-1',
                        price: 1500,
                        createdAt: { toDate: () => new Date('2025-01-02') }
                    })
                }
            ];

            mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

            const products = await MarketplaceService.getProductsByArtist('artist-1');

            expect(mockQuery).toHaveBeenCalled();
            expect(mockWhere).toHaveBeenCalledWith('sellerId', '==', 'artist-1');
            expect(products).toHaveLength(2);
            expect(products[0].id).toBe('prod-1');
            expect(products[1].title).toBe('Product 2');
        });
    });

    describe('purchaseProduct', () => {
        it('should process a mock purchase successfully', async () => {
            mockAddDoc.mockResolvedValueOnce({ id: 'purchase-id' });

            const result = await MarketplaceService.purchaseProduct(
                'prod-1',
                'buyer-1',
                'seller-1',
                1000
            );

            expect(mockAddDoc).toHaveBeenCalledWith(
                'MOCK_COLLECTION_REF',
                expect.objectContaining({
                    buyerId: 'buyer-1',
                    sellerId: 'seller-1',
                    productId: 'prod-1',
                    amount: 1000,
                    status: 'completed'
                })
            );
            expect(result).toBe('purchase-id');
        });
    });
});
