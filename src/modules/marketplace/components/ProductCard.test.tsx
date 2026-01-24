import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ProductCard from './ProductCard';
import { Product } from '@/services/marketplace/types';

// Mock dependencies
vi.mock('@/services/marketplace/MarketplaceService', () => ({
    MarketplaceService: {
        purchaseProduct: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => selector({
        userProfile: { id: 'test-user-id' }
    })),
}));

// Mock Lucide icons to avoid rendering issues in tests
vi.mock('lucide-react', () => ({
    ShoppingBag: () => <div data-testid="icon-shopping-bag" />,
    Loader2: () => <div data-testid="icon-loader" />,
    Check: () => <div data-testid="icon-check" />,
}));

describe('ProductCard', () => {
    const mockProduct: Product = {
        id: 'prod-123',
        sellerId: 'seller-123',
        title: 'Test Product',
        description: 'A great product',
        price: 1000,
        currency: 'USD',
        type: 'merch',
        images: ['test-image.jpg'],
        inventory: 10,
        createdAt: '2023-01-01',
        isActive: true,
    };

    it('renders correctly in default variant', () => {
        render(<ProductCard product={mockProduct} />);

        expect(screen.getByText('Test Product')).toBeInTheDocument();
        expect(screen.getByText('A great product')).toBeInTheDocument();
        expect(screen.getByText('USD 1000')).toBeInTheDocument();
        expect(screen.getByText('merch')).toBeInTheDocument();
        expect(screen.getByText('Purchase')).toBeInTheDocument();
    });

    it('renders correctly in embedded variant', () => {
        render(<ProductCard product={mockProduct} variant="embedded" />);

        expect(screen.getByText('Test Product')).toBeInTheDocument();
        // Embedded variant doesn't show description
        expect(screen.queryByText('A great product')).not.toBeInTheDocument();
        expect(screen.getByText('USD 1000')).toBeInTheDocument();
        expect(screen.getByText('Buy Now')).toBeInTheDocument();
    });

    it('handles out of stock state', () => {
        const outOfStockProduct = { ...mockProduct, inventory: 0 };
        render(<ProductCard product={outOfStockProduct} />);

        expect(screen.getByText('Sold Out')).toBeInTheDocument();
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
    });
});
