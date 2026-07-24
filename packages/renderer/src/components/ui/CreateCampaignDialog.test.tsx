import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateCampaignDialog } from './CreateCampaignDialog';
import { useStore } from '@/core/store';

// Mock store
vi.mock('@/core/store', () => {
    const mockUseStore = vi.fn();
    (mockUseStore as any).setState = vi.fn();
    (mockUseStore as any).getState = vi.fn(() => ({}));
    return { useStore: mockUseStore };
});

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

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

describe('CreateCampaignDialog', () => {
    const mockCreateCampaign = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // ISSUE-979: the dialog only closes/clears after a real persisted ID.
        mockCreateCampaign.mockResolvedValue('new-campaign-id');
        (useStore as unknown as import('vitest').Mock).mockImplementation((selector: any) => {
            const state = { createCampaign: mockCreateCampaign };
            return selector ? selector(state) : state;
        });
    });

    // Renders the real react-call Root and immediately triggers .call({}) —
    // this is what mounts an active call item for the form to render against.
    function openDialog() {
        render(<CreateCampaignDialog />);
        act(() => {
            void CreateCampaignDialog.call({});
        });
    }

    it('ISSUE-980: saves as a Draft (not Active) when no deliverable link is provided', async () => {
        openDialog();

        expect(await screen.findByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('e.g. Genesis Digital Vinyl Drop'), { target: { value: 'Synthwave Collector Pack' } });
        fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '250' } });
        fireEvent.change(screen.getByPlaceholderText('9.99'), { target: { value: '14.99' } });

        // Button honestly reflects that this will save as a draft, not launch.
        fireEvent.click(screen.getByText('Save as Draft'));

        await waitFor(() => {
            expect(mockCreateCampaign).toHaveBeenCalledWith({
                name: 'Synthwave Collector Pack',
                type: 'Digital Vinyl',
                supply: 250,
                price: 14.99,
                deliverableUrl: undefined,
                status: 'draft'
            });
            expect(screen.queryByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).not.toBeInTheDocument();
        });
    });

    it('ISSUE-980: launches as Active only once a real deliverable link is provided', async () => {
        openDialog();
        await screen.findByText('Launch a new Digital Vinyl or VIP drop for your superfans.');

        fireEvent.change(screen.getByPlaceholderText('e.g. Genesis Digital Vinyl Drop'), { target: { value: 'Synthwave Collector Pack' } });
        fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '250' } });
        fireEvent.change(screen.getByPlaceholderText('9.99'), { target: { value: '14.99' } });
        fireEvent.change(screen.getByPlaceholderText(/Where fans get this/), { target: { value: 'https://cdn.example.com/vinyl.zip' } });

        fireEvent.click(screen.getByText('Launch Drop'));

        await waitFor(() => {
            expect(mockCreateCampaign).toHaveBeenCalledWith({
                name: 'Synthwave Collector Pack',
                type: 'Digital Vinyl',
                supply: 250,
                price: 14.99,
                deliverableUrl: 'https://cdn.example.com/vinyl.zip',
                status: 'active'
            });
        });
    });

    it('ISSUE-979: keeps the dialog and draft intact when createCampaign returns null (persistence failure)', async () => {
        mockCreateCampaign.mockResolvedValue(null);
        openDialog();
        await screen.findByText('Launch a new Digital Vinyl or VIP drop for your superfans.');

        fireEvent.change(screen.getByPlaceholderText('e.g. Genesis Digital Vinyl Drop'), { target: { value: 'Synthwave Collector Pack' } });
        fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '250' } });
        fireEvent.change(screen.getByPlaceholderText('9.99'), { target: { value: '14.99' } });

        fireEvent.click(screen.getByText('Save as Draft'));

        await waitFor(() => {
            expect(mockCreateCampaign).toHaveBeenCalled();
        });
        // Dialog stays open, draft values are preserved — nothing was saved.
        expect(screen.getByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. Genesis Digital Vinyl Drop')).toHaveValue('Synthwave Collector Pack');
        expect(screen.getByPlaceholderText('100')).toHaveValue(250);
        expect(screen.getByPlaceholderText('9.99')).toHaveValue(14.99);
    });

    it('cancels form inputs and closes when Cancel is clicked, without creating a campaign', async () => {
        openDialog();
        await screen.findByText('Launch a new Digital Vinyl or VIP drop for your superfans.');

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Launch a new Digital Vinyl or VIP drop for your superfans.')).not.toBeInTheDocument();
        });
        expect(mockCreateCampaign).not.toHaveBeenCalled();
    });
});
