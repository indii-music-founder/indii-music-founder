import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    mockUpdateDoc,
    mockGetDoc,
    mockHttpsCallable,
    mockCallable
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
        mockGetDoc: vi.fn(),
        mockHttpsCallable: vi.fn(),
        mockCallable: vi.fn()
    }
});

vi.mock('@/services/firebase', () => ({
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

vi.mock('firebase/firestore', () => ({
    addDoc: mockAddDoc,
    getDocs: mockGetDocs,
    getDoc: mockGetDoc,
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

vi.mock('firebase/functions', () => ({
    httpsCallable: mockHttpsCallable.mockImplementation(() => mockCallable)
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
            expect(products[0]!.id).toBe('prod-1');
            expect(products[1]!.title).toBe('Product 2');
        });
    });

    describe('purchaseProduct', () => {
        const originalLocation = window.location;

        beforeEach(() => {
            delete (window as any).location;
            window.location = { href: '', origin: 'https://indii.music', pathname: '/marketplace' } as any;
        });

        afterEach(() => {
            window.location = originalLocation as any;
        });

        it('never trusts a client-supplied price — calls the server-authoritative checkout function and redirects', async () => {
            mockCallable.mockResolvedValueOnce({
                data: { checkoutUrl: 'https://checkout.stripe.com/session-1', sessionId: 'cs_1' }
            });

            await MarketplaceService.purchaseProduct('prod-1', 'direct');

            // ISSUE-977 fix: the client never sends a price/amount at all — the
            // Cloud Function loads it from Firestore.
            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'createMarketplaceCheckout');
            expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({ productId: 'prod-1', source: 'direct' }));
            expect(mockCallable.mock.calls[0]![0]).not.toHaveProperty('amount');
            expect(mockCallable.mock.calls[0]![0]).not.toHaveProperty('price');
            expect(window.location.href).toBe('https://checkout.stripe.com/session-1');
        });

        it('throws and does not redirect when no checkout URL is returned', async () => {
            mockCallable.mockResolvedValueOnce({ data: { checkoutUrl: '', sessionId: '' } });

            await expect(MarketplaceService.purchaseProduct('prod-1')).rejects.toThrow();
            expect(window.location.href).toBe('');
        });
    });

    describe('hasCompletedPurchase', () => {
        it('returns true only when a completed purchase record exists for that buyer+product', async () => {
            mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{}] });
            await expect(MarketplaceService.hasCompletedPurchase('buyer-1', 'prod-1')).resolves.toBe(true);
            expect(mockWhere).toHaveBeenCalledWith('buyerId', '==', 'buyer-1');
            expect(mockWhere).toHaveBeenCalledWith('productId', '==', 'prod-1');
            expect(mockWhere).toHaveBeenCalledWith('status', '==', 'completed');
        });

        it('returns false when no matching purchase exists', async () => {
            mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
            await expect(MarketplaceService.hasCompletedPurchase('buyer-1', 'prod-1')).resolves.toBe(false);
        });
    });
});
