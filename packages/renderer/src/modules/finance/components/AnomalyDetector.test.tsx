import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnomalyDetector } from './AnomalyDetector';

describe('AnomalyDetector without a verified stream source', () => {
    it('shows that monitoring is unavailable without implying the account was checked', () => {
        render(<AnomalyDetector />);

        expect(screen.getByText('Daily Streaming Data Unavailable')).toBeInTheDocument();
        expect(screen.getByText(/anomaly monitoring is unavailable here/i)).toBeInTheDocument();
        expect(screen.queryByText('No active alerts')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Investigate' })).not.toBeInTheDocument();
    });
});
