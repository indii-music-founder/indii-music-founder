import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CRMDashboard from './CRMDashboard';
import { useStore } from '@/core/store';

// Mock store
vi.mock('@/core/store', () => {
    const mockUseStore = vi.fn();
    (mockUseStore as any).setState = vi.fn();
    (mockUseStore as any).getState = vi.fn(() => ({}));
    return { useStore: mockUseStore };
});

// Mock framer-motion to simplify DOM transitions in JSDOM tests
vi.mock('framer-motion', () => ({
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

    it('opens modal, handles form submissions, calls createCampaign, and resets inputs', async () => {
        render(<CRMDashboard />);

        // Modal should be closed initially
        expect(screen.queryByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).not.toBeInTheDocument();

        // Click New Drop button
        const newDropBtn = screen.getByText('New Drop');
        fireEvent.click(newDropBtn);

        // Modal should open
        expect(screen.getByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).toBeInTheDocument();

        // Fill form fields
        const nameInput = screen.getByPlaceholderText('e.g. Genesis Digital Vinyl Drop');
        const supplyInput = screen.getByPlaceholderText('100');
        const priceInput = screen.getByPlaceholderText('9.99');

        fireEvent.change(nameInput, { target: { value: 'Synthwave Collector Pack' } });
        fireEvent.change(supplyInput, { target: { value: '250' } });
        fireEvent.change(priceInput, { target: { value: '14.99' } });

        // Click Launch
        const launchBtn = screen.getByText('Launch Drop');
        fireEvent.click(launchBtn);

        await waitFor(() => {
            expect(mockCreateCampaign).toHaveBeenCalledWith({
                name: 'Synthwave Collector Pack',
                type: 'Digital Vinyl',
                supply: 250,
                price: 14.99,
                status: 'active'
            });
            expect(screen.queryByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).not.toBeInTheDocument();
        });
    });

    it('cancels form modal inputs and closes when Cancel is clicked', () => {
        render(<CRMDashboard />);

        // Open modal
        const newDropBtn = screen.getByText('New Drop');
        fireEvent.click(newDropBtn);
        expect(screen.getByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).toBeInTheDocument();

        // Click Cancel
        const cancelBtn = screen.getByText('Cancel');
        fireEvent.click(cancelBtn);

        // Modal should be closed and createCampaign not called
        expect(screen.queryByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).not.toBeInTheDocument();
        expect(mockCreateCampaign).not.toHaveBeenCalled();
    });

    it('calls deleteCampaign handler when trash button is clicked', () => {
        render(<CRMDashboard />);

        const deleteButtons = screen.getAllByTitle('Delete Campaign');
        expect(deleteButtons).toHaveLength(2);

        // Click delete on the second campaign
        fireEvent.click(deleteButtons[1]);
        expect(mockDeleteCampaign).toHaveBeenCalledWith('camp-2');
    });
});
