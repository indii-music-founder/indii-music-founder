import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CostEstimatorWidget, formatEstimatedRunCost } from '@/modules/dashboard/components/CustomDashboardWidgets';

describe('CostEstimatorWidget currency formatting', () => {
    it('formats standard costs to 2 decimal places so $1.60 does not read as $1.600', () => {
        expect(formatEstimatedRunCost(1.6)).toBe('$1.60');
        expect(formatEstimatedRunCost(0)).toBe('$0.00');
        expect(formatEstimatedRunCost(12.5)).toBe('$12.50');
    });

    it('preserves 4 decimal places for tiny sub-cent runs', () => {
        expect(formatEstimatedRunCost(0.0042)).toBe('$0.0042');
    });

    it('renders formatted currency inside CostEstimatorWidget', () => {
        render(<CostEstimatorWidget />);

        const costValue = screen.getByTestId('cost-estimator-value');
        expect(costValue.textContent).not.toMatch(/\.\d{3}$/);

        // Switch to Image mode to verify live recalculation stays cleanly formatted
        fireEvent.click(screen.getByRole('button', { name: 'Image' }));
        expect(costValue.textContent).toMatch(/^\$\d+\.\d{2,4}$/);
    });
});
