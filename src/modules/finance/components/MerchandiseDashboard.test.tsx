import React from 'react';
import { render, screen } from '@testing-library/react';
import { MerchandiseDashboard } from './MerchandiseDashboard';
import { describe, it, expect, vi } from 'vitest';

// Mock Recharts to avoid layout/JSDOM issues
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    AreaChart: ({ children }: any) => <svg>{children}</svg>,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    BarChart: ({ children }: any) => <svg>{children}</svg>,
    Bar: () => null,
    Cell: () => null,
}));

// Mock MerchTable
vi.mock('./MerchTable', () => ({
    MerchTable: ({ isDashboardView }: { isDashboardView: boolean }) => (
        <div data-testid="merch-table">
            Mocked Merch Table (Dashboard View: {String(isDashboardView)})
        </div>
    )
}));

describe('MerchandiseDashboard', () => {
    it('renders the dashboard header with correct revenue stats', () => {
        render(<MerchandiseDashboard />);

        expect(screen.getByText('Merchandise')).toBeInTheDocument();
        expect(screen.getByText('Sales')).toBeInTheDocument();
        expect(screen.getByText('$12,450.00')).toBeInTheDocument();
        expect(screen.getByText(/30D Growth/)).toBeInTheDocument();
    });

    it('renders the Sales analytics components', () => {
        render(<MerchandiseDashboard />);

        // These texts are inside MerchandiseAnalytics
        expect(screen.getByText('Revenue Velocity')).toBeInTheDocument();
        expect(screen.getByText('Active Cycle')).toBeInTheDocument();

        // Check for specific data points labels
        expect(screen.getByText('Volume over 4 week period')).toBeInTheDocument();
        expect(screen.getByText('Daily Conversion Performance')).toBeInTheDocument();
    });

    it('renders the MerchTable in dashboard view mode', () => {
        render(<MerchandiseDashboard />);
        const table = screen.getByTestId('merch-table');
        expect(table).toBeInTheDocument();
        expect(table).toHaveTextContent('Dashboard View: true');
    });
});
