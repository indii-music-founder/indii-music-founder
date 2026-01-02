import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMerchandise } from './useMerchandise';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';

// Mock the services
vi.mock('@/services/merchandise/MerchandiseService', () => ({
    MerchandiseService: {
        getCatalog: vi.fn(),
        subscribeToProducts: vi.fn(),
        createFromCatalog: vi.fn(),
        addProduct: vi.fn(),
        deleteProduct: vi.fn(),
    }
}));

// Mock the store
const mockUseStore = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: () => mockUseStore()
}));

describe('useMerchandise', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseStore.mockReturnValue({ userProfile: { id: 'test-user-id' } });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should load catalog on mount', async () => {
        const mockCatalog = [{ id: '1', title: 'Test Product', category: 'standard', basePrice: 10, image: 'img.jpg' }];
        vi.mocked(MerchandiseService.getCatalog).mockResolvedValue(mockCatalog as any);
        vi.mocked(MerchandiseService.subscribeToProducts).mockReturnValue(() => {});

        const { result } = renderHook(() => useMerchandise());

        // Initially loading
        expect(result.current.loading).toBe(true);

        // Wait for catalog to load
        await waitFor(() => {
            expect(result.current.catalog).toEqual(mockCatalog);
        });
    });

    it('should subscribe to products when user is authenticated', async () => {
        vi.mocked(MerchandiseService.getCatalog).mockResolvedValue([]);

        const mockProducts = [{ id: 'p1', title: 'My Product', category: 'standard', userId: 'test-user-id', price: '$10', image: 'img.jpg' }];

        // Mock subscribe implementation
        vi.mocked(MerchandiseService.subscribeToProducts).mockImplementation((userId, callback) => {
            callback(mockProducts as any);
            return () => {};
        });

        const { result } = renderHook(() => useMerchandise());

        await waitFor(() => {
            expect(result.current.products).toEqual(mockProducts);
        });

        expect(MerchandiseService.subscribeToProducts).toHaveBeenCalledWith('test-user-id', expect.any(Function));
    });

    it('should handle catalog loading errors', async () => {
        const error = new Error('Failed to fetch');
        vi.mocked(MerchandiseService.getCatalog).mockRejectedValue(error);
        vi.mocked(MerchandiseService.subscribeToProducts).mockReturnValue(() => {});

        const { result } = renderHook(() => useMerchandise());

        await waitFor(() => {
            expect(result.current.error).toBe('Failed to fetch');
        });

        // Loading should eventually be false (assuming product subscription also finishes or isn't blocking)
        // In our implementation, loading is (isProductsLoading || isCatalogLoading).
        // Since we mocked subscribeToProducts to just return unsub, it might still think products are loading?
        // Let's ensure subscribeToProducts callback is called to clear product loading
        // Or checking that catalog is done is enough for this specific test regarding error state?
        // Actually, if products are loading, global loading is true. But error should be set.
    });

    it('should separate standard and pro products', async () => {
        vi.mocked(MerchandiseService.getCatalog).mockResolvedValue([]);

        const mockProducts = [
            { id: 'p1', category: 'standard', title: 'Std 1' },
            { id: 'p2', category: 'pro', title: 'Pro 1' },
            { id: 'p3', category: 'standard', title: 'Std 2' }
        ];

        vi.mocked(MerchandiseService.subscribeToProducts).mockImplementation((userId, callback) => {
            callback(mockProducts as any);
            return () => {};
        });

        const { result } = renderHook(() => useMerchandise());

        await waitFor(() => {
            expect(result.current.products).toHaveLength(3);
        });

        expect(result.current.standardProducts).toHaveLength(2);
        expect(result.current.proProducts).toHaveLength(1);
    });
});
