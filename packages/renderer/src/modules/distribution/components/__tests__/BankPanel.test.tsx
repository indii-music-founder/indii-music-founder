import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BankPanel } from '../BankPanel';
import { distributionService } from '@/services/distribution/DistributionService';

/**
 * ISSUE-825: withholding_rate is a PERCENT value from the Python tax engine
 * (e.g. 30.0 means 30%), but the UI treated it as a 0-1 fraction — displaying
 * 3000%, subtracting 30x the gross amount, and showing a negative net.
 */

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: {
        calculateWithholding: vi.fn(),
        executeWaterfall: vi.fn(),
    },
}));

describe('BankPanel — tax withholding percent/fraction handling', () => {
    it('displays 30.0%, subtracts $300, and nets $700 for $1,000 at a 30% rate', async () => {
        vi.mocked(distributionService.calculateWithholding).mockResolvedValue({
            form_type: 'W-8BEN',
            country: 'US',
            tin_masked: '***1234',
            tin_valid: true,
            certified: true,
            payout_status: 'ACTIVE',
            cert_timestamp: new Date().toISOString(),
            withholding_rate: 30.0, // 30%, not 0.30
        });

        render(<BankPanel />);

        fireEvent.click(screen.getByTestId('bank-verify-tax-compliance'));

        await waitFor(() => {
            expect(screen.getByTestId('bank-tax-withholding-rate')).toHaveTextContent('30.0%');
        });

        expect(screen.getByTestId('bank-tax-net-disbursable')).toHaveTextContent('$700');
        expect(screen.queryByText(/-\$-/)).not.toBeInTheDocument(); // never a negative levy/net
    });
});

/**
 * ISSUE-826: the waterfall request/report contract is locked to
 * execution/finance/waterfall_payout.py — request sends 'gross' (not
 * gross_revenue), report distributions are nested {split, amount} objects,
 * and "Total Dispersed" is total_distributed.
 */
describe('BankPanel — waterfall contract (ISSUE-826)', () => {
    it('sends {gross, splits} and renders the $1,000 / 50-30-20 Python-shaped report', async () => {
        vi.mocked(distributionService.executeWaterfall).mockResolvedValue({
            gross: 1000,
            platform_fee: { percent: '15.0%', amount: 150 },
            revenue_after_fee: 850,
            recoupment: { starting_balance: 0, applied: 0, remaining_balance: 0 },
            distributions: {
                artist_01: { split: '50.0%', amount: 425 },
                producer_01: { split: '30.0%', amount: 255 },
                label_hq: { split: '20.0%', amount: 170 },
            },
            summary_status: 'PROCESSED',
            total_distributed: 850,
            unallocated_balance: 0,
            processed_at: '2026-07-14T12:00:00+00:00',
        });

        render(<BankPanel />);

        // Component defaults: amount 1000, splits artist_01 50% / producer_01 30% / label_hq 20%
        fireEvent.click(screen.getByTestId('distro-subtab-waterfall'));
        fireEvent.click(screen.getByTestId('bank-launch-waterfall'));

        await waitFor(() => {
            expect(screen.getByText('$425')).toBeInTheDocument();
        });

        // Request side: 'gross', never 'gross_revenue'
        expect(distributionService.executeWaterfall).toHaveBeenCalledWith({
            gross: 1000,
            splits: { artist_01: 0.5, producer_01: 0.3, label_hq: 0.2 },
        });

        // Numeric party amounts (not [object Object] / NaN)
        expect(screen.getByText('$255')).toBeInTheDocument();
        expect(screen.getByText('$170')).toBeInTheDocument();
        // Per-party split strings from the engine
        expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
        // Total Dispersed = total_distributed, and fee line rendered
        expect(screen.getByText('$850')).toBeInTheDocument();
        expect(screen.getByText(/Platform Fee \(15\.0%\)/)).toBeInTheDocument();
        // Timestamp rendered from processed_at
        expect(screen.getByText(/Processed:/)).toBeInTheDocument();
    });
});
