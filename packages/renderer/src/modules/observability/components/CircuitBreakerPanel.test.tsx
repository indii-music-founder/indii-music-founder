import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { checkBudget } = vi.hoisted(() => ({ checkBudget: vi.fn() }));

vi.mock('@/services/MembershipService', () => ({
    MembershipService: { checkBudget },
}));
vi.mock('@/core/store', () => ({
    useStore: (selector: (s: { user: { uid: string } }) => unknown) => selector({ user: { uid: 'u1' } }),
}));

import { CircuitBreakerPanel } from '@/modules/observability/components/CircuitBreakerPanel';

describe('CircuitBreakerPanel', () => {
    beforeEach(() => checkBudget.mockReset());

    it('reports an unreachable budget service as unavailable, never healthy', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        checkBudget.mockRejectedValueOnce(new Error('offline'));
        render(<CircuitBreakerPanel />);

        await waitFor(() => expect(screen.getByText('Status Unavailable')).toBeInTheDocument());
        expect(screen.queryByText('Closed (Healthy)')).not.toBeInTheDocument();
        expect(warn).toHaveBeenCalled();
    });

    it('opens the breaker when the budget is exhausted', async () => {
        checkBudget.mockResolvedValue({ allowed: false, remainingBudget: 0, requiresApproval: false });
        render(<CircuitBreakerPanel />);

        await waitFor(() => expect(screen.getByText('Open (Blocked)')).toBeInTheDocument());
        expect(checkBudget).toHaveBeenCalledWith(0);
    });

    it('shows an unlimited budget as text rather than "Infinity"', async () => {
        checkBudget.mockResolvedValue({ allowed: true, remainingBudget: Infinity, requiresApproval: false });
        render(<CircuitBreakerPanel />);

        await waitFor(() => expect(screen.getByText('Unlimited')).toBeInTheDocument());
        expect(screen.getByText('Closed (Healthy)')).toBeInTheDocument();
    });
});
