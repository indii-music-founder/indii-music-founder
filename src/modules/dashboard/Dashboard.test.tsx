import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import Dashboard from './Dashboard';

// Mock child components to isolate Dashboard testing
vi.mock('./components/ProjectHub', () => ({
    default: () => <div data-testid="project-hub">Project Hub</div>,
}));

vi.mock('./components/DataStorageManager', () => ({
    default: () => <div data-testid="data-storage-manager">Data Storage Manager</div>,
}));

vi.mock('./components/AnalyticsView', () => ({
    default: () => <div data-testid="analytics-view">Analytics View</div>,
}));

vi.mock('./components/GlobalSettings', () => ({
    default: () => <div data-testid="global-settings">Global Settings</div>,
}));

vi.mock('./components/ReferenceImageManager', () => ({
    default: () => <div data-testid="reference-image-manager">Reference Image Manager</div>,
}));

describe('Dashboard', () => {
    it('renders the dashboard header', () => {
        render(<Dashboard />);
        expect(screen.getByText('Studio Headquarters')).toBeInTheDocument();
        expect(screen.getByText('Manage your projects, data, and global configuration.')).toBeInTheDocument();
    });

    it('renders all child components', () => {
        render(<Dashboard />);
        expect(screen.getByTestId('project-hub')).toBeInTheDocument();
        expect(screen.getByTestId('data-storage-manager')).toBeInTheDocument();
        expect(screen.getByTestId('analytics-view')).toBeInTheDocument();
        expect(screen.getByTestId('global-settings')).toBeInTheDocument();
        expect(screen.getByTestId('reference-image-manager')).toBeInTheDocument();
    });
});
