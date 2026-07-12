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
