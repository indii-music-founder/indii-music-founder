import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MarketingAssetGeneratorUI from './MarketingAssetGeneratorUI';

/**
 * ISSUE-954: reel mode is text-to-video only — GenAI.generateVideo never
 * receives or conditions on audio. The upload step must not offer/imply
 * audio synchronization in that mode.
 */
describe('MarketingAssetGeneratorUI (ISSUE-954)', () => {
    it('keeps additional styles collapsed and preserves the selected alternative when choosing one', async () => {
        render(<MarketingAssetGeneratorUI />);
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        const moreStyles = await screen.findByRole('button', { name: 'More styles' });
        expect(moreStyles).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', { name: /^Analog Film/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Cyberpunk/i })).not.toBeInTheDocument();

        fireEvent.click(moreStyles);
        fireEvent.click(screen.getByRole('button', { name: /^Analog Film/ }));

        expect(screen.getByRole('button', { name: /^Analog Film/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'More styles' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', { name: /^Documentary/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Cinematic Moody/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('reel mode (default) never offers an audio upload or implies synchronization', () => {
        render(<MarketingAssetGeneratorUI />);

        expect(screen.queryByText('Click or drag to upload audio')).not.toBeInTheDocument();
        expect(screen.queryByText(/WAV, MP3, or FLAC/i)).not.toBeInTheDocument();
        expect(screen.getByText(/generates video from your text prompt only/i)).toBeInTheDocument();
    });
});
