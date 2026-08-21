import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AccessLog } from './AccessLog';

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe('AccessLog', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows an honest empty state, never a fabricated trail, when nobody has signed in', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ entries: [] }));
        render(<AccessLog />);
        await waitFor(() => expect(screen.getByText('No access recorded yet.')).toBeDefined());
        expect(screen.getByText(/log fills automatically/i)).toBeDefined();
    });

    it('renders the real recorded identities with their entry time and IP', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({
            entries: [
                { id: 'log-2', email: 'wiil@indii.music', ip: '127.0.0.1', at: '2026-08-21T21:00:00.000Z', userAgent: 'Mozilla/5.0' },
                { id: 'log-1', email: 'staff@indii.music', ip: '10.0.0.2' },
            ],
        }));
        render(<AccessLog />);

        await waitFor(() => expect(screen.getByText('wiil@indii.music')).toBeDefined());
        expect(screen.getByText('staff@indii.music')).toBeDefined();
        expect(screen.getByText('127.0.0.1')).toBeDefined();
        expect(screen.getByText('10.0.0.2')).toBeDefined();
        // Missing timestamps degrade honestly instead of inventing a date.
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('reports a backend failure instead of pretending the trail is empty', async () => {
        vi.mocked(fetch).mockRejectedValue(new Error('Access log returned 500'));
        render(<AccessLog />);
        await waitFor(() => expect(screen.getByText('Could not load the access log')).toBeDefined());
    });
});
