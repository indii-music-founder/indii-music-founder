import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SocialDashboard from './SocialDashboard';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    }),
}));

vi.mock('../../creative/components/BrandAssetsDrawer', () => ({
    default: ({ onClose, onSelect }: any) => (
        <div data-testid="brand-assets-drawer">
            <button onClick={onClose}>Close Drawer</button>
            <button onClick={() => onSelect && onSelect({ url: 'test.jpg', name: 'Test Asset' })}>
                Select Asset
            </button>
        </div>
    ),
}));

// Mock store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

describe('SocialDashboard', () => {
    it('renders the dashboard header', () => {
        render(<SocialDashboard />);
        expect(screen.getByText('Social Media')).toBeInTheDocument();
        expect(screen.getByText('Manage your social presence and campaigns.')).toBeInTheDocument();
    });

    it('opens the Create Post modal when button is clicked', () => {
        render(<SocialDashboard />);
        const createButton = screen.getByText('Create Post');
        fireEvent.click(createButton);
        expect(screen.getByText('Create New Post')).toBeInTheDocument();
    });

    it('opens the Add Account wizard when button is clicked', () => {
        render(<SocialDashboard />);
        const addAccountButton = screen.getByText('Add Account');
        fireEvent.click(addAccountButton);
        expect(screen.getByText('1. Choose Platform')).toBeInTheDocument();
    });

    it('displays stats', () => {
        render(<SocialDashboard />);
        expect(screen.getByText('Total Reach')).toBeInTheDocument();
        expect(screen.getByText('Engagement Rate')).toBeInTheDocument();
        expect(screen.getByText('Active Campaigns')).toBeInTheDocument();
    });
});
