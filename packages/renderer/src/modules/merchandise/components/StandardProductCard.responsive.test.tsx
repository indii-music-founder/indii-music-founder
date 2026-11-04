
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { StandardProductCard } from './StandardProductCard';
import { MerchProduct } from '../types';

// Mock dependencies
// (No external dependencies to mock for this dumb component)

describe('📱 Viewport: StandardProductCard Responsiveness', () => {
    const mockProduct: MerchProduct = {
        id: '1',
        userId: 'user1',
        title: 'Kill Phone Case',
        image: 'https://example.com/image.jpg',
        price: '$29.99',
        category: 'standard',
        tags: ['Accessory', 'Limited Edition', 'Drop 1', 'Very Long Tag That Might Overflow'],
        features: ['Durable', 'Quality'],
    };

    beforeEach(() => {
        // Set Viewport to Mobile (iPhone SE: 375px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
    });

    it('renders the product title and price correctly on mobile', () => {
        render(<StandardProductCard product={mockProduct} />);

        const title = screen.getByText('Kill Phone Case');
        const price = screen.getByText('$29.99');

        expect(title).toBeInTheDocument();
        expect(price).toBeInTheDocument();
    });

    it('does not render the removed "Add to Cart" dead affordance (ISSUE-621+)', () => {
        render(<StandardProductCard product={mockProduct} />);

        expect(screen.queryByText('ADD TO CART')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles long tags without breaking layout', () => {
        render(<StandardProductCard product={mockProduct} />);

        const longTag = screen.getByText('Very Long Tag That Might Overflow');
        expect(longTag).toBeInTheDocument();

        const tagsContainer = longTag.parentElement;
        expect(tagsContainer).toHaveClass('flex-wrap');
    });

    it('images use lazy loading for performance on mobile data', () => {
        render(<StandardProductCard product={mockProduct} />);

        const img = screen.getByAltText('Kill Phone Case');
        expect(img).toHaveAttribute('loading', 'lazy');
        expect(img).toHaveAttribute('decoding', 'async');
    });

    it('updates visible badges and reviews when a snapshot reuses the tags array', () => {
        const { rerender, container } = render(<StandardProductCard product={mockProduct} />);
        expect(screen.queryByText('Best Seller')).not.toBeInTheDocument();

        rerender(<StandardProductCard product={{
            ...mockProduct,
            isBestSeller: true,
            reviewCount: 12,
            rating: 2,
        }} />);

        expect(screen.getByText('Best Seller')).toBeInTheDocument();
        expect(screen.getByText('(12 reviews)')).toBeInTheDocument();
        expect(container.querySelectorAll('svg.fill-primary')).toHaveLength(2);

        rerender(<StandardProductCard product={{
            ...mockProduct,
            isBestSeller: false,
            reviewCount: 3,
            rating: 4,
        }} />);

        expect(screen.queryByText('Best Seller')).not.toBeInTheDocument();
        expect(screen.getByText('(3 reviews)')).toBeInTheDocument();
        expect(container.querySelectorAll('svg.fill-primary')).toHaveLength(4);
    });
});
