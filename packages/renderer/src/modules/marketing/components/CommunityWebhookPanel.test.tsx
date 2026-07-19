import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CommunityWebhookPanel from './CommunityWebhookPanel';

const { mockShowToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}));

const DISCORD_URL = 'https://discord.com/api/webhooks/123456789/abcDEF-token';
const TELEGRAM_URL = 'https://api.telegram.org/bot123:ABC-token/sendMessage';

/**
 * ISSUE-946: Test/Send previously faked success via setTimeout with no
 * network call at all. These prove a real fetch() request is made and
 * that success/failure is reported from the actual response.
 */
describe('CommunityWebhookPanel (ISSUE-946)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it('rejects a malformed Discord webhook URL without ever calling fetch', async () => {
        render(<CommunityWebhookPanel />);

        const urlInput = screen.getByPlaceholderText('https://discord.com/api/webhooks/...');
        fireEvent.change(urlInput, { target: { value: 'https://not-a-real-webhook.example.com' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]!);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Not a valid Discord webhook URL'), 'error');
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('makes a real POST request and reports success only on a 2xx response', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 204, statusText: 'No Content' });

        render(<CommunityWebhookPanel />);
        const urlInput = screen.getByPlaceholderText('https://discord.com/api/webhooks/...');
        fireEvent.change(urlInput, { target: { value: DISCORD_URL } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]!);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Test message sent to Discord successfully'), 'success');
        });

        expect(fetch).toHaveBeenCalledWith(DISCORD_URL, expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"content"'),
        }));
        expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    });

    it('reports the real provider error on a non-2xx response and never claims success', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

        render(<CommunityWebhookPanel />);
        const urlInput = screen.getByPlaceholderText('https://discord.com/api/webhooks/...');
        fireEvent.change(urlInput, { target: { value: DISCORD_URL } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]!);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('401'), 'error');
        });
        expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
    });

    it('surfaces a network failure instead of crashing or claiming success', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));

        render(<CommunityWebhookPanel />);
        const urlInput = screen.getByPlaceholderText('https://discord.com/api/webhooks/...');
        fireEvent.change(urlInput, { target: { value: DISCORD_URL } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Test' })[0]!);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch'), 'error');
        });
    });

    it('requires a Telegram Chat ID and includes it in the real request body', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });

        render(<CommunityWebhookPanel />);

        // Enable Telegram
        const toggles = screen.getAllByRole('button').filter(b => b.querySelector('svg[data-testid="icon-ToggleLeft"], svg[data-testid="icon-ToggleRight"]'));
        // Telegram is the second platform card's enable toggle
        fireEvent.click(toggles[1]!);

        const urlInput = screen.getByPlaceholderText('https://api.telegram.org/bot.../sendMessage');
        fireEvent.change(urlInput, { target: { value: TELEGRAM_URL } });

        const chatIdInput = screen.getByPlaceholderText(/Chat ID/);
        fireEvent.change(chatIdInput, { target: { value: '-100123456789' } });

        const testButtons = screen.getAllByRole('button', { name: /^Test$/ });
        fireEvent.click(testButtons[1]!);

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(TELEGRAM_URL, expect.objectContaining({
                body: expect.stringContaining('"chat_id":"-100123456789"'),
            }));
        });
    });

    it('persists webhook config across a remount (survives refresh)', async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 204, statusText: 'No Content' });

        const { unmount } = render(<CommunityWebhookPanel />);
        const urlInput = screen.getByPlaceholderText('https://discord.com/api/webhooks/...');
        fireEvent.change(urlInput, { target: { value: DISCORD_URL } });

        await waitFor(() => {
            expect(localStorage.getItem('indii_community_webhook_config')).toContain(DISCORD_URL);
        });

        unmount();
        render(<CommunityWebhookPanel />);

        expect(screen.getByPlaceholderText('https://discord.com/api/webhooks/...')).toHaveValue(DISCORD_URL);
    });

    it('disables the Auto-Announce toggles rather than pretending they trigger real events', () => {
        render(<CommunityWebhookPanel />);
        expect(screen.getByText(/Not yet wired to release\/tour\/drop events/i)).toBeInTheDocument();

        const newReleaseRow = screen.getByText('New Release').closest('div');
        const toggleButton = newReleaseRow!.querySelector('button');
        expect(toggleButton).toBeDisabled();
    });
});
