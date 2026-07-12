import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarketingAssetGeneratorUI from './MarketingAssetGeneratorUI';

/**
 * ISSUE-954: reel mode is text-to-video only — GenAI.generateVideo never
 * receives or conditions on audio. The upload step must not offer/imply
 * audio synchronization in that mode.
 */
describe('MarketingAssetGeneratorUI (ISSUE-954)', () => {
    it('reel mode (default) never offers an audio upload or implies synchronization', () => {
        render(<MarketingAssetGeneratorUI />);

        expect(screen.queryByText('Click or drag to upload audio')).not.toBeInTheDocument();
        expect(screen.queryByText(/WAV, MP3, or FLAC/i)).not.toBeInTheDocument();
        expect(screen.getByText(/generates video from your text prompt only/i)).toBeInTheDocument();
    });
});
