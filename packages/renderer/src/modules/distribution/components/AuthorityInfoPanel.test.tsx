import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionTier } from '@/services/subscription/SubscriptionTier';
import { AuthorityInfoPanel } from './AuthorityInfoPanel';

const { refresh, useSubscription } = vi.hoisted(() => ({
    refresh: vi.fn(),
    useSubscription: vi.fn(),
}));

vi.mock('@/modules/finance/hooks/useSubscription', () => ({ useSubscription }));

describe('AuthorityInfoPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useSubscription.mockReturnValue({
            subscription: { tier: SubscriptionTier.FOUNDER },
            loading: false,
            error: null,
            refresh,
        });
    });

    it('shows authority derived from the authenticated subscription', () => {
        render(<AuthorityInfoPanel />);

        expect(screen.getByText('indii Founder')).toBeInTheDocument();
        expect(screen.getByText('Included')).toBeInTheDocument();
        expect(screen.getByText('Not tracked')).toBeInTheDocument();
        expect(screen.queryByText('Professional')).not.toBeInTheDocument();
        expect(screen.queryByText('2.4k / 10k')).not.toBeInTheDocument();
        expect(screen.queryByText('48 / Unlimited')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Sync account authority' }));
        expect(refresh).toHaveBeenCalledOnce();
    });

    it('fails closed when verified subscription data is unavailable', () => {
        useSubscription.mockReturnValue({
            subscription: null,
            loading: false,
            error: 'Billing service unavailable',
            refresh,
        });

        render(<AuthorityInfoPanel />);

        expect(screen.getByText(/No tier has been assumed/i)).toBeInTheDocument();
        expect(screen.getAllByText('Unavailable')).toHaveLength(2);
        expect(screen.queryByText('indii Free')).not.toBeInTheDocument();
    });

    it('labels fallback subscription data as an estimate', () => {
        useSubscription.mockReturnValue({
            subscription: { tier: SubscriptionTier.FREE, isFallback: true },
            loading: false,
            error: null,
            refresh,
        });

        render(<AuthorityInfoPanel />);

        expect(screen.getByText(/Estimated account defaults/i)).toBeInTheDocument();
        expect(screen.getByText('indii Free')).toBeInTheDocument();
    });
});
