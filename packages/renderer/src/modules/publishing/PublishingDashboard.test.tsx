import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublishingDashboard from './PublishingDashboard';
import { useReleases } from './hooks/useReleases';
import { useStore } from '@/core/store';

// Mock dependencies - Global
const mockDeleteRelease = vi.fn();
const mockArchiveRelease = vi.fn();
const mockToastPromise = vi.fn();
const mockSetModule = vi.fn();
const mockFetchDistributors = vi.fn();
const mockFetchEarnings = vi.fn();
const mockUseReleases = vi.fn();
const mockUseReleaseList = vi.fn();

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
    fetchEarnings: mockFetchEarnings,
    setModule: mockSetModule
};

import { useReleaseList } from './hooks/useReleaseList';
import { useState, useMemo } from 'react';

// Mock the store implementation directly here to ensure consistent behavior
vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => {
        if (selector && typeof selector === 'function') {
            return selector(mockStore);
        }
        return mockStore;
    })
}));

vi.mock('./hooks/useReleases', () => ({
    useReleases: (...args: any[]) => mockUseReleases(...args)
}));

vi.mock('./hooks/useReleaseList', () => ({
    useReleaseList: (...args: any[]) => mockUseReleaseList(...args)
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        promise: mockToastPromise,
        success: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('./components/ReleaseWizard', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="release-wizard">
            <button onClick={onClose}>Close</button>
        </div>
    )
}));

vi.mock('./components/PublishingSkeleton', () => ({
    PublishingSkeleton: () => <div data-testid="publishing-skeleton">Loading...</div>
}));

// Mock motion to avoid animation issues in tests
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, layout, layoutId, initial, animate, exit, transition, whileHover, whileTap, variants, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, layout, layoutId, initial, animate, exit, transition, whileHover, whileTap, variants, ...props }: any) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-virtuoso', () => ({
    VirtuosoGrid: ({ totalCount, itemContent }: any) => (
        <div data-testid="virtuoso-grid">
            {Array.from({ length: totalCount }).map((_, i) => (
                <div key={i}>{itemContent(i)}</div>
            ))}
        </div>
    ),
    TableVirtuoso: ({ data, itemContent, fixedHeaderContent }: any) => (
        <table data-testid="virtuoso-table">
            {fixedHeaderContent && <thead>{fixedHeaderContent()}</thead>}
            <tbody>
                {data.map((item: any, i: number) => (
                    <tr key={i}>{itemContent(i, item)}</tr>
                ))}
            </tbody>
        </table>
    ),
}));

