import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InstagramOAuthCallback } from './InstagramOAuthCallback';

const service = vi.hoisted(() => ({
    beginCallback: vi.fn(),
    finalizePageSelection: vi.fn(),
}));

vi.mock('@/services/analytics/InstagramAnalyticsService', () => ({
    instagramAnalyticsService: service,
}));

function renderCallback(url = '/auth/instagram/callback?code=oauth-code&state=csrf-state') {
    return render(
        <MemoryRouter initialEntries={[url]}>
            <Routes>
                <Route path="/auth/instagram/callback" element={<InstagramOAuthCallback />} />
                <Route path="/analytics" element={<p>Analytics destination</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('InstagramOAuthCallback', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows server-provided Page choices and finalizes the selected opaque intent', async () => {
        service.beginCallback.mockResolvedValue({
            kind: 'page_selection_required',
            intentId: 'intent_123',
            pages: [
                { facebookPageId: 'page-1', facebookPageName: 'indii', instagramBusinessAccountId: 'ig-1', instagramUsername: 'indii_music' },
                { facebookPageId: 'page-2', facebookPageName: 'other', instagramBusinessAccountId: 'ig-2' },
            ],
        });
        service.finalizePageSelection.mockResolvedValue(undefined);

        renderCallback();

        expect(await screen.findByText('Available Pages')).toBeInTheDocument();
        expect(service.beginCallback).toHaveBeenCalledWith('oauth-code', 'csrf-state');
        fireEvent.click(screen.getByRole('radio', { name: /other/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Connect selected account' }));
        expect(await screen.findByText('Analytics destination')).toBeInTheDocument();
        expect(service.finalizePageSelection).toHaveBeenCalledWith('intent_123', 'page-2');
    });

    it('renders an explicit error for an incomplete provider callback', async () => {
        renderCallback('/auth/instagram/callback?state=csrf-state');
        expect(await screen.findByRole('alert')).toHaveTextContent('complete authorization response');
        expect(service.beginCallback).not.toHaveBeenCalled();
    });
});
