import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
