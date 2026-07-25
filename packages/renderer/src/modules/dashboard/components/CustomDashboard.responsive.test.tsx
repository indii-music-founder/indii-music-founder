import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Activity } from 'lucide-react';
import { CustomDashboard } from './CustomDashboard';

vi.mock('./CustomDashboardWidgets', () => ({
    STORAGE_KEY: 'test_custom_dashboard_widgets',
    loadWidgets: () => [{ id: 'widget-1', type: 'activity', order: 0 }],
    WIDGET_DEFINITIONS: {
        activity: {
            label: 'Activity',
            icon: Activity,
            description: 'Operational activity',
        },
    },
    WIDGET_RENDERERS: {
        activity: () => <div>Activity widget</div>,
    },
}));

describe('CustomDashboard responsive layout', () => {
    it('uses its container width to reflow controls and widget columns', () => {
        render(<CustomDashboard />);

        expect(screen.getByTestId('custom-dashboard')).toHaveClass('@container');
        expect(screen.getByTestId('custom-dashboard-header')).toHaveClass(
            'flex-col',
            '@3xl:flex-row',
        );
        expect(screen.getByTestId('custom-dashboard-grid')).toHaveClass(
            'grid-cols-1',
            '@xl:grid-cols-2',
            '@5xl:grid-cols-3',
        );
        expect(screen.getByText('Activity widget')).toBeInTheDocument();
    });
});
