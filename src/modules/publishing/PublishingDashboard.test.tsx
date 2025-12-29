import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublishingDashboard from './PublishingDashboard';

// Mock dependencies
const mockDeleteRelease = vi.fn();
const mockArchiveRelease = vi.fn();
const mockToastPromise = vi.fn();

vi.mock('./hooks/useReleases', () => ({
    useReleases: vi.fn(() => ({
        releases: [],
        loading: false,
        deleteRelease: mockDeleteRelease,
        archiveRelease: mockArchiveRelease
    }))
}));

vi.mock('@/core/store', () => ({
    useStore: vi.fn()
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

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Import the mocked hooks
import { useReleases } from './hooks/useReleases';
import { useStore } from '@/core/store';

describe('PublishingDashboard', () => {
    const mockFetchDistributors = vi.fn();
    const mockFetchEarnings = vi.fn();
    const mockSetModule = vi.fn();

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

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock the granular selector pattern: useStore(state => state.foo)
        (useStore as any).mockImplementation((selector: any) => {
            if (selector) {
                return selector(mockStore);
            }
            return mockStore;
        });
    });

    it('renders the dashboard title and stats', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false,
            deleteRelease: mockDeleteRelease
        });

        render(<PublishingDashboard />);

        expect(screen.getByText('Publishing')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Total Releases')).toBeInTheDocument();
        // Check for stats values
        expect(screen.getAllByText('0').length).toBeGreaterThan(0);
        expect(screen.getAllByText('$123.45').length).toBeGreaterThan(0);
    });

    it('shows skeleton loading state', () => {
        (useReleases as any).mockImplementation(() => ({
            releases: [],
            loading: true,
            deleteRelease: mockDeleteRelease
        }));

        render(<PublishingDashboard />);

        expect(screen.getByTestId('publishing-skeleton')).toBeInTheDocument();
        expect(screen.queryByText('Your Catalog')).not.toBeInTheDocument();
    });

    it('renders empty state when no releases exist', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false,
            deleteRelease: mockDeleteRelease
        });

        render(<PublishingDashboard />);

        expect(screen.getByText('Build your discography')).toBeInTheDocument();
        expect(screen.getByText('Create First Release')).toBeInTheDocument();
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
                metadata: { trackTitle: 'Banana', artistName: 'B', releaseType: 'Single' },
                assets: { coverArtUrl: null },
                status: 'draft',
                createdAt: new Date().toISOString()
            }
        ];

        (useReleases as any).mockReturnValue({
            releases: mockReleases,
            loading: false,
            deleteRelease: mockDeleteRelease
        });

        render(<PublishingDashboard />);

        // Verify releases are rendered
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.getByText('Banana')).toBeInTheDocument();

        // Ensure "Select All" button exists
        const selectAllBtn = screen.getByText('Select All');
        expect(selectAllBtn).toBeInTheDocument();

        // Click Select All
        fireEvent.click(selectAllBtn);

        // Verify Bulk Action Bar appears
        const selectedCount = screen.getByText('2', { selector: '.rounded-full' }); // More specific
        expect(selectedCount).toBeInTheDocument();
        expect(screen.getByText('Selected')).toBeInTheDocument();
        expect(screen.getByText('Deselect All')).toBeInTheDocument();

        // Click Deselect All
        fireEvent.click(screen.getByText('Deselect All'));
        expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    });

    it('handles search and filtering correctly', () => {
        const mockReleases = [
            { id: '1', metadata: { trackTitle: 'Apple', artistName: 'A', releaseType: 'Single' }, status: 'live', assets: {} },
            { id: '2', metadata: { trackTitle: 'Banana', artistName: 'B', releaseType: 'Single' }, status: 'draft', assets: {} }
        ];

        (useReleases as any).mockReturnValue({
            releases: mockReleases,
            loading: false
        });

        render(<PublishingDashboard />);

        // Search
        const searchInput = screen.getByPlaceholderText('Search releases...');
        fireEvent.change(searchInput, { target: { value: 'Apple' } });
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.queryByText('Banana')).not.toBeInTheDocument();

        // Filter
        fireEvent.change(searchInput, { target: { value: '' } }); // Clear search
        const filterSelect = screen.getByRole('combobox');
        fireEvent.change(filterSelect, { target: { value: 'live' } });
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    });

    it('executes bulk delete with toast promise', async () => {
        // Mock global confirm
        global.confirm = vi.fn(() => true);

        const mockReleases = [
            { id: '1', metadata: { trackTitle: 'Delete Me' }, status: 'draft', assets: {} }
        ];

        (useReleases as any).mockReturnValue({
            releases: mockReleases,
            loading: false,
            deleteRelease: mockDeleteRelease
        });

        render(<PublishingDashboard />);

        // Select the item
        const selectAllBtn = screen.getByText('Select All');
        fireEvent.click(selectAllBtn);

        // Find delete button in floating bar (it's the second button, typically has Trash2 icon)
        // Since we mocked Lucide icons, we can't search by icon. But we can search by class or structure if needed.
        // Or simpler: verify the floating bar is there and click the button. 
        // In the implementation, the delete button is one of two buttons in the floating bar.
        // We can look for the button that calls handleBulkDelete.
        // Let's assume the buttons are identifiable.
        // Actually, looking at the code: <button onClick={handleBulkDelete}...>
        // We can't identify it easily by text since it just has an icon.
        // We'll rely on the structure or adding a test-id in the component would be better.
        // For now, let's just find the button in the 'fixed' container.

        const floatingBar = screen.getByText('Selected').closest('div')?.parentElement;
        const deleteBtn = floatingBar?.querySelectorAll('button')[2]; // Third button is delete (Deselect, Archive, Delete)

        fireEvent.click(deleteBtn!);

        expect(global.confirm).toHaveBeenCalled();
        expect(mockToastPromise).toHaveBeenCalled();
        expect(mockDeleteRelease).toHaveBeenCalledWith('1');
        expect(mockDeleteRelease).toHaveBeenCalledWith('1');
    });

    it('executes bulk archive with toast promise', async () => {
        // Mock global confirm
        global.confirm = vi.fn(() => true);

        const mockReleases = [
            { id: '1', metadata: { trackTitle: 'Archive Me' }, status: 'live', assets: {} }
        ];

        (useReleases as any).mockReturnValue({
            releases: mockReleases,
            loading: false,
            deleteRelease: mockDeleteRelease,
            archiveRelease: mockArchiveRelease
        });

        render(<PublishingDashboard />);

        // Select the item
        const selectAllBtn = screen.getByText('Select All');
        fireEvent.click(selectAllBtn);

        // Find archive button
        const archiveBtn = screen.getByText('Archive');

        fireEvent.click(archiveBtn);

        expect(global.confirm).toHaveBeenCalled();
        expect(mockToastPromise).toHaveBeenCalled();
        expect(mockArchiveRelease).toHaveBeenCalledWith('1');
    });

    it('navigates to distribution module via Manage Distributors', () => {
        (useReleases as any).mockReturnValue({
            releases: [],
            loading: false
        });

        render(<PublishingDashboard />);

        const manageBtn = screen.getByText('Manage Connections');
        fireEvent.click(manageBtn);

        expect(mockSetModule).toHaveBeenCalledWith('distribution');
    });
});
