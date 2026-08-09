import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EarningsDashboard } from './EarningsDashboard';

vi.mock('../hooks/useEarnings', () => ({
    useEarnings: () => ({
        loading: false,
        earnings: {
            totalGrossRevenue: 100,
            totalNetRevenue: 80,
            totalStreams: 1_000,
            byPlatform: [],
            byTerritory: [],
            byRelease: [],
        },
    }),
}));

describe('publishing EarningsDashboard truth boundary', () => {
    it('leaves missing provider attribution unavailable instead of applying market-share estimates', () => {
        render(<EarningsDashboard />);

        expect(screen.getByText('No provider breakdown available')).toBeInTheDocument();
        expect(screen.queryByText(/\(Est\.\)/)).not.toBeInTheDocument();
        expect(screen.queryByText('Market Penetration')).not.toBeInTheDocument();
        expect(screen.getByText('Gross Minus Net')).toBeInTheDocument();
    });
});
