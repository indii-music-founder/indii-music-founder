import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
        user: { email: 'artist@example.com' },
    }),
}));

import InvestorPortal from './InvestorPortal';

describe('InvestorPortal', () => {
    it('does not grant access through a simulated biometric gesture', () => {
        render(<InvestorPortal />);

        expect(screen.getByRole('heading', { name: 'Investor portal unavailable' })).toBeInTheDocument();
        expect(screen.getByText(/artist@example\.com/)).toBeInTheDocument();
        expect(screen.queryByText(/biometric gate/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/node authorized/i)).not.toBeInTheDocument();
    });
});
