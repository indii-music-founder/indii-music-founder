import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PreSaveCampaignBuilder from './PreSaveCampaignBuilder';

describe('PreSaveCampaignBuilder', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: vi.fn(),
            },
        });
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: vi.fn().mockResolvedValue(undefined),
        });
    });

    it('shares the campaign link when browser sharing is available', async () => {
        const shareSpy = navigator.share as unknown as ReturnType<typeof vi.fn>;

        render(<PreSaveCampaignBuilder />);

        fireEvent.click(screen.getByRole('button', { name: /^Share$/i }));

        await waitFor(() => {
            expect(shareSpy).toHaveBeenCalledWith({
                title: 'Pre-Save Campaign',
                text: 'Open this pre-save campaign page.',
                url: 'https://indii.vip/presave/your-track',
            });
        });
    });
});
