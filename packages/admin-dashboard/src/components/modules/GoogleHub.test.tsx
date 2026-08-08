import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GoogleHub } from './GoogleHub';

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe('GoogleHub', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows the connect prompt when the status check succeeds and Workspace is not linked', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ authorized: false }));
        render(<GoogleHub />);
        await waitFor(() => expect(screen.getByText('Google Workspace Not Linked')).toBeDefined());
    });

    it('never renders the connect prompt when the status check itself fails (ISSUE-1308 false-empty class)', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
        render(<GoogleHub />);
        await waitFor(() => expect(screen.getByText('Workspace link status unavailable')).toBeDefined());
        expect(screen.queryByText('Google Workspace Not Linked')).toBeNull();
    });

    it('treats a malformed status response as unknown rather than falsely unlinked', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
        render(<GoogleHub />);

        await waitFor(() => expect(screen.getByText('Workspace link status unavailable')).toBeDefined());
        expect(screen.getByText('Workspace status response was invalid')).toBeDefined();
        expect(screen.queryByText('Google Workspace Not Linked')).toBeNull();
    });

    it('shows the connected badge and fetches Gmail data when Workspace is linked', async () => {
        vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/google/status')) return Promise.resolve(jsonResponse({ authorized: true }));
            if (url.includes('/api/google/gmail/list')) {
                return Promise.resolve(jsonResponse({
                    messages: [{ id: 'e1', from: 'partner@label.com', subject: 'Contract renewal', snippet: '...', date: '2026-01-01T00:00:00Z', isAiDraft: false }],
                }));
            }
            return Promise.resolve(jsonResponse({}));
        });
        render(<GoogleHub />);
        await waitFor(() => expect(screen.getByText('Workspace Connected')).toBeDefined());
        await waitFor(() => expect(screen.getByText('Contract renewal')).toBeDefined());
    });

    it('returns to the link prompt when Workspace authorization disappears before a data read', async () => {
        vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/google/status')) return Promise.resolve(jsonResponse({ authorized: true }));
            if (url.includes('/api/google/gmail/list')) return Promise.resolve(jsonResponse({}, 412));
            return Promise.resolve(jsonResponse({}));
        });
        render(<GoogleHub />);

        await waitFor(() => expect(screen.getByText('Google Workspace Not Linked')).toBeDefined());
        expect(screen.queryByText('No messages found')).toBeNull();
    });

    it('shows an API error instead of a false-empty inbox for a malformed list response', async () => {
        vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/google/status')) return Promise.resolve(jsonResponse({ authorized: true }));
            if (url.includes('/api/google/gmail/list')) return Promise.resolve(jsonResponse({ messages: {} }));
            return Promise.resolve(jsonResponse({}));
        });
        render(<GoogleHub />);

        await waitFor(() => expect(screen.getByText('Gmail response was invalid')).toBeDefined());
        expect(screen.queryByText('No messages found')).toBeNull();
    });
});
