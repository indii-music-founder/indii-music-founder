import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReleaseEarnings } from '@/services/revenue/schema';
import { EarningsTable } from './EarningsTable';

const rows: ReleaseEarnings[] = Array.from({ length: 3 }, (_, index) => ({
    releaseId: `release-${index}`,
    releaseName: `Release ${index}`,
    isrc: `USAAA260000${index}`,
    streams: index,
    downloads: index,
    revenue: index,
}));

describe('EarningsTable', () => {
    it('shows available releases after the data shrinks below the current page', () => {
        const { rerender } = render(<EarningsTable data={rows} pageSize={1} />);
        const next = screen.getByRole('button', { name: 'Next earnings page' });

        fireEvent.click(next);
        fireEvent.click(next);
        expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
        expect(screen.getByText('Release 2')).toBeInTheDocument();

        rerender(<EarningsTable data={rows.slice(0, 2)} pageSize={1} />);
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
        expect(screen.getByText('Release 1')).toBeInTheDocument();
        expect(next).toBeDisabled();
    });

    it('uses a valid page size when a caller passes zero', () => {
        render(<EarningsTable data={rows} pageSize={0} />);
        expect(screen.getByText('Release 0')).toBeInTheDocument();
        expect(screen.getByText('Release 2')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Next earnings page' })).not.toBeInTheDocument();
    });
});
