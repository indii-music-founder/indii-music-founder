import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Progress } from './progress';

describe('Progress value contract', () => {
    it('keeps ARIA range values consistent with the rendered progress when attributes are forwarded', () => {
        const { rerender } = render(
            <Progress aria-label="Upload" value={50} max={200} aria-valuemin={10} aria-valuemax={100} aria-valuenow={90} />,
        );
        const progress = screen.getByRole('progressbar', { name: 'Upload' });
        expect(progress).toHaveAttribute('aria-valuemin', '0');
        expect(progress).toHaveAttribute('aria-valuemax', '200');
        expect(progress).toHaveAttribute('aria-valuenow', '50');

        rerender(<Progress aria-label="Upload" value={null} aria-valuenow={90} />);
        expect(progress).not.toHaveAttribute('aria-valuenow');
    });

    it('shows and announces the same fraction for a custom maximum', () => {
        render(<Progress aria-label="Upload" value={50} max={200} />);
        const progress = screen.getByRole('progressbar', { name: 'Upload' });
        expect(progress).toHaveAttribute('aria-valuenow', '50');
        expect(progress).toHaveAttribute('aria-valuemax', '200');
        expect(progress.firstElementChild).toHaveStyle({ transform: 'translateX(-75%)' });
    });

    it('clamps over-range values in both the visual and announced state', () => {
        render(<Progress aria-label="Upload" value={300} max={200} />);
        const progress = screen.getByRole('progressbar', { name: 'Upload' });
        expect(progress).toHaveAttribute('aria-valuenow', '200');
        expect(progress.firstElementChild).toHaveStyle({ transform: 'translateX(0%)' });
    });

    it('treats nonfinite values as indeterminate', () => {
        render(<Progress aria-label="Upload" value={Number.NaN} />);
        const progress = screen.getByRole('progressbar', { name: 'Upload' });
        expect(progress).not.toHaveAttribute('aria-valuenow');
        expect(progress.firstElementChild).toHaveStyle({ transform: 'translateX(-100%)' });
    });
});
