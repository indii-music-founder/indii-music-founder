import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentDashboard from './AgentDashboard';
import { useAgentStore } from '../store/AgentStore';

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

describe('AgentDashboard', () => {
    it('renders the sidebar and default scout view', () => {
        render(<AgentDashboard />);

        // Checklist: Sidebar buttons present
        expect(screen.getByTitle('The Scout')).toBeDefined();
        expect(screen.getByTitle('Browser Agent')).toBeDefined();

        // Checklist: Scout content present
        expect(screen.getByText('The Scout')).toBeDefined();
        expect(screen.getByText('Deploy Scout')).toBeDefined();

        // Checklist: Toolbar present
        expect(screen.getByText('Agent Tools')).toBeDefined();
    });

    it('switches tabs correctly', () => {
        render(<AgentDashboard />);

        const browserButton = screen.getByTitle('Browser Agent');
        fireEvent.click(browserButton);

        expect(screen.getByText('Browser Agent Tester')).toBeDefined();

        const campaignsButton = screen.getByTitle('Campaigns');
        fireEvent.click(campaignsButton);

        expect(screen.getByText('Module under construction')).toBeDefined();
    });

    it('renders controls correctly', () => {
        render(<AgentDashboard />);

        // Check for inputs
        expect(screen.getByPlaceholderText('Target City (e.g. Nashville)')).toBeDefined();
        expect(screen.getByPlaceholderText('Focus Genre (e.g. Rock)')).toBeDefined();
        expect(screen.getByText('Auto Mode')).toBeDefined();
    });
});
