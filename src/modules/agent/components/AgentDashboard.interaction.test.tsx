import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentDashboard from './AgentDashboard';
import { VenueScoutService } from '../services/VenueScoutService';

// --- MOCKS ---

import { createMockStore } from '@/test/utils';

// Mock VenueScoutService
vi.mock('../services/VenueScoutService', () => ({
    VenueScoutService: {
        searchVenues: vi.fn(),
    }
}));

const { mockSetScanning, mockAddVenue, defaultStoreState } = vi.hoisted(() => {
    const mockSetScanning = vi.fn();
    const mockAddVenue = vi.fn();

    // We cannot use createMockStore directly inside vi.hoisted if it's imported
    // because vi.hoisted runs BEFORE imports. So we construct the object manually
    // or we must define the mock completely inside.
    const defaultStoreState = {
        venues: [],
        isScanning: false,
        setScanning: mockSetScanning,
        addVenue: mockAddVenue,
        userProfile: null,
        currentModuleId: 'dashboard',
        showCommandBar: false,
        updateProfile: vi.fn(),
        setModule: vi.fn(),
        toggleCommandBar: vi.fn(),
        addToast: vi.fn(),
    };

    return { mockSetScanning, mockAddVenue, defaultStoreState };
});

vi.mock('@/core/store', async (importOriginal) => {
    // We can access imports dynamically inside the factory if we need to,
    // or just rely on the fact that vi.mock runs after hoisted. 
    // The issue was `createMockStore` imported at the top level is undefined 
    // inside hoisted.

    // Instead of using createMockStore here which causes TDZ issues if imported
    // we just use the raw defaultStoreState from hoisted.
    return {
        useStore: vi.fn((selector) => {
            if (typeof selector === 'function') {
                return selector(defaultStoreState);
            }
            return defaultStoreState;
        })
    };
});



// Mock Child Components to verify props
const MockScoutMapVisualizationContent = vi.fn();
const MockScoutMapVisualization = (props: any) => {
    MockScoutMapVisualizationContent(props);
    return <div data-testid="mock-map-viz">Map Status: {props.status}</div>;
};

vi.mock('./ScoutMapVisualization', () => ({
    ScoutMapVisualization: (props: any) => <MockScoutMapVisualization {...props} />
}));

vi.mock('./VenueCard', () => ({
    VenueCard: ({ venue }: any) => <div data-testid="venue-card">{venue.name}</div>
}));

// Mock Layout Components
vi.mock('./AgentSidebar', () => ({
    AgentSidebar: () => <div data-testid="sidebar">Sidebar</div>
}));

vi.mock('./AgentToolbar', () => ({
    AgentToolbar: ({ left }: any) => <div>{left}</div>
}));

vi.mock('./ScoutControls', () => ({
    ScoutControls: ({ handleScan, isScanning }: any) => (
        <button
            onClick={handleScan}
            disabled={isScanning}
            data-testid="deploy-scout-btn"
        >
            {isScanning ? 'Scanning...' : 'Deploy Scout'}
        </button>
    )
}));

vi.mock('@/core/components/MobileOnlyWarning', () => ({
    MobileOnlyWarning: () => <div>Mobile Warning</div>
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn()
    })
}));

describe('👁️ Pixel: AgentDashboard AI Interaction', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mutable state
        defaultStoreState.venues = [];
        defaultStoreState.isScanning = false;
        // Mocks are cleared but implementations remain if set in hoisted?
        // vi.fn() instances are reused. clearAllMocks clears their calls.
    });

    it('Scenario 1: Verifies "Scanning" feedback loop and map updates', async () => {
        // Pixel Rule: "Mock the AI, verify the UI"

        // 1. Setup the mock AI behavior (Streaming events)
        (VenueScoutService.searchVenues as any).mockImplementation(async (city: string, genre: string, isAuto: boolean, onProgress: any) => {
            // Simulate AI "Thinking" steps
            onProgress({ step: 'SCANNING_MAP', message: 'Scanning sector 7...' });
            await new Promise(r => setTimeout(r, 10));

            onProgress({ step: 'ANALYZING_CAPACITY', message: ' analyzing capacity...' });
            await new Promise(r => setTimeout(r, 10));

            // Return mock results
            return [
                { id: 'v1', name: 'Cyber Bar', genres: ['Techno'] },
                { id: 'v2', name: 'Neon Lounge', genres: ['Techno'] }
            ];
        });

        render(<AgentDashboard />);

        // 2. Initial State
        const deployBtn = screen.getByTestId('deploy-scout-btn');
        expect(deployBtn).toBeEnabled();
        expect(deployBtn).toHaveTextContent('Deploy Scout');

        // 3. Trigger Action
        // Update mock store when setScanning is called
        mockSetScanning.mockImplementation((val) => {
            defaultStoreState.isScanning = val;
        });

        fireEvent.click(deployBtn);

        // 4. Verify "Loading" / "Streaming" States

        // Wait for first status update
        await waitFor(() => {
            expect(MockScoutMapVisualizationContent).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'Scanning sector 7...' })
            );
        });

        // Wait for second status update
        await waitFor(() => {
            expect(MockScoutMapVisualizationContent).toHaveBeenCalledWith(
                expect.objectContaining({ status: ' analyzing capacity...' })
            );
        });

        // 5. Verify Completion
        await waitFor(() => {
            expect(mockSetScanning).toHaveBeenCalledWith(false);
            expect(mockAddVenue).toHaveBeenCalledTimes(2);
            expect(mockAddVenue).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cyber Bar' }));
        });
    });

    it('Scenario 2: Handles Empty Results gracefully', async () => {
        // Pixel Rule: "Accessibility is functionality" - Ensure user knows what happened

        (VenueScoutService.searchVenues as any).mockResolvedValue([]);

        render(<AgentDashboard />);
        const deployBtn = screen.getByTestId('deploy-scout-btn');

        mockSetScanning.mockImplementation((val) => {
            defaultStoreState.isScanning = val;
        });

        fireEvent.click(deployBtn);

        await waitFor(() => {
            expect(mockSetScanning).toHaveBeenCalledWith(false);
        });

        // Verify we handled empty state (no venues added)
        expect(mockAddVenue).not.toHaveBeenCalled();

        expect(screen.getByText('No venues scouted yet')).toBeInTheDocument();
    });
});
