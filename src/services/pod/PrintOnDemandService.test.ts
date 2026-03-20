/**
 * PrintOnDemandService Tests
 *
 * Validates the InternalProvider fallback and PrintOnDemandServiceClass
 * orchestration layer (product catalog, pricing, orders, provider selection).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'test-user-123' } },
}));

const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    doc: vi.fn((_collection: unknown, ...rest: string[]) => ({ path: rest.join('/') })),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

// We import after mocks are set
import {
    type PODProduct,
    type PODOrderItem,
    type PODShippingAddress,
    type PODOrder,
} from './PrintOnDemandService';

// We need to import the service class dynamically to pick up mocks
let PrintOnDemandService: typeof import('./PrintOnDemandService').PrintOnDemandService;

describe('PrintOnDemandService', () => {
    const testAddress: PODShippingAddress = {
        name: 'Test Artist',
        address1: '123 Music Lane',
        city: 'Nashville',
        stateCode: 'TN',
        countryCode: 'US',
        postalCode: '37201',
        email: 'artist@test.com',
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        // Re-import to get fresh instance
        const module = await import('./PrintOnDemandService');
        PrintOnDemandService = module.PrintOnDemandService;
    });

    describe('Internal Provider — Product Catalog', () => {
        it('should return 3 internal products', async () => {
            const products = await PrintOnDemandService.getProducts();

            expect(products.length).toBe(3);
            expect(products.map(p => p.type)).toContain('T-Shirt');
            expect(products.map(p => p.type)).toContain('Hoodie');
            expect(products.map(p => p.type)).toContain('Vinyl Record');
        });

        it('should find a product by ID', async () => {
            const product = await PrintOnDemandService.getProduct('internal-tshirt');

            expect(product).not.toBeNull();
            expect(product!.name).toBe('Premium T-Shirt');
            expect(product!.variants.length).toBeGreaterThan(0);
        });

        it('should return null for unknown product ID', async () => {
            const product = await PrintOnDemandService.getProduct('nonexistent-999');

            expect(product).toBeNull();
        });

        it('should search products by name', async () => {
            const results = await PrintOnDemandService.searchProducts('vinyl');

            expect(results.length).toBe(1);
            expect(results[0]!.type).toBe('Vinyl Record');
        });

        it('should filter search by product type', async () => {
            const results = await PrintOnDemandService.searchProducts('', 'Hoodie');

            // All hoodies contain "" (empty query matches all)
            expect(results.length).toBe(1);
            expect(results[0]!.type).toBe('Hoodie');
        });
    });

    describe('Internal Provider — Pricing', () => {
        it('should calculate correct pricing for order items', async () => {
            const items: PODOrderItem[] = [
                {
                    productId: 'internal-tshirt',
                    variantId: 'm-black',
                    quantity: 2,
                    designUrl: 'https://example.com/design.png',
                    printArea: 'front',
                },
            ];

            const pricing = await PrintOnDemandService.calculatePrice(items);

            // Medium Black T-Shirt is $12.50 × 2 = $25.00
            expect(pricing.subtotal).toBe(25.0);
            expect(pricing.breakdown).toHaveLength(1);
            expect(pricing.breakdown[0]!.price).toBe(25.0);
        });

        it('should calculate multi-item pricing', async () => {
            const items: PODOrderItem[] = [
                {
                    productId: 'internal-tshirt',
                    variantId: 's-black',
                    quantity: 1,
                    designUrl: 'https://example.com/design.png',
                    printArea: 'front',
                },
                {
                    productId: 'internal-hoodie',
                    variantId: 'm-black',
                    quantity: 1,
                    designUrl: 'https://example.com/hoodie-design.png',
                    printArea: 'front',
                },
            ];

            const pricing = await PrintOnDemandService.calculatePrice(items);

            // T-Shirt $12.50 + Hoodie $24.00 = $36.50
            expect(pricing.subtotal).toBe(36.5);
            expect(pricing.breakdown).toHaveLength(2);
        });
    });

    describe('Internal Provider — Shipping Rates', () => {
        it('should return 3 shipping options', async () => {
            const rates = await PrintOnDemandService.getShippingRates(testAddress, []);

            expect(rates).toHaveLength(3);
            expect(rates.map(r => r.id)).toEqual(['standard', 'express', 'overnight']);
            // Standard should be cheapest
            expect(rates[0]!.rate).toBeLessThan(rates[2]!.rate);
        });
    });

    describe('Internal Provider — Order Management', () => {
        it('should create an order with correct totals', async () => {
            mockSetDoc.mockResolvedValue(undefined);

            const items: PODOrderItem[] = [
                {
                    productId: 'internal-tshirt',
                    variantId: 'm-black',
                    quantity: 1,
                    designUrl: 'https://example.com/design.png',
                    printArea: 'front',
                },
            ];

            const order = await PrintOnDemandService.createOrder(items, testAddress);

            expect(order).toBeDefined();
            expect(order.id).toMatch(/^INT-/);
            expect(order.provider).toBe('internal');
            expect(order.status).toBe('pending');
            expect(order.subtotal).toBe(12.5);
            expect(order.total).toBe(order.subtotal + order.shippingCost);
            expect(order.items).toHaveLength(1);
            expect(order.shippingAddress.name).toBe('Test Artist');
        });

        it('should persist order to Firestore', async () => {
            mockSetDoc.mockResolvedValue(undefined);

            const items: PODOrderItem[] = [
                {
                    productId: 'internal-hoodie',
                    variantId: 's-black',
                    quantity: 1,
                    designUrl: 'https://example.com/design.png',
                    printArea: 'front',
                },
            ];

            await PrintOnDemandService.createOrder(items, testAddress);

            expect(mockSetDoc).toHaveBeenCalled();
        });

        it('should cancel a pending order', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'pending' } as Partial<PODOrder>),
            });
            mockUpdateDoc.mockResolvedValue(undefined);

            const result = await PrintOnDemandService.cancelOrder('INT-TEST123');

            expect(result).toBe(true);
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ status: 'cancelled' })
            );
        });

        it('should NOT cancel a shipped order', async () => {
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'shipped' } as Partial<PODOrder>),
            });

            const result = await PrintOnDemandService.cancelOrder('INT-SHIPPED');

            expect(result).toBe(false);
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        it('should return false for nonexistent order cancellation', async () => {
            mockGetDoc.mockResolvedValue({ exists: () => false });

            const result = await PrintOnDemandService.cancelOrder('INT-GHOST');

            expect(result).toBe(false);
        });
    });

    describe('Provider Orchestration', () => {
        it('should list available providers', () => {
            const providers = PrintOnDemandService.getAvailableProviders();

            expect(providers).toContain('internal');
        });

        it('should report internal as not configured (demo)', () => {
            expect(PrintOnDemandService.isConfigured('internal')).toBe(false);
        });

        it('should fallback to internal for unknown provider', () => {
            const provider = PrintOnDemandService.getProvider('gooten' as any);
            // Should not throw, should return internal
            expect(provider).toBeDefined();
        });
    });
});
