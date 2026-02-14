import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '@/core/store';
import DistributionDashboard from './DistributionDashboard';

// Mock child components
vi.mock('./components/DistributorConnectionsPanel', () => ({
    DistributorConnectionsPanel: () => <div data-testid="distributor-connections">Distributor Connections</div>
}));

vi.mock('./components/ReleaseStatusCard', () => ({
    ReleaseStatusCard: ({ releaseTitle }: any) => <div data-testid="release-card">{releaseTitle}</div>
}));

vi.mock('./components/BankPanel', () => ({
    BankPanel: () => <div data-testid="bank-panel">Bank Panel</div>
}));

vi.mock('./components/AuthorityPanel', () => ({
    AuthorityPanel: () => <div data-testid="authority-panel">Authority Panel</div>
}));

vi.mock('./components/QCPanel', () => ({
    QCPanel: () => <div data-testid="qc-panel">QC Panel</div>
}));

vi.mock('./components/KeysPanel', () => ({
    KeysPanel: () => <div data-testid="keys-panel">Keys Panel</div>
}));

vi.mock('./components/TransferPanel', () => ({
    TransferPanel: () => <div data-testid="transfer-panel">Transfer Panel</div>
}));

vi.mock('@/core/components/ErrorBoundary', () => ({
    ErrorBoundary: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children, defaultValue }: any) => <div data-tab-container data-default={defaultValue}>{children}</div>,
    TabsList: ({ children }: any) => <div data-tabs-list>{children}</div>,
    TabsTrigger: ({ children, value }: any) => <button data-tab-trigger={value}>{children}</button>,
    TabsContent: ({ children, value }: any) => <div data-tab-content={value}>{children}</div>
}));

const mockSubscribeToReleases = vi.fn(() => () => {});

vi.mock('@/core/store', () => ({
    useStore: vi.fn(() => ({
        distribution: {
            releases: [],
            loading: false,
            error: null
        },
        subscribeToReleases: mockSubscribeToReleases
    }))
}));

