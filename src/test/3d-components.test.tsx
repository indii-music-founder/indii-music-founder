import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThreeDCard, ThreeDCardContainer, ThreeDCardBody, ThreeDCardItem } from '../components/ui/ThreeDCard';
import { ThreeDButton } from '../components/ui/ThreeDButton';

describe('3D Components', () => {
    it('renders ThreeDCard without crashing', () => {
        render(
            <ThreeDCard>
                <div>Test Content</div>
            </ThreeDCard>
        );
    });

    it('renders ThreeDCardContainer/Body/Item without crashing', () => {
        render(
            <ThreeDCardContainer>
                <ThreeDCardBody>
                    <ThreeDCardItem>
                        <div>Test Item</div>
                    </ThreeDCardItem>
                </ThreeDCardBody>
            </ThreeDCardContainer>
        );
    });

    it('renders ThreeDButton without crashing', () => {
        render(
            <ThreeDButton>
                Click Me
            </ThreeDButton>
        );
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeDefined();
    });

    it('ThreeDButton handles loading state', () => {
        render(
            <ThreeDButton isLoading>
                Processing
            </ThreeDButton>
        );
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button.getAttribute('aria-disabled')).toBe('true');
        // Check for loader by looking for a generic container or SVG if accessible name isn't on the loader itself
        // But our implementation puts children next to loader.
    });

    it('ThreeDButton has accessible focus styles', () => {
        const { container } = render(
            <ThreeDButton>
                Focus Me
            </ThreeDButton>
        );
        const button = container.querySelector('button');
        // Verify the class string contains the focus-visible classes
        expect(button?.className).toContain('focus-visible:ring-2');
        expect(button?.className).toContain('focus-visible:outline-none');
    });

    it('ThreeDCard is accessible when onClick is provided', () => {
        const handleClick = vi.fn();
        render(
            <ThreeDCard onClick={handleClick}>
                Interactive Card
            </ThreeDCard>
        );

        // Should rely on role="button"
        // If this fails, it means the element doesn't have role="button"
        const card = screen.getByRole('button', { name: /interactive card/i });
        expect(card).toBeDefined();
        expect(card.getAttribute('tabindex')).toBe('0');

        // Test keyboard interaction
        fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
        expect(handleClick).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(card, { key: ' ', code: 'Space' });
        expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('ThreeDCardContainer is accessible when onClick is provided', () => {
        const handleClick = vi.fn();
        render(
            <ThreeDCardContainer onClick={handleClick}>
                <ThreeDCardBody>
                    <div>Interactive Container</div>
                </ThreeDCardBody>
            </ThreeDCardContainer>
        );

        // Should rely on role="button"
        const cardContainer = screen.getByRole('button', { name: /interactive container/i });
        expect(cardContainer).toBeDefined();
        expect(cardContainer.getAttribute('tabindex')).toBe('0');

        // Test keyboard interaction
        fireEvent.keyDown(cardContainer, { key: 'Enter', code: 'Enter' });
        expect(handleClick).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(cardContainer, { key: ' ', code: 'Space' });
        expect(handleClick).toHaveBeenCalledTimes(2);
    });
});
