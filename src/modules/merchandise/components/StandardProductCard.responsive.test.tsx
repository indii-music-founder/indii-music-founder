
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandardProductCard } from './StandardProductCard';
import { MerchProduct } from '../types';

// Mock dependencies
// (No external dependencies to mock for this dumb component)

describe('📱 Viewport: StandardProductCard Responsiveness', () => {
    const mockProduct: MerchProduct = {
        id: '1',
        userId: 'user1',
        title: 'Phone Case',
        image: 'https://example.com/image.jpg',
        price: '$29.99',
        category: 'standard',
        tags: ['Accessory', 'Limited Edition', 'Drop 1', 'Very Long Tag That Might Overflow'],
        features: ['Durable', 'Yellow'],
    };

    beforeEach(() => {
        // Set Viewport to Mobile (iPhone SE: 375px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
    });

    it('renders the product title and price correctly on mobile', () => {
        render(<StandardProductCard product={mockProduct} />);

        const title = screen.getByText('Phone Case');
        const price = screen.getByText('$29.99');

        expect(title).toBeInTheDocument();
        expect(price).toBeInTheDocument();
    });

    it('ensures the "Add to Cart" button is accessible via focus on mobile', () => {
        // On desktop, this is hover-only. On mobile, we need to ensure it can be triggered.
        // The component uses 'group-focus-within:opacity-100' which allows tapping (focusing) the card to reveal it.

        render(<StandardProductCard product={mockProduct} />);

        const button = screen.getByText('ADD TO CART').closest('button');
        expect(button).toBeInTheDocument();

        // Initially hidden (opacity-0)
        // Note: checking opacity in JSDOM is tricky as styles aren't fully computed,
        // but we can check the class list logic.
        // However, we can simulate focus to verify the interaction pattern exists.

        const cardContainer = button?.closest('.group');
        expect(cardContainer).toBeInTheDocument();

        // Simulate tapping the card (which should focus inside if it has focusable elements)
        // Since the button is focusable, we tab to it or click it?
        // If the button is opacity-0, users can't see it to click it.
        // But if they tap the IMAGE (container), does it focus?
        // The image is not focusable by default.

        // Viewport Philosophy: "Fingers are clumsy; touch targets must be forgiving"
        // If I tap the card, I expect something to happen.

        // Let's verify that the button has the class that reveals it on focus.
        expect(button?.closest('div')).toHaveClass('group-focus-within:opacity-100');

        // Also verify the button itself moves up on focus within
        expect(button).toHaveClass('group-focus-within:translate-y-0');

        // Verify focus-visible classes for accessibility
        expect(button).toHaveClass('focus-visible:ring-2');
    });

    it('handles long tags without breaking layout', () => {
        render(<StandardProductCard product={mockProduct} />);

        const longTag = screen.getByText('Very Long Tag That Might Overflow');
        expect(longTag).toBeInTheDocument();

        // In a real browser, this would wrap. In JSDOM, we just ensure it renders.
        // We can check if the parent has flex-wrap which is crucial for mobile.
        const tagsContainer = longTag.parentElement;
        expect(tagsContainer).toHaveClass('flex-wrap');
    });

    it('images use lazy loading for performance on mobile data', () => {
        render(<StandardProductCard product={mockProduct} />);

        const img = screen.getByAltText('Phone Case');
        expect(img).toHaveAttribute('loading', 'lazy');
        expect(img).toHaveAttribute('decoding', 'async');
    });
});