describe('PublishingDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store mock implementation in case it was modified
        vi.mocked(useStore).mockImplementation(((selector: any) => {
            const state = { ...mockStore, setModule: mockSetModule };
            if (selector && typeof selector === 'function') {
                return selector(state);
            }
            return state;
        }) as any);

        mockUseReleases.mockReturnValue({
            releases: [],
            loading: false,
            error: null,
            hasPendingSync: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        });

        mockUseReleaseList.mockImplementation(() => ({
            releases: [],
            allReleases: [],
            loading: false,
            searchQuery: '',
            setSearchQuery: vi.fn(),
            statusFilter: 'all',
            setStatusFilter: vi.fn(),
            hasPendingSync: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        }));
    });

    it('renders the dashboard title and stats', () => {
        render(<PublishingDashboard />);

        expect(screen.getByText('Publishing')).toBeInTheDocument();
        // Check for stats (formatted currency)
        expect(screen.getAllByText('$123.45').length).toBeGreaterThan(0);
    });

    it('shows skeleton loading state', () => {
        mockUseReleases.mockReturnValue({
            releases: [],
            loading: true,
            deleteRelease: mockDeleteRelease,
            error: null,
            hasPendingSync: false,
            archiveRelease: mockArchiveRelease
        });

        render(<PublishingDashboard />);

        expect(screen.getByTestId('publishing-skeleton')).toBeInTheDocument();
        expect(screen.queryByText('Your Catalog')).not.toBeInTheDocument();
    });

    it('renders empty state when no releases exist', () => {
        mockUseReleases.mockReturnValue({
            releases: [],
            loading: false,
            deleteRelease: mockDeleteRelease,
            error: null,
            hasPendingSync: false,
            archiveRelease: mockArchiveRelease
        });

        render(<PublishingDashboard />);

        expect(screen.getByText('No Releases Found')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Create Release/i })).toBeInTheDocument();
    });

    it('renders release cards and handles bulk selection', async () => {
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
                metadata: { trackTitle: 'Berry', artistName: 'B', releaseType: 'Single' },
                assets: { coverArtUrl: null },
                status: 'draft',
                createdAt: new Date().toISOString()
            }
        ] as any[];

        mockUseReleases.mockReturnValue({
            releases: mockReleases,
            loading: false,
            error: null,
            hasPendingSync: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        });

        mockUseReleaseList.mockImplementation(() => ({
            releases: mockReleases,
            allReleases: mockReleases,
            loading: false,
            searchQuery: '',
            setSearchQuery: vi.fn(),
            statusFilter: 'all',
            setStatusFilter: vi.fn(),
            hasPendingSync: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        }));

        render(<PublishingDashboard />);

        // Verify releases are rendered
        expect(screen.getAllByText('Apple')[0]).toBeInTheDocument();
        expect(screen.getByText('Berry')).toBeInTheDocument();

        // Switch to list view and select items manually
        fireEvent.click(screen.getByLabelText('List view'));
        const checkboxes = screen.getAllByRole('checkbox');
        // Select first two items (index 0 is header checkbox)
        fireEvent.click(checkboxes[1]!);
        fireEvent.click(checkboxes[2]!);

        // Verify Bulk Action Bar appears
        expect(screen.getByText(/2 items? selected/i)).toBeInTheDocument();

        // Verify Delete/Archive present
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Archive/i })).toBeInTheDocument();
    });

    it('handles search and filtering correctly', () => {
        const mockReleases = [
            { id: '1', metadata: { trackTitle: 'Apple', artistName: 'A', releaseType: 'Single' }, status: 'live', assets: {} },
            { id: '2', metadata: { trackTitle: 'Berry', artistName: 'B', releaseType: 'Single' }, status: 'draft', assets: {} }
        ] as any[];

        mockUseReleases.mockReturnValue({
            releases: mockReleases,
            loading: false,
            deleteRelease: mockDeleteRelease,
            error: null,
            hasPendingSync: false,
            archiveRelease: mockArchiveRelease
        });

        mockUseReleaseList.mockImplementation(() => {
            const [searchQuery, setSearchQuery] = useState('');
            const [statusFilter, setStatusFilter] = useState('all');
            const filtered = mockReleases.filter(release => {
                const matchesSearch =
                    release.metadata.trackTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    release.metadata.artistName?.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter = statusFilter === 'all' || release.status === statusFilter;
                return matchesSearch && matchesFilter;
            });
            return {
                releases: filtered,
                allReleases: mockReleases,
                loading: false,
                searchQuery,
                setSearchQuery,
                statusFilter,
                setStatusFilter,
                hasPendingSync: false,
                deleteRelease: mockDeleteRelease,
                archiveRelease: mockArchiveRelease
            };
        });

        render(<PublishingDashboard />);

        // Search
        const searchInput = screen.getByPlaceholderText('publishing.hints.search_releases');
        fireEvent.change(searchInput, { target: { value: 'Apple' } });
        expect(screen.getAllByText('Apple')[0]).toBeInTheDocument();
        expect(screen.queryByText('Berry')).not.toBeInTheDocument();

        // Filter
        fireEvent.change(searchInput, { target: { value: '' } }); // Clear search
        const filterSelect = screen.getByRole('combobox');
        fireEvent.change(filterSelect, { target: { value: 'live' } });
        expect(screen.getAllByText('Apple')[0]).toBeInTheDocument();
        expect(screen.queryByText('Berry')).not.toBeInTheDocument();
    });

    it('executes bulk delete with toast promise', async () => {
        const mockReleases = [
            { id: '1', metadata: { trackTitle: 'Delete Me' }, status: 'draft', assets: {} }
        ] as any[];

        mockUseReleases.mockReturnValue({
            releases: mockReleases,
            loading: false,
            error: null,
            hasPendingSync: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        });

        mockUseReleaseList.mockImplementation(() => ({
            releases: mockReleases,
            allReleases: mockReleases,
            loading: false,
            searchQuery: '',
            setSearchQuery: vi.fn(),
            statusFilter: 'all',
            setStatusFilter: vi.fn(),
            hasPendingSync: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        }));

        render(<PublishingDashboard />);

        // Switch to list view and select items manually
        fireEvent.click(screen.getByLabelText('List view'));
        const checkboxes = screen.getAllByRole('checkbox');
        // Select item (index 0 is header)
        fireEvent.click(checkboxes[1]!);

        // Find delete button in floating bar
        const deleteBtn = screen.getByRole('button', { name: /Delete/i });
        await act(async () => {
            fireEvent.click(deleteBtn);
        });

        // Click confirm in the bulk action modal
        const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
        await act(async () => {
            fireEvent.click(confirmBtn);
        });

        await waitFor(() => {
            expect(mockToastPromise).toHaveBeenCalled();
            expect(mockDeleteRelease).toHaveBeenCalledWith('1');
        });
    });

    it('executes bulk archive with toast promise', async () => {
        const mockReleases = [
            { id: '1', metadata: { trackTitle: 'Test Track' }, status: 'live', assets: {} }
        ] as any[];

        mockUseReleases.mockReturnValue({
            releases: mockReleases,
            loading: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease,
            hasPendingSync: false,
            error: null
        });

        mockUseReleaseList.mockImplementation(() => ({
            releases: mockReleases,
            allReleases: mockReleases,
            loading: false,
            searchQuery: '',
            setSearchQuery: vi.fn(),
            statusFilter: 'all',
            setStatusFilter: vi.fn(),
            hasPendingSync: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        }));

        render(<PublishingDashboard />);

        // Switch to list view and select items manually
        fireEvent.click(screen.getByLabelText('List view'));
        const checkboxes = screen.getAllByRole('checkbox');
        // Select item (index 0 is header)
        fireEvent.click(checkboxes[1]!);

        // Find archive button
        const archiveBtn = screen.getByRole('button', { name: /Archive/i });
        await act(async () => {
            fireEvent.click(archiveBtn);
        });

        // Click confirm in the bulk action modal
        const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
        await act(async () => {
            fireEvent.click(confirmBtn);
        });

        await waitFor(() => {
            expect(mockToastPromise).toHaveBeenCalled();
            expect(mockArchiveRelease).toHaveBeenCalledWith('1');
        });
    });

    it('navigates to distribution module via Manage Distributors', () => {
        mockUseReleases.mockReturnValue({
            releases: [],
            loading: false,
            deleteRelease: mockDeleteRelease,
            error: null,
            hasPendingSync: false,
            archiveRelease: mockArchiveRelease
        });

        render(<PublishingDashboard />);

        const manageBtn = screen.getByText('Manage Connections');
        fireEvent.click(manageBtn);

        expect(mockSetModule).toHaveBeenCalledWith('distribution');
    });
});
