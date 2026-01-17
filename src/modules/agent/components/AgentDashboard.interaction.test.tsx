import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentDashboard from './AgentDashboard';
import { VenueScoutService } from '../services/VenueScoutService';

// --- MOCKS ---

// Mock VenueScoutService
vi.mock('../services/VenueScoutService', () => ({
    VenueScoutService: {
        searchVenues: vi.fn(),
    }
}));

// Mock Store using vi.hoisted to prevent ReferenceErrors
const { mockStoreState, mockSetScanning, mockAddVenue } = vi.hoisted(() => {
    const mockSetScanning = vi.fn();
    const mockAddVenue = vi.fn();
    return {
        mockStoreState: {
            venues: [],
            isScanning: false,
            setScanning: mockSetScanning,
            addVenue: mockAddVenue,
        },
        mockSetScanning,
        mockAddVenue
    };
});

vi.mock('../store/AgentStore', () => ({
    useAgentStore: () => mockStoreState
}));

// Mock Child Components to verify props
// We use simple function returns or React.createElement to avoid JSX scope issues in factory if needed,
// but usually standard JSX works if React is in scope (which it isn't inside factory usually).
// However, the previous test passed with JSX. We'll stick to what works but ensure imports are safe.
// To be safe against "React is not defined" in hoisted mocks:
const MockScoutMapVisualization = vi.fn(({ status }) => (
    <div data-testid="mock-map-viz">Map Status: {status}</div>
));

vi.mock('./ScoutMapVisualization', () => ({
    ScoutMapVisualization: (props: any) => MockScoutMapVisualization(props)
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

describe('👁️ Pixel: AgentDashboard AI Interaction', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mutable state
        mockStoreState.venues = [];
        mockStoreState.isScanning = false;
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
            mockStoreState.isScanning = val;
        });

        fireEvent.click(deployBtn);

        // 4. Verify "Loading" / "Streaming" States

        // Wait for first status update
        await waitFor(() => {
            expect(MockScoutMapVisualization).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'Scanning sector 7...' })
            );
        });

        // Wait for second status update
        await waitFor(() => {
            expect(MockScoutMapVisualization).toHaveBeenCalledWith(
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
            mockStoreState.isScanning = val;
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
