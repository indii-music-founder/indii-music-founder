import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EmailManager } from './EmailManager';

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe('EmailManager', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows an honest empty state when the inbox has no messages', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ messages: [] }));
        render(<EmailManager />);
        await waitFor(() => expect(screen.getByText(/No messages in queue/)).toBeDefined());
    });

    it('renders real inbox messages fetched from the API', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({
            messages: [
                { id: 'm1', from: 'artist@example.com', subject: 'Question about payout', snippet: 'Hi team...', date: '2026-01-01T00:00:00Z', isAiDraft: false },
            ],
        }));
        render(<EmailManager />);
        await waitFor(() => expect(screen.getByText('Question about payout')).toBeDefined());
    });

    it('surfaces an approve-draft failure inline via error state, never window.alert (ISSUE-1309)', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.mocked(fetch)
            .mockResolvedValueOnce(jsonResponse({
                messages: [{ id: 'draft-1', from: 'agent@indii.music', subject: 'Draft reply', snippet: 'Proposed response', date: '2026-01-01T00:00:00Z', isAiDraft: true, draftText: 'Proposed response' }],
            }))
            .mockResolvedValueOnce(jsonResponse({ error: 'Draft already dispatched' }, 409));

        render(<EmailManager />);
        await waitFor(() => expect(screen.getByText('AI Review Queue')).toBeDefined());
        fireEvent.click(screen.getByText('AI Review Queue'));

        await waitFor(() => expect(screen.getByText('Draft reply')).toBeDefined());
        fireEvent.click(screen.getByText('Quick Approve'));

        await waitFor(() => expect(screen.getByText('Draft already dispatched')).toBeDefined());
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it('renders the fixed alias table on the aliases tab', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({ messages: [] }));
        render(<EmailManager />);
        await waitFor(() => expect(screen.getByText(/No messages in queue/)).toBeDefined());

        fireEvent.click(screen.getByText('Email Aliases'));
        expect(screen.getByText('admin@indii.music')).toBeDefined();
    });
});
