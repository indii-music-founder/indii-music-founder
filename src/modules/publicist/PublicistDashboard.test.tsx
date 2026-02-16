import React from 'react';
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
        setFilterType: vi.fn(),
        userProfile: {
            id: 'test-user',
            uid: 'test-user',
            displayName: 'Test User',
            email: 'test@example.com',
            bio: 'Creative Director',
            brandKit: {
                colors: [],
                fonts: '',
                brandDescription: '',
                negativePrompt: '',
                socials: {},
                brandAssets: [],
                referenceImages: [],
                releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' }
            },
            analyzedTrackIds: [],
            knowledgeBase: [],
            savedWorkflows: []
        } as unknown as import('@/modules/workflow/types').UserProfile
    }))
}));

// Mock module error boundary
vi.mock('@/core/components/ModuleErrorBoundary', () => ({
    ModuleErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock ToastContext
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        addToast: vi.fn(),
        removeToast: vi.fn(),
        toasts: []
    }),
    ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock Framer Motion
vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal<typeof import('framer-motion')>();
    const MotionComponent = ({ children, layout, layoutId, whileHover, whileTap, initial, animate, exit, transition, ...props }: any) => {
        return React.createElement('div', props, children);
    };

    return {
        ...actual,
        AnimatePresence: ({ children }: any) => <>{children}</>,
        motion: new Proxy({}, {
            get: (target, prop) => {
                return ({ children, layout, layoutId, whileHover, whileTap, initial, animate, exit, transition, ...props }: any) => {
                    // Start: Fix specifically for the warning "received true for non-boolean attribute layout"
                    // If the prop is 'layout' (string, boolean, etc.), we explicitly drop it.
                    // The destructuring above drops it from 'props', but we need to ensure we create the valid element type.
                    const type = typeof prop === 'string' ? prop : 'div';
                    return React.createElement(type, props, children);
                }
            }
        })
    };
});

describe('PublicistDashboard', () => {
    it('renders the sidebar and studio layout', () => {
        render(<PublicistDashboard />);
        expect(screen.getByText('Publicist')).toBeDefined();
        expect(screen.getByText('PR & Media')).toBeDefined(); // Tagline in Sidebar
        expect(screen.getByText('Main Menu')).toBeDefined();
    });

    it('renders stats ticker in sidebar', () => {
        render(<PublicistDashboard />);
        expect(screen.getByText('1M')).toBeDefined();
        // The stats are now split in the sidebar, verify they exist
        expect(screen.getByText('Global Reach')).toBeDefined();
        expect(screen.getAllByText('Open Rate')[0]).toBeDefined();
    });

    it('renders campaign cards by default', () => {
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
            setFilterType: vi.fn(),
            userProfile: {
                id: 'test-user',
                uid: 'test-user',
                displayName: 'Test User',
                email: 'test@example.com',
                bio: 'Creative Director',
                brandKit: {
                    colors: [],
                    fonts: '',
                    brandDescription: '',
                    negativePrompt: '',
                    socials: {},
                    brandAssets: [],
                    referenceImages: [],
                    releaseDetails: { title: '', type: '', artists: '', genre: '', mood: '', themes: '', lyrics: '' }
                },
                analyzedTrackIds: [],
                knowledgeBase: [],
                savedWorkflows: []
            } as unknown as import('@/modules/workflow/types').UserProfile
        });

        render(<PublicistDashboard />);
        expect(screen.queryByText('Test Campaign')).toBeNull();
        expect(screen.getByText('Loading Publicist Data...')).toBeDefined();
    });

    it('renders contact list when switching tabs', () => {
        // Mock activeTab as 'contacts' to simulate the switch state
        vi.mocked(usePublicist).mockReturnValueOnce({
            campaigns: [],
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
            activeTab: 'contacts', // SWITCHED TO CONTACTS
            setActiveTab: vi.fn(),
            loading: false,
            searchQuery: '',
            setSearchQuery: vi.fn(),
            filterType: 'all',
            setFilterType: vi.fn(),
            userProfile: { id: 'u1' } as any
        });

        render(<PublicistDashboard />);
        expect(screen.getByText('Test Contact')).toBeDefined();
        expect(screen.getByText('Test Outlet')).toBeDefined();
        expect(screen.getByText('Total Contacts')).toBeDefined();
    });
});

