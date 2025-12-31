import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicistDashboard from './PublicistDashboard';
import { usePublicist } from './hooks/usePublicist';

// Mock the usePublicist hook
vi.mock('./hooks/usePublicist', () => ({
    usePublicist: vi.fn(() => ({

        campaigns: [
            {
                id: '1',
                artist: 'Test Artist',
                title: 'Test Campaign',
                type: 'Album',
                status: 'Live',
                progress: 50,
                releaseDate: '2025-01-01',
                openRate: 25,
                coverUrl: 'test-url'
            }
        ],
        contacts: [
            {
                id: 'c1',
                name: 'Test Contact',
                outlet: 'Test Outlet',
                role: 'Journalist',
                tier: 'Top',
                influenceScore: 90,
                relationshipStrength: 'Strong',
                avatarUrl: 'test-avatar'
            }
        ],
        stats: {
            globalReach: '1M',
            avgOpenRate: '30%',
            placementValue: '$10k'
        },
        activeTab: 'campaigns',
        setActiveTab: vi.fn(),
        loading: false,
        searchQuery: '',
        setSearchQuery: vi.fn(),
        filterType: 'all',
        setFilterType: vi.fn()
    }))
}));

// Mock module error boundary
vi.mock('@/core/components/ModuleErrorBoundary', () => ({
    ModuleErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('PublicistDashboard', () => {
    it('renders the dashboard header correctly', () => {
        render(<PublicistDashboard />);
        expect(screen.getByText('Publicist')).toBeDefined();
        expect(screen.getByText('Global Press & Media Relations')).toBeDefined();
    });

    it('renders stats ticker with correct data', () => {
        render(<PublicistDashboard />);
        expect(screen.getByText('1M')).toBeDefined();
        expect(screen.getByText('30%')).toBeDefined();
        expect(screen.getByText('$10k')).toBeDefined();
    });

    it('renders campaign cards', () => {
        render(<PublicistDashboard />);
        expect(screen.getByText('Test Campaign')).toBeDefined();
        expect(screen.getByText('Test Artist')).toBeDefined();
        expect(screen.getAllByText('Live')[0]).toBeDefined();
    });

    it('renders loading state', () => {
        // Mock loading true
        vi.mocked(usePublicist).mockReturnValueOnce({
            campaigns: [],
            contacts: [],
            stats: { globalReach: '0', avgOpenRate: '0%', placementValue: '$0' },
            activeTab: 'campaigns',
            setActiveTab: vi.fn(),
            loading: true,
            searchQuery: '',
            setSearchQuery: vi.fn(),
            filterType: 'all',
            setFilterType: vi.fn()
        });

        render(<PublicistDashboard />);
        // Verify text is NOT there to confirm loading state is active
        expect(screen.queryByText('Test Campaign')).toBeNull();
    });

    it('renders contact list', () => {
        render(<PublicistDashboard />);
        expect(screen.getByText('Test Contact')).toBeDefined();
        expect(screen.getByText('Test Outlet')).toBeDefined();
    });
});

