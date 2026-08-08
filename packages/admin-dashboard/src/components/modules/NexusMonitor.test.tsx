import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NexusMonitor } from './NexusMonitor';

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe('NexusMonitor', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows the real "verified" health badge only when every DNS record actually reads verified', async () => {
        vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/dns/status')) {
                return Promise.resolve(jsonResponse({ domain: 'indii.music', spf: 'verified', dkim: 'verified', dmarc: 'verified' }));
            }
            return Promise.resolve(jsonResponse({ logs: [] }));
        });
        render(<NexusMonitor />);
        await waitFor(() => expect(screen.getByText(/All records verified/)).toBeDefined());
    });

    it('never claims a nominal/verified state when a record is unverified (ISSUE-1308)', async () => {
        vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/dns/status')) {
                return Promise.resolve(jsonResponse({ domain: 'indii.music', spf: 'verified', dkim: 'unverified', dmarc: 'unverified' }));
            }
            return Promise.resolve(jsonResponse({ logs: [] }));
        });
        render(<NexusMonitor />);
        await waitFor(() => expect(screen.getByText(/Records unverified/)).toBeDefined());
        expect(screen.queryByText(/All records verified/)).toBeNull();
    });

    it('shows a status-unavailable badge on a backend failure, not a false-good state', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
        render(<NexusMonitor />);
        await waitFor(() => expect(screen.getByText(/Status unavailable/)).toBeDefined());
    });

    it('renders real event log entries when present', async () => {
        vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/dns/status')) {
                return Promise.resolve(jsonResponse({ domain: 'indii.music', spf: 'verified', dkim: 'verified', dmarc: 'verified' }));
            }
            return Promise.resolve(jsonResponse({ logs: [{ time: '10:00', msg: 'MX record propagated', status: 'Success' }] }));
        });
        render(<NexusMonitor />);
        await waitFor(() => expect(screen.getByText('MX record propagated')).toBeDefined());
    });
});
