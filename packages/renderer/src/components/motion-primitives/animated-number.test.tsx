import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedNumber } from './animated-number';

const reducedMotion = vi.hoisted(() => vi.fn(() => false));
vi.mock('motion/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('motion/react')>()),
    useReducedMotion: reducedMotion,
}));

describe('AnimatedNumber', () => {
    beforeEach(() => reducedMotion.mockReturnValue(false));

    it('announces the final value while hiding the animated frames', () => {
        const { rerender } = render(<AnimatedNumber value={12.34} precision={1} />);
        expect(screen.getByText('12.3')).toHaveClass('sr-only');
        expect(screen.getByText('12.3').nextElementSibling).toHaveAttribute('aria-hidden', 'true');
        rerender(<AnimatedNumber value={20.56} precision={1} />);
        expect(screen.getByText('20.6')).toHaveClass('sr-only');
    });

    it('shows a stable value without animation when reduced motion is requested', () => {
        reducedMotion.mockReturnValue(true);
        render(<AnimatedNumber value={24.5} precision={1} />);
        expect(screen.getByText('24.5')).not.toHaveClass('sr-only');
    });

    it.each([Number.NaN, Infinity, -Infinity])('shows an unavailable value for nonfinite input (%s)', value => {
        render(<AnimatedNumber value={value} />);
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('clamps invalid precision instead of throwing', () => {
        reducedMotion.mockReturnValue(true);
        const { rerender } = render(<AnimatedNumber value={1.23456789} precision={100} />);
        expect(screen.getByText('1.234568')).toBeInTheDocument();
        rerender(<AnimatedNumber value={1.23456789} precision={Number.NaN} />);
        expect(screen.getByText('1')).toBeInTheDocument();
    });
});
