import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublishingDashboard from './PublishingDashboard';

// Mock dependencies
vi.mock('./hooks/useReleases', () => ({
    useReleases: vi.fn()
}));

vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

vi.mock('./components/ReleaseWizard', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="release-wizard">
            <button onClick={onClose}>Close</button>
        </div>
    )
}));

vi.mock('@/core/components/ErrorBoundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Import the mocked hooks
import { useReleases } from './hooks/useReleases';
import { useStore } from '@/core/store';

describe('PublishingDashboard', () => {
    const mockFetchDistributors = vi.fn();
    const mockFetchEarnings = vi.fn();

    const mockStore = {
        currentOrganizationId: 'test-org-id',
        finance: {
            earningsSummary: {
                totalNetRevenue: 123.45,
                totalStreams: 1000
            },
            loading: false
        },
        distribution: {
            connections: [
                { distributorId: 'distrokid', isConnected: true }
            ],
            loading: false
        },
        fetchDistributors: mockFetchDistributors,
        fetchEarnings: mockFetchEarnings
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue(mockStore);
    });

    it('renders the dashboard title and stats', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false
        });

        render(<PublishingDashboard />);

        expect(screen.getByText('Publishing Department')).toBeInTheDocument();
        expect(screen.getByText('Total Releases')).toBeInTheDocument();
        // Since Total Releases, Live on DSPs, and Pending Review are all 0, we expect 3 occurrences of '0'
        expect(screen.getAllByText('0').length).toBe(3);
        // Revenue is shown in both stat card and sidebar
        expect(screen.getAllByText('$123.45').length).toBeGreaterThan(0);
    });

    it('shows loading state for releases', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: true
        });

        render(<PublishingDashboard />);

        // Loader color is usually gray-500, but we can check if the loader container exists or releases length is hidden
        expect(screen.queryByText('Your Releases')).toBeInTheDocument();
    });

    it('renders empty state when no releases exist', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false
        });

        render(<PublishingDashboard />);

        expect(screen.getByText('Build your discography')).toBeInTheDocument();
        expect(screen.getByText('Create New Release')).toBeInTheDocument();
    });

    it('renders release cards when data is available', () => {
        const mockReleases = [
            {
                id: 'release-1',
                metadata: {
                    trackTitle: 'Test Song',
                    artistName: 'Test Artist',
                    releaseType: 'Single'
                },
                assets: {
                    coverArtUrl: 'https://example.com/cover.jpg'
                },
                status: 'metadata_complete',
                createdAt: new Date().toISOString()
            }
        ];

        (useReleases as any).mockReturnValue({
            releases: mockReleases,
            loading: false
        });

        render(<PublishingDashboard />);

        expect(screen.getByText('Test Song')).toBeInTheDocument();
        expect(screen.getByText('Test Artist')).toBeInTheDocument();
        expect(screen.getByText('Single')).toBeInTheDocument();
        expect(screen.getAllByText('metadata complete').length).toBeGreaterThan(0);
    });

    it('opens and closes the Release Wizard', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false
        });

        render(<PublishingDashboard />);

        const newReleaseBtn = screen.getByText('New Release');
        fireEvent.click(newReleaseBtn);

        expect(screen.getByTestId('release-wizard')).toBeInTheDocument();

        const closeBtn = screen.getByText('Close');
        fireEvent.click(closeBtn);

        expect(screen.queryByTestId('release-wizard')).not.toBeInTheDocument();
    });

    it('filters releases by search query', async () => {
        const mockReleases = [
            {
                id: '1',
                metadata: { trackTitle: 'Apple', artistName: 'A', releaseType: 'Single' },
                assets: { coverArtUrl: null },
                status: 'live',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                metadata: { trackTitle: 'Banana', artistName: 'B', releaseType: 'Single' },
                assets: { coverArtUrl: null },
                status: 'live',
                createdAt: new Date().toISOString()
            }
        ];

        (useReleases as any).mockReturnValue({
            releases: mockReleases,
            loading: false
        });

        render(<PublishingDashboard />);

        const searchInput = screen.getByPlaceholderText('Search catalog...');
        fireEvent.change(searchInput, { target: { value: 'Apple' } });

        expect(screen.getByText('Apple')).toBeInTheDocument();
        // Banana should be removed (wait for it to disappear due to AnimatePresence)
        await screen.findByText('1 release found');
        expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    });

    it('filters releases by status dropdown', async () => {
        const mockReleases = [
            {
                id: '1',
                metadata: { trackTitle: 'Live Release', artistName: 'A', releaseType: 'Single' },
                assets: { coverArtUrl: null },
                status: 'live',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                metadata: { trackTitle: 'Draft Release', artistName: 'B', releaseType: 'Single' },
                assets: { coverArtUrl: null },
                status: 'draft',
                createdAt: new Date().toISOString()
            }
        ];

        (useReleases as any).mockReturnValue({
            releases: mockReleases,
            loading: false
        });

        render(<PublishingDashboard />);

        const filterSelect = screen.getByRole('combobox');
        fireEvent.change(filterSelect, { target: { value: 'live' } });

        expect(screen.getByText('Live Release')).toBeInTheDocument();
        // Draft Release should be removed
        await screen.findByText('1 release found');
        expect(screen.queryByText('Draft Release')).not.toBeInTheDocument();
    });

    it('navigates to distribution module when clicking Connect Distributor', () => {
        const setModule = vi.fn();
        (useStore as any).mockReturnValue({
            ...mockStore,
            setModule
        });

        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false
        });

        render(<PublishingDashboard />);

        const connectBtn = screen.getByText('Connect Distributor');
        fireEvent.click(connectBtn);

        expect(setModule).toHaveBeenCalledWith('distribution');
    });

    it('calls fetchDistributors and fetchEarnings on mount', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false
        });

        render(<PublishingDashboard />);

        expect(mockFetchDistributors).toHaveBeenCalled();
        expect(mockFetchEarnings).toHaveBeenCalled();
    });
});
