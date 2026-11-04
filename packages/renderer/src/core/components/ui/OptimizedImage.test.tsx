import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OptimizedImage } from './OptimizedImage';

describe('OptimizedImage', () => {
    it('loads a fallback, then retries a changed primary source', () => {
        const onLoad = vi.fn();
        const onError = vi.fn();
        const { rerender } = render(
            <OptimizedImage src="first.jpg" fallback="fallback.jpg" alt="Merch art" onLoad={onLoad} onError={onError} />
        );
        const image = screen.getByRole('img', { name: 'Merch art' });

        fireEvent.error(image);
        expect(onError).toHaveBeenCalledOnce();
        expect(image).toHaveAttribute('src', 'fallback.jpg');
        expect(image).toHaveClass('opacity-0');

        fireEvent.load(image);
        expect(onLoad).toHaveBeenCalledOnce();
        expect(image).toHaveClass('opacity-100');

        rerender(<OptimizedImage src="second.jpg" fallback="fallback.jpg" alt="Merch art" onLoad={onLoad} onError={onError} />);
        const nextImage = screen.getByRole('img', { name: 'Merch art' });
        expect(nextImage).toHaveAttribute('src', 'second.jpg');
        expect(nextImage).toHaveClass('opacity-0');
        fireEvent.load(nextImage);
        expect(nextImage).toHaveClass('opacity-100');
        expect(onLoad).toHaveBeenCalledTimes(2);
    });

    it('ends loading if both the primary image and fallback fail', () => {
        render(<OptimizedImage src="missing.jpg" fallback="also-missing.jpg" alt="Missing art" />);
        const image = screen.getByRole('img', { name: 'Missing art' });

        fireEvent.error(image);
        expect(image).toHaveAttribute('src', 'also-missing.jpg');
        fireEvent.error(image);
        expect(image).toHaveClass('opacity-100');
    });
});
