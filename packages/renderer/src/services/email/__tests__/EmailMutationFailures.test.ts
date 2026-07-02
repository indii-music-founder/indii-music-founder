import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GmailProvider } from '../GmailProvider';
import { OutlookProvider } from '../OutlookProvider';

vi.stubGlobal('fetch', vi.fn());

describe('email mutation failures', () => {
    const gmailProvider = new GmailProvider();
    const outlookProvider = new OutlookProvider();

    beforeEach(() => {
        vi.mocked(fetch).mockReset();
    });

    it('throws a Gmail error when markAsRead fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
        );

        await expect(gmailProvider.markAsRead('gmail-token', 'gmail-message-1')).rejects.toThrow(
            'Gmail mark as read failed for message gmail-message-1: 403 - Forbidden'
        );
    });

    it('throws a Gmail error when toggleStar fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' })
        );

        await expect(gmailProvider.toggleStar('gmail-token', 'gmail-message-2', true)).rejects.toThrow(
            'Gmail toggle star failed for message gmail-message-2: 502 - Bad Gateway'
        );
    });

    it('throws a Gmail error when trashMessage fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Server Error', { status: 500, statusText: 'Server Error' })
        );

        await expect(gmailProvider.trashMessage('gmail-token', 'gmail-message-3')).rejects.toThrow(
            'Gmail trash message failed for message gmail-message-3: 500 - Server Error'
        );
    });

    it('throws an Outlook error when markAsRead fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
        );

        await expect(outlookProvider.markAsRead('outlook-token', 'outlook-message-1')).rejects.toThrow(
            'Outlook mark as read failed for message outlook-message-1: 401 - Unauthorized'
        );
    });

    it('throws an Outlook error when toggleStar fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
        );

        await expect(outlookProvider.toggleStar('outlook-token', 'outlook-message-2', false)).rejects.toThrow(
            'Outlook toggle star failed for message outlook-message-2: 403 - Forbidden'
        );
    });

    it('throws an Outlook error when trashMessage fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response('Conflict', { status: 409, statusText: 'Conflict' })
        );

        await expect(outlookProvider.trashMessage('outlook-token', 'outlook-message-3')).rejects.toThrow(
            'Outlook trash message failed for message outlook-message-3: 409 - Conflict'
        );
    });
});
