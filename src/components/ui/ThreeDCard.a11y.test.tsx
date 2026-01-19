import { render, screen } from '@testing-library/react';
import { ThreeDCard } from './ThreeDCard';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import React from 'react';
import userEvent from '@testing-library/user-event';

expect.extend(matchers);

describe('ThreeDCard Accessibility', () => {
    it('should be semantically correct when interactive', async () => {
        const { container } = render(
            <ThreeDCard onClick={() => {}} className="p-4">
                <span>Card Content</span>
            </ThreeDCard>
        );

        // It should be a button because onClick is present
        const button = screen.getByRole('button', { name: "Card Content" });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('tabIndex', '0');

        // Should have no violations (text content acts as label)
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should be accessible when onClick and aria-label are provided', async () => {
        const handleClick = vi.fn();
        const { container } = render(
            <ThreeDCard onClick={handleClick} aria-label="Interactive Card">
                <span>Card Content</span>
            </ThreeDCard>
        );

        // Axe check
        const results = await axe(container);
        expect(results).toHaveNoViolations();

        // Semantics check
        const card = screen.getByRole('button', { name: "Interactive Card" });
        expect(card).toBeInTheDocument();
        expect(card).toHaveAttribute('tabIndex', '0');

        // Keyboard interaction check
        const user = userEvent.setup();

        // Tab focus
        await user.tab();
        expect(card).toHaveFocus();

        // Enter key
        await user.keyboard('{Enter}');
        expect(handleClick).toHaveBeenCalledTimes(1);

        // Space key
        await user.keyboard(' ');
        expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should NOT be interactive when onClick is missing', async () => {
        const { container } = render(
            <ThreeDCard>
                <span>Static Content</span>
            </ThreeDCard>
        );

        const results = await axe(container);
        expect(results).toHaveNoViolations();

        // Should not be a button
        expect(screen.queryByRole('button')).not.toBeInTheDocument();

        // Should not be focusable
        const user = userEvent.setup();
        await user.tab();
        expect(document.body).toHaveFocus();
    });
});
