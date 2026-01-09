import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import Dashboard from './Dashboard';

// Mock child components
vi.mock('@/components/studio/ModeSelector', () => ({
    default: ({ mode, onChange }: any) => (
        <div data-testid="mode-selector">
            <button onClick={() => onChange('agent')}>Agent Mode</button>
            <button onClick={() => onChange('studio')}>Studio Mode</button>
        </div>
    ),
}));

vi.mock('./components/AgentWorkspace', () => ({
    default: () => <div data-testid="agent-workspace">Agent Workspace</div>,
}));

vi.mock('./components/DepartmentGrid', () => ({
    default: () => <div data-testid="department-grid">Department Grid</div>,
}));

vi.mock('./components/ReferenceImageManager', () => ({
    default: () => <div data-testid="reference-image-manager">Reference Image Manager</div>,
}));

vi.mock('./components/AnalyticsView', () => ({
    default: () => <div data-testid="analytics-view">Analytics View</div>,
}));

vi.mock('./components/TripStarter', () => ({
    default: () => <div data-testid="trip-starter">Trip Starter</div>,
}));

describe('Dashboard', () => {
    it('defaults to Studio Mode', () => {
        render(<Dashboard />);
        expect(screen.getByText('STUDIO HQ')).toBeInTheDocument();
        expect(screen.getByTestId('department-grid')).toBeInTheDocument();
        // Agent workspace should not be visible
        expect(screen.queryByTestId('agent-workspace')).not.toBeInTheDocument();
    });

    it('switches to Agent Mode', async () => {
        render(<Dashboard />);

        // Find the button in our mock ModeSelector
        fireEvent.click(screen.getByText('Agent Mode'));

        expect(screen.getByTestId('agent-workspace')).toBeInTheDocument();
        expect(screen.queryByTestId('department-grid')).not.toBeInTheDocument();
    });
});
