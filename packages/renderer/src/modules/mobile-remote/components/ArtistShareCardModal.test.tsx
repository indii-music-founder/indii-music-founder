import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ArtistShareCardModal from './ArtistShareCardModal';

vi.mock('qrcode.react', () => ({
    QRCodeSVG: ({ value }: { value: string }) => <div data-testid="artist-share-qr" data-value={value} />,
}));

describe('ArtistShareCardModal', () => {
    it('dismisses on Escape key press and cleans up listener on unmount', () => {
        const onClose = vi.fn();
        const view = render(<ArtistShareCardModal name="Stage Artist" email="artist@example.com" onClose={onClose} />);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        view.unmount();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('dismisses on backdrop click but not when clicking inside the modal card', () => {
        const onClose = vi.fn();
        render(<ArtistShareCardModal name="Stage Artist" onClose={onClose} />);

        fireEvent.click(screen.getByText('Share My Card'));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('dialog', { name: 'Share my artist card' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('toggles account email on the generated vCard QR value', () => {
        render(<ArtistShareCardModal name="Stage Artist" email="artist@example.com" onClose={vi.fn()} />);

        expect(screen.getByTestId('artist-share-qr').getAttribute('data-value')).not.toContain('artist@example.com');
        fireEvent.click(screen.getByRole('checkbox', { name: /include my account email/i }));
        expect(screen.getByTestId('artist-share-qr').getAttribute('data-value')).toContain('artist@example.com');
    });
});
