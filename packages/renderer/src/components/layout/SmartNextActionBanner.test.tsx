import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartNextActionBanner } from './SmartNextActionBanner';

const mockSetModule = vi.fn();

let mockStoreState: Record<string, unknown> = {
    currentModule: 'creative',
    setModule: mockSetModule,
    distribution: { releases: [], loading: false },
    finance: { earningsSummary: null, loading: false },
};

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => {
        return typeof selector === 'function' ? selector(mockStoreState) : mockStoreState;
    }),
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgeNextBestModule: vi.fn(async (candidates) => {
        if (!candidates || candidates.length === 0) return null;
        const candidate = candidates[0];
        return {
            targetModule: candidate.targetModule,
            relevanceScore: 5,
            actionTitle: candidate.title,
            actionDescription: candidate.description,
            source: 'rules',
        };
    }),
}));

describe('SmartNextActionBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState = {
            currentModule: 'creative',
            setModule: mockSetModule,
            distribution: { releases: [], loading: false },
            finance: { earningsSummary: null, loading: false },
        };
    });

    it('renders nothing when store has no releases or earnings', async () => {
        render(<SmartNextActionBanner />);

        await waitFor(() => {
            expect(screen.queryByTestId('smart-next-action-banner')).not.toBeInTheDocument();
        });
    });

    it('never renders fabricated text (Detroit Rain, 14200, DSP Settlements) on empty state', async () => {
        render(<SmartNextActionBanner />);

        await waitFor(() => {
            expect(screen.queryByText(/Detroit Rain/)).not.toBeInTheDocument();
            expect(screen.queryByText(/14200/)).not.toBeInTheDocument();
            expect(screen.queryByText(/DSP Settlements/)).not.toBeInTheDocument();
        });
    });

    it('renders banner when genuine draft release exists', async () => {
        mockStoreState.distribution = {
            releases: [
                {
                    id: 'r1',
                    title: 'Motor City Midnight',
                    artist: 'Detroit Artist',
                    deployments: { spotify: { status: 'draft' } },
                },
            ],
            loading: false,
        };

        render(<SmartNextActionBanner />);

        await waitFor(() => {
            expect(screen.getByTestId('smart-next-action-banner')).toBeInTheDocument();
            expect(screen.getByText(/Finish submitting 'Motor City Midnight'/)).toBeInTheDocument();
            expect(screen.getByText(/Proceed to Distribution/)).toBeInTheDocument();
        });
    });

    it('navigates to recommended target module when clicked', async () => {
        mockStoreState.distribution = {
            releases: [
                {
                    id: 'r1',
                    title: 'Motor City Midnight',
                    artist: 'Detroit Artist',
                    deployments: { spotify: { status: 'draft' } },
                },
            ],
            loading: false,
        };

        render(<SmartNextActionBanner />);

        await waitFor(() => {
            expect(screen.getByTestId('smart-action-navigate-btn')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('smart-action-navigate-btn'));
        expect(mockSetModule).toHaveBeenCalledWith('distribution');
    });

    it('dismisses banner when close button is clicked', async () => {
        mockStoreState.distribution = {
            releases: [
                {
                    id: 'r1',
                    title: 'Motor City Midnight',
                    artist: 'Detroit Artist',
                    deployments: { spotify: { status: 'draft' } },
                },
            ],
            loading: false,
        };

        const mockDismiss = vi.fn();
        render(<SmartNextActionBanner onDismiss={mockDismiss} />);

        await waitFor(() => {
            expect(screen.getByTestId('smart-action-dismiss-btn')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('smart-action-dismiss-btn'));
        expect(mockDismiss).toHaveBeenCalled();
        expect(screen.queryByTestId('smart-next-action-banner')).not.toBeInTheDocument();
    });
});
