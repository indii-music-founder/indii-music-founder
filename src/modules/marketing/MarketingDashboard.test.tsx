import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MarketingDashboard from './MarketingDashboard';

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() })
}));

vi.mock('@/modules/marketing/hooks/useMarketing', () => ({
    useMarketing: vi.fn(() => ({
        campaigns: [],
        activeCampaigns: 0,
        isLoading: false,
        error: null,
        actions: { createCampaign: vi.fn(), refreshDashboard: vi.fn() }
    }))
}));

// Mock child components that rely on context or complex logic to simplify integration test
vi.mock('./components/CampaignManager', () => ({
    default: () => <div data-testid="campaign-manager">Campaign Manager Content</div>
}));

describe('MarketingDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the dashboard layout', () => {
        render(<MarketingDashboard />);
        // Sidebar header
        expect(screen.getByText('Marketing')).toBeInTheDocument();
        // Toolbar action
        expect(screen.getByText('New Campaign')).toBeInTheDocument();
        // Main content (via mock)
        expect(screen.getByTestId('campaign-manager')).toBeInTheDocument();
    });
});
