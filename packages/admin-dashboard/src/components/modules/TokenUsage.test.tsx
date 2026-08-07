import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TokenUsage } from './TokenUsage';

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

describe('TokenUsage', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('shows an admin-auth-required panel on 401/403, not a false empty state', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 403));
        render(<TokenUsage />);
        await waitFor(() => expect(screen.getByText(/Admin authentication required/)).toBeDefined());
    });

    it('shows an honest empty state when there is genuinely no usage in the window', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({
            start: '2026-01-01', end: '2026-01-30', totalCostUsd: 0, totalTokens: 0, totalRequests: 0,
            activeUsers: 0, averageCostPerUserUsd: 0, byModel: [], byUser: [],
        }));
        render(<TokenUsage />);
        await waitFor(() => expect(screen.getByText(/No AI usage recorded yet/)).toBeDefined());
    });

    it('renders the real aggregated spend from the API response', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({
            start: '2026-01-01', end: '2026-01-30', totalCostUsd: 12.5, totalTokens: 50000, totalRequests: 10,
            activeUsers: 2, averageCostPerUserUsd: 6.25,
            byModel: [{ model: 'gemini-2.5-pro', inputTokens: 30000, outputTokens: 20000, requestCount: 10, costUsd: 12.5 }],
            byUser: [{ userId: 'user-a', tokensUsed: 50000, requestCount: 10, costUsd: 12.5 }],
        }));
        render(<TokenUsage />);
        await waitFor(() => expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0));
        expect(screen.getByText('gemini-2.5-pro')).toBeDefined();
    });

    it('shows an error card on server failure', async () => {
        vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
        render(<TokenUsage />);
        await waitFor(() => expect(screen.getByText(/Couldn't load usage data/)).toBeDefined());
    });
});
