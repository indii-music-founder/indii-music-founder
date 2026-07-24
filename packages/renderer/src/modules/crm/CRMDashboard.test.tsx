import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CRMDashboard from './CRMDashboard';
import { useStore } from '@/core/store';

const mockConfirmDialogCall = vi.fn().mockResolvedValue(true);
vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: {
        call: (...args: any[]) => mockConfirmDialogCall(...args)
    }
}));

// ISSUE-1207: campaign creation moved into its own react-call dialog
// (CreateCampaignDialog). Its own form/submission behavior is covered by
// CreateCampaignDialog.test.tsx; here we only verify CRMDashboard invokes it.
const mockCreateCampaignDialogCall = vi.fn().mockResolvedValue(true);
vi.mock('@/components/ui/CreateCampaignDialog', () => ({
    CreateCampaignDialog: {
        call: (...args: any[]) => mockCreateCampaignDialogCall(...args)
    }
}));

// Mock store
vi.mock('@/core/store', () => {
    const mockUseStore = vi.fn();
    (mockUseStore as any).setState = vi.fn();
    (mockUseStore as any).getState = vi.fn(() => ({}));
    return { useStore: mockUseStore };
});

// Mock motion to simplify DOM transitions in JSDOM tests
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: any) => {
            const cleanProps = { ...props };
            delete cleanProps.initial;
            delete cleanProps.animate;
            delete cleanProps.exit;
            delete cleanProps.transition;
            return <div {...cleanProps}>{children}</div>;
        }
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('CRMDashboard', () => {
    const mockCreateCampaign = vi.fn();
    const mockDeleteCampaign = vi.fn();
    const mockSubscribeToCampaigns = vi.fn(() => vi.fn());

    const mockCampaigns = [
        {
            id: 'camp-1',
            name: 'Summer Single Digital Vinyl',
            supply: '500',
            price: '4.99',
            createdAt: 1625097600000,
        },
        {
            id: 'camp-2',
            name: 'Cyberpunk Album VIP Drop',
            supply: '100',
            price: '19.99',
            createdAt: 1625097800000,
        }
    ];

    const defaultState = {
        crm: {
            campaigns: mockCampaigns,
            loading: false,
            error: null,
        },
        createCampaign: mockCreateCampaign,
        deleteCampaign: mockDeleteCampaign,
        subscribeToCampaigns: mockSubscribeToCampaigns
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // ISSUE-979: the dashboard only closes/clears after a real persisted ID.
        mockCreateCampaign.mockResolvedValue('new-campaign-id');
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(defaultState);
            return defaultState;
        });
        (useStore as any).getState = () => defaultState;
    });

    it('renders placeholder empty state when there are no campaigns', () => {
        const emptyState = {
            ...defaultState,
            crm: {
                campaigns: [],
                loading: false,
                error: null,
            }
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(emptyState);
            return emptyState;
        });

        render(<CRMDashboard />);
        expect(screen.getByText('No active campaigns yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first Digital Vinyl, audio drop, or VIP bundle to start engaging with superfans.')).toBeInTheDocument();
    });

    it('renders loading spinner when loading is true', () => {
        const loadingState = {
            ...defaultState,
            crm: {
                campaigns: [],
                loading: true,
                error: null,
            }
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(loadingState);
            return loadingState;
        });

        const { container } = render(<CRMDashboard />);
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });

    it('renders error banner when error is present', () => {
        const errorState = {
            ...defaultState,
            crm: {
                campaigns: [],
                loading: false,
                error: 'Firestore permission denied',
            }
        };
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            if (selector) return selector(errorState);
            return errorState;
        });

        render(<CRMDashboard />);
        expect(screen.getByText('Firestore permission denied')).toBeInTheDocument();
    });

    it('renders campaigns correctly with prices and supply counts', () => {
        render(<CRMDashboard />);

        // Verify Title
        expect(screen.getByText('Superfan CRM')).toBeInTheDocument();

        // Verify campaign names
        expect(screen.getByText('Summer Single Digital Vinyl')).toBeInTheDocument();
        expect(screen.getByText('Cyberpunk Album VIP Drop')).toBeInTheDocument();

        // Verify supply metrics
        expect(screen.getByText('500')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();

        // Verify price details
        expect(screen.getByText('$4.99')).toBeInTheDocument();
        expect(screen.getByText('$19.99')).toBeInTheDocument();
    });

    it('subscribes to campaigns on mount and unsubscribes on unmount', () => {
        const mockUnsubscribe = vi.fn();
        mockSubscribeToCampaigns.mockReturnValue(mockUnsubscribe);

        const { unmount } = render(<CRMDashboard />);
        expect(mockSubscribeToCampaigns).toHaveBeenCalled();

        unmount();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('ISSUE-1207: New Drop button invokes CreateCampaignDialog.call() (react-call) instead of hand-rolled modal state', () => {
        render(<CRMDashboard />);

        fireEvent.click(screen.getByText('New Drop'));

        expect(mockCreateCampaignDialogCall).toHaveBeenCalledWith({});
        // Nothing about this button ever renders the old inline form — that
        // form/submission logic now lives entirely in CreateCampaignDialog,
        // covered by CreateCampaignDialog.test.tsx (ISSUE-979/980 assertions).
        expect(screen.queryByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).not.toBeInTheDocument();
    });

    it('calls deleteCampaign handler when trash button is clicked', async () => {
        render(<CRMDashboard />);

        const deleteButtons = screen.getAllByTitle('Delete Campaign');
        expect(deleteButtons).toHaveLength(2);

        // Click delete on the second campaign
        fireEvent.click(deleteButtons[1]);
        
        await waitFor(() => {
            expect(mockConfirmDialogCall).toHaveBeenCalled();
            expect(mockDeleteCampaign).toHaveBeenCalledWith('camp-2');
        });
    });
});