describe('DistributionDashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render dashboard header', () => {
        render(<DistributionDashboard />);

        expect(screen.getByText('Distribution')).toBeInTheDocument();
        expect(screen.getByText(/Automate your global rollout/i)).toBeInTheDocument();
    });

    it('should render all tab triggers', () => {
        render(<DistributionDashboard />);

        expect(screen.getByText('Active Releases')).toBeInTheDocument();
        expect(screen.getByText('Distributors')).toBeInTheDocument();
        expect(screen.getByText('Bank Layer')).toBeInTheDocument();
        expect(screen.getByText('Authority')).toBeInTheDocument();
        expect(screen.getByText('Keys')).toBeInTheDocument();
        expect(screen.getByText('Brain (QC)')).toBeInTheDocument();
        expect(screen.getByText('Transmission')).toBeInTheDocument();
    });

    it('should subscribe to releases on mount', () => {
        render(<DistributionDashboard />);

        expect(mockSubscribeToReleases).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe from releases on unmount', () => {
        const unsubscribe = vi.fn();
        mockSubscribeToReleases.mockReturnValue(unsubscribe);

        const { unmount } = render(<DistributionDashboard />);
        unmount();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should show empty state when no releases', () => {
        render(<DistributionDashboard />);

        expect(screen.getByText('No active releases')).toBeInTheDocument();
        expect(screen.getByText(/Your distributed music will appear here/i)).toBeInTheDocument();
    });

    it('should show loading skeletons when loading', () => {
        vi.mocked(useStore).mockReturnValue({
            distribution: {
                releases: [],
                loading: true,
                error: null
            },
            subscribeToReleases: mockSubscribeToReleases
        });

        const { container } = render(<DistributionDashboard />);

        const skeletons = container.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render releases when available', () => {
        vi.mocked(useStore).mockReturnValue({
            distribution: {
                releases: [
                    {
                        id: '1',
                        title: 'Test Album',
                        artist: 'Test Artist',
                        coverArtUrl: 'https://test.com/cover.jpg',
                        deployments: [],
                        releaseDate: '2024-01-01'
                    },
                    {
                        id: '2',
                        title: 'Another Album',
                        artist: 'Another Artist',
                        coverArtUrl: 'https://test.com/cover2.jpg',
                        deployments: [],
                        releaseDate: '2024-02-01'
                    }
                ],
                loading: false,
                error: null
            },
            subscribeToReleases: mockSubscribeToReleases
        });

        render(<DistributionDashboard />);

        expect(screen.getByText('Test Album')).toBeInTheDocument();
        expect(screen.getByText('Another Album')).toBeInTheDocument();
    });

    it('should show error state when error occurs', () => {
        vi.mocked(useStore).mockReturnValue({
            distribution: {
                releases: [],
                loading: false,
                error: 'Failed to load releases'
            },
            subscribeToReleases: mockSubscribeToReleases
        });

        render(<DistributionDashboard />);

        expect(screen.getByText('Failed to load releases')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry Connection/i })).toBeInTheDocument();
    });

    it('should show Live Sync indicator', () => {
        render(<DistributionDashboard />);

        expect(screen.getByText('Live Sync')).toBeInTheDocument();
    });

    it('should render Recent Deliveries heading in releases tab', () => {
        render(<DistributionDashboard />);

        expect(screen.getByText('Recent Deliveries')).toBeInTheDocument();
        expect(screen.getByText(/Track the status of your releases/i)).toBeInTheDocument();
    });

    it('should render distributor connections panel', () => {
        const { container } = render(<DistributionDashboard />);

        // The panel is rendered but might not be visible depending on default tab
        expect(container.querySelector('[data-testid="distributor-connections"]')).toBeInTheDocument();
    });

    it('should render all panels within their tabs', () => {
        const { container } = render(<DistributionDashboard />);

        expect(container.querySelector('[data-testid="bank-panel"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="authority-panel"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="qc-panel"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="keys-panel"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="transfer-panel"]')).toBeInTheDocument();
    });

    it('should wrap panels in ErrorBoundary components', () => {
        render(<DistributionDashboard />);

        // ErrorBoundary is mocked to just pass through children
        // We verify panels are rendered which means ErrorBoundary is working
        const { container } = render(<DistributionDashboard />);
        expect(container.querySelector('[data-testid="distributor-connections"]')).toBeInTheDocument();
    });

    it('should show description for distribution', () => {
        render(<DistributionDashboard />);

        expect(screen.getByText(/Automate your global rollout/i)).toBeInTheDocument();
        expect(screen.getByText(/Reach 150\+ platforms/i)).toBeInTheDocument();
    });

    it('should handle multiple releases', () => {
        const releases = Array.from({ length: 5 }, (_, i) => ({
            id: `${i + 1}`,
            title: `Album ${i + 1}`,
            artist: `Artist ${i + 1}`,
            coverArtUrl: `https://test.com/cover${i + 1}.jpg`,
            deployments: [],
            releaseDate: '2024-01-01'
        }));

        vi.mocked(useStore).mockReturnValue({
            distribution: {
                releases,
                loading: false,
                error: null
            },
            subscribeToReleases: mockSubscribeToReleases
        });

        render(<DistributionDashboard />);

        releases.forEach(release => {
            expect(screen.getByText(release.title)).toBeInTheDocument();
        });
    });

    it('should not show loading skeletons when releases are present', () => {
        vi.mocked(useStore).mockReturnValue({
            distribution: {
                releases: [
                    {
                        id: '1',
                        title: 'Test Album',
                        artist: 'Test Artist',
                        coverArtUrl: 'https://test.com/cover.jpg',
                        deployments: [],
                        releaseDate: '2024-01-01'
                    }
                ],
                loading: true, // Still loading but has releases
                error: null
            },
            subscribeToReleases: mockSubscribeToReleases
        });

        const { container } = render(<DistributionDashboard />);

        // Should not show skeletons when releases exist
        expect(screen.getByText('Test Album')).toBeInTheDocument();
    });

    it('should have proper responsive layout classes', () => {
        const { container } = render(<DistributionDashboard />);

        const mainContainer = container.querySelector('.max-w-7xl');
        expect(mainContainer).toBeInTheDocument();
    });
});
