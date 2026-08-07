import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FoundersPortal } from './FoundersPortal';

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe('FoundersPortal', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows an admin-auth-required panel on 401, not a generic error', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 401));
        render(<FoundersPortal />);
        await waitFor(() => expect(screen.getByText(/Admin authentication required/)).toBeDefined());
    });

    it('shows an honest empty state with the real seat count when nobody has activated yet', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ maxSeats: 11, count: 0, founders: [] }));
        render(<FoundersPortal />);
        await waitFor(() => expect(screen.getByText(/No founders activated yet/)).toBeDefined());
        expect(screen.getByText('11')).toBeDefined(); // seats remaining
    });

    it('renders the real founders roster, not invented names', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({
            maxSeats: 11,
            count: 1,
            founders: [{ seat: 1, name: 'Real Founder', uid: 'uid-1', joinedAt: '2026-01-01', agreementVersion: 'v1' }],
        }));
        render(<FoundersPortal />);
        await waitFor(() => expect(screen.getByText('Real Founder')).toBeDefined());
        expect(screen.getByText('uid-1')).toBeDefined();
    });

    it('shows an error panel on a server failure', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
        render(<FoundersPortal />);
        await waitFor(() => expect(screen.getByText(/Couldn't load founders/)).toBeDefined());
    });
});
