import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DDEXTracker } from './DDEXTracker';

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe('DDEXTracker', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows an honest empty state, never a fabricated queue, when there are no deliveries', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ deliveries: [] }));
        render(<DDEXTracker />);
        await waitFor(() => expect(screen.getByText(/Queue is currently empty/)).toBeDefined());
        expect(screen.getByText('—')).toBeDefined(); // failure rate has nothing to divide by
    });

    it('derives every stat from the fetched queue instead of hardcoding them (ISSUE-1308)', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({
            deliveries: [
                { releaseId: 'r1', title: 'Track A', dst: 'Spotify', status: 'Delivered', time: '10:00', type: 'ERN 4.3' },
                { releaseId: 'r2', title: 'Track B', dst: 'Apple', status: 'Processing', type: 'ERN 4.3', time: '10:05' },
                { releaseId: 'r3', title: 'Track C', dst: 'Spotify', status: 'Failed', type: 'ERN 3.8.2', time: '10:10' },
            ],
        }));
        render(<DDEXTracker />);

        await waitFor(() => expect(screen.getByText('Track A')).toBeDefined());

        // 2 distinct destinations (Spotify, Apple)
        expect(screen.getByText('2')).toBeDefined();
        // One failed and one delivered item are complete. The processing item
        // must not dilute the terminal failure rate.
        expect(screen.getByText('50.00%')).toBeDefined();
        expect(screen.getByText('1 ERN format in flight')).toBeDefined();
        expect(screen.getByText('across 3 recent deliveries')).toBeDefined();
    });

    it('uses the Firestore document id when a delivery has no duplicated releaseId field', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({
            deliveries: [
                { id: 'delivery-doc-1', title: 'Canonical ID', dst: 'Spotify', status: 'Delivered', time: '10:00', type: 'ERN 4.3' },
            ],
        }));
        render(<DDEXTracker />);

        await waitFor(() => expect(screen.getByText('Canonical ID')).toBeDefined());
        expect(screen.getByText('delivery-doc-1')).toBeDefined();
    });

    it('shows an honest error state on a backend failure rather than an empty queue', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
        render(<DDEXTracker />);
        await waitFor(() => expect(screen.getByText(/Deliveries returned status 500/)).toBeDefined());
        expect(screen.queryByText(/Queue is currently empty/)).toBeNull();
    });
});
