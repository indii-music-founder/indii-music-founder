import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentDashboard from './AgentDashboard';

// Mock dependencies
vi.mock('../services/VenueScoutService', () => ({
    VenueScoutService: {
        searchVenues: vi.fn(),
    }
}));

vi.mock('../store/AgentStore', () => ({
    useAgentStore: vi.fn(() => ({
        venues: [],
        isScanning: false,
        setScanning: vi.fn(),
        addVenue: vi.fn(),
    }))
}));

vi.mock('@/core/components/MobileOnlyWarning', () => ({
    MobileOnlyWarning: () => <div>Mobile Warning</div>
}));

vi.mock('./BrowserAgentTester', () => ({
    default: () => <div>Browser Agent Tester</div>
}));

vi.mock('./ScoutMapVisualization', () => ({
    ScoutMapVisualization: () => <div>Map Visualization</div>
}));

vi.mock('./VenueCard', () => ({
    VenueCard: () => <div>VenueCard</div>
}));

// Mock the new sub-components to isolate AgentDashboard logic
vi.mock('./AgentSidebar', () => ({
    AgentSidebar: ({ setActiveTab }: { setActiveTab: (t: string) => void }) => (
        <div data-testid="agent-sidebar">
            <button onClick={() => setActiveTab('scout')} title="The Scout">The Scout Tab</button>
            <button onClick={() => setActiveTab('browser')} title="Browser Agent">Browser Tab</button>
            <button onClick={() => setActiveTab('campaigns')} title="Campaigns">Campaigns Tab</button>
            <button onClick={() => setActiveTab('inbox')} title="Inbox">Inbox Tab</button>
        </div>
    )
}));

vi.mock('./AgentToolbar', () => ({
    AgentToolbar: ({ left, right }: any) => (
        <div data-testid="agent-toolbar">
            {left}
            {right}
        </div>
    )
}));

vi.mock('./ScoutControls', () => ({
    ScoutControls: () => <div data-testid="scout-controls">Scout Controls</div>
}));

describe('AgentDashboard', () => {
    it('renders the sidebar, toolbar and default scout view', () => {
        render(<AgentDashboard />);

        expect(screen.getByTestId('agent-sidebar')).toBeDefined();
        expect(screen.getByTestId('agent-toolbar')).toBeDefined();
        expect(screen.getByText('Agent Tools')).toBeDefined(); // Inside toolbar logic in dashboard

        // Default View is Scout
        expect(screen.getByText('The Scout')).toBeDefined(); // Header text
        expect(screen.getByTestId('scout-controls')).toBeDefined();
    });

    it('switches tabs correctly', () => {
        render(<AgentDashboard />);

        // Click Browser Tab (mocked sidebar)
        const browserButton = screen.getByTitle('Browser Agent');
        fireEvent.click(browserButton);

        expect(screen.getByText('Browser Agent Tester')).toBeDefined();

        // Click Campaigns Tab
        const campaignsButton = screen.getByTitle('Campaigns');
        fireEvent.click(campaignsButton);

        expect(screen.getByText('Module under construction')).toBeDefined();
    });
});
