import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import CampaignDashboard from './CampaignDashboard';
import { MarketingService } from '@/services/marketing/MarketingService';

const { mockToastError } = vi.hoisted(() => ({
    mockToastError: vi.fn(),
}));

// Mock dependencies
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: mockToastError,
        info: vi.fn(),
    }),
}));

vi.mock('@/modules/marketing/hooks/useMarketing', () => ({
    useMarketing: vi.fn(() => ({
        campaigns: [],
        actions: {
            createCampaign: vi.fn(),
            refreshDashboard: vi.fn(),
        },
        isLoading: false,
        error: null,
    })),
}));

vi.mock('@/services/marketing/MarketingService', () => ({
    MarketingService: {
        getCampaignById: vi.fn(),
        createCampaign: vi.fn(),
        getCampaigns: vi.fn(),
        updateCampaign: vi.fn(),
        subscribeToCampaigns: vi.fn(() => () => { }), // Mock subscription
    }
}));

// Mock useMarketing hook
vi.mock('@/modules/marketing/hooks/useMarketing', () => ({
    useMarketing: () => ({
        campaigns: [],
        actions: {
            refresh: vi.fn(),
            deleteCampaign: vi.fn(),
            updateCampaign: vi.fn(),
        }
    })
}));

const TEST_CAMPAIGN = { id: 'campaign-1', title: 'Test Campaign', posts: [] };
const AI_GENERATED_CAMPAIGN = { title: 'AI Generated Campaign', posts: [] };

// Mock CampaignManager as it has its own complexities
vi.mock('./CampaignManager', () => ({
    default: ({ selectedCampaign, onCreateNew, onUpdateCampaign, onAIGenerate }: any) => {
        // If selectedCampaign is present, show "Managing: Title"
        // Otherwise show list/empty state which includes "Create New Campaign" button
        if (selectedCampaign) {
            return (
                <div data-testid="campaign-manager">
                    Managing: {selectedCampaign.title}
                </div>
            );
        }
        return (
            <div>
                <div>Campaign Manager</div>
                <button onClick={onCreateNew}>Create New Campaign</button>
                <button onClick={() => { onUpdateCampaign(TEST_CAMPAIGN).catch(() => {}); }}>Trigger Update</button>
                <button onClick={onAIGenerate}>Open AI Modal</button>
                <div>Select a campaign</div>
            </div>
        );
    },
}));

// Mock IntelligenceCampaignModal to directly exercise handleAISave without
// driving the full generate-then-create UI flow (already covered in
// IntelligenceCampaignModal.test.tsx).
vi.mock('./IntelligenceCampaignModal', () => ({
    default: ({ onSave }: any) => (
        <div data-testid="ai-campaign-modal">
            <button onClick={() => { onSave(AI_GENERATED_CAMPAIGN).catch(() => {}); }}>Trigger AI Save</button>
        </div>
    ),
}));

describe('CampaignDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    it('renders empty state initially', () => {
        render(<CampaignDashboard />);
        expect(screen.getByText('Campaign Manager')).toBeInTheDocument();
        expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
        expect(screen.getByText(/Select a campaign/)).toBeInTheDocument();
    });

    it('opens create modal when clicking create button', async () => {
        render(<CampaignDashboard />);
        const createBtn = screen.getByRole('button', { name: /Create New Campaign/i });
        fireEvent.click(createBtn);

        // Wait for modal to appear
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('New Campaign', { selector: 'h2' })).toBeInTheDocument();

        // Verify accessible inputs exist
        expect(screen.getByLabelText(/Campaign Name/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Platform/)).toBeInTheDocument();
    });

    describe('ISSUE-949: campaign updates actually persist', () => {
        it('persists an update via MarketingService.updateCampaign', async () => {
            (MarketingService.updateCampaign as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            render(<CampaignDashboard />);
            fireEvent.click(screen.getByRole('button', { name: 'Trigger Update' }));

            await waitFor(() => {
                expect(MarketingService.updateCampaign).toHaveBeenCalledWith('campaign-1', expect.objectContaining({
                    id: 'campaign-1',
                    title: 'Test Campaign'
                }));
            });
        });

        it('surfaces an error toast and does not silently claim success when the write fails', async () => {
            (MarketingService.updateCampaign as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Firestore write failed'));

            render(<CampaignDashboard />);
            fireEvent.click(screen.getByRole('button', { name: 'Trigger Update' }));

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Failed to save'));
            });
        });
    });

    describe('ISSUE-951: AI campaign creator only closes after confirmed persistence', () => {
        it('creates, reads back, and closes the AI modal only on success', async () => {
            (MarketingService.createCampaign as ReturnType<typeof vi.fn>).mockResolvedValue('new-campaign-id');
            (MarketingService.getCampaignById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-campaign-id', title: 'AI Generated Campaign' });

            render(<CampaignDashboard />);
            fireEvent.click(screen.getByRole('button', { name: 'Open AI Modal' }));
            fireEvent.click(screen.getByRole('button', { name: 'Trigger AI Save' }));

            await waitFor(() => {
                expect(MarketingService.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Generated Campaign' }));
                expect(MarketingService.getCampaignById).toHaveBeenCalledWith('new-campaign-id');
            });

            // Modal closes and the created campaign becomes the managed one.
            await waitFor(() => {
                expect(screen.queryByTestId('ai-campaign-modal')).not.toBeInTheDocument();
                expect(screen.getByTestId('campaign-manager')).toHaveTextContent('Managing: AI Generated Campaign');
            });
        });

        it('keeps the AI modal open and never claims success when creation fails', async () => {
            (MarketingService.createCampaign as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Quota exceeded'));

            render(<CampaignDashboard />);
            fireEvent.click(screen.getByRole('button', { name: 'Open AI Modal' }));
            fireEvent.click(screen.getByRole('button', { name: 'Trigger AI Save' }));

            await waitFor(() => {
                expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Failed to create campaign'));
            });

            // Never silently swaps to a "managed" view or drops the modal.
            expect(screen.getByTestId('ai-campaign-modal')).toBeInTheDocument();
            expect(screen.queryByTestId('campaign-manager')).not.toBeInTheDocument();
        });
    });
});
