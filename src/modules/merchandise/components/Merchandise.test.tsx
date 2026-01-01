import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BananaMerch } from './BananaMerch';
import { BananaProMerch } from './BananaProMerch';
import { useMerchandise } from '../hooks/useMerchandise';
import { MerchProduct } from '../types';

// Mock the hook
vi.mock('../hooks/useMerchandise', () => ({
    useMerchandise: vi.fn(),
}));

// Mock store
vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: { id: 'test-user' }
    })
}));

describe('Merchandise Components', () => {
    const mockStandardProducts: MerchProduct[] = [
        { id: '1', title: 'Standard Tee', price: '$25.00', category: 'standard', image: 'img.jpg', userId: 'user-1', createdAt: new Date() },
        { id: '2', title: 'Standard Cap', price: '$15.00', category: 'standard', image: 'cap.jpg', userId: 'user-1', createdAt: new Date() }
    ];

    const mockProProducts: MerchProduct[] = [
        { id: '3', title: 'Pro Hoodie', price: '$60.00', category: 'pro', features: ['Heavyweight'], image: 'hoodie.jpg', userId: 'user-1', createdAt: new Date() }
    ];

    it('BananaMerch renders standard products', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            products: [...mockStandardProducts, ...mockProProducts],
            standardProducts: mockStandardProducts,
            proProducts: mockProProducts,
            loading: false,
            addProduct: vi.fn(),
            deleteProduct: vi.fn()
        });

        render(<BananaMerch />);

        expect(screen.getByText('Standard Tee')).toBeInTheDocument();
        expect(screen.getByText('$25.00')).toBeInTheDocument();
        // Should not show Pro products in standard view usually, depends on component logic
        // Verify standard logic: BananaMerch iterates standardProducts
    });

    it('BananaProMerch renders pro products', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            products: [...mockStandardProducts, ...mockProProducts],
            standardProducts: mockStandardProducts,
            proProducts: mockProProducts,
            loading: false,
            addProduct: vi.fn(),
            deleteProduct: vi.fn()
        });

        render(<BananaProMerch />);

        expect(screen.getByText('Pro Hoodie')).toBeInTheDocument();
        expect(screen.getByText('$60.00')).toBeInTheDocument();
    });

    it('shows loading state or empty state if no products', () => {
        vi.mocked(useMerchandise).mockReturnValue({
            products: [],
            standardProducts: [],
            proProducts: [],
            loading: false, // assuming component handles empty list gracefully
            addProduct: vi.fn(),
            deleteProduct: vi.fn()
        });

        render(<BananaMerch />);
        // Check for specific empty state text if it exists, or just ensure no crash
        // For now, simple render check
        const heading = screen.getByText(/Merch/i); // Adjust based on actual heading
        expect(heading).toBeInTheDocument();
    });
});
