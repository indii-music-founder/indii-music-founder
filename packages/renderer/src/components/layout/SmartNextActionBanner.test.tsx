import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartNextActionBanner } from './SmartNextActionBanner';

const mockSetModule = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => {
        const state = {
            currentModule: 'creative',
            setModule: mockSetModule,
        };
        return typeof selector === 'function' ? selector(state) : state;
    }),
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgeNextBestModule: vi.fn(async (context) => {
        if (context.hasUnreleasedMaster) {
            return {
                targetModule: 'distribution',
                relevanceScore: 5,
                actionTitle: "Distribute 'Detroit Rain'",
                actionDescription: 'Master track ready for DSP delivery.',
            };
        }
        return {
            targetModule: 'social',
            relevanceScore: 3,
            actionTitle: 'Engage Fanbase',
            actionDescription: 'Share behind-the-scenes teasers.',
        };
    }),
}));

describe('SmartNextActionBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders ambient recommendation banner based on artist state', async () => {
        render(<SmartNextActionBanner />);

        await waitFor(() => {
            expect(screen.getByTestId('smart-next-action-banner')).toBeInTheDocument();
            expect(screen.getByText(/Distribute 'Detroit Rain'/)).toBeInTheDocument();
            expect(screen.getByText(/Priority 5\/5/)).toBeInTheDocument();
        });
    });

    it('navigates to recommended target module when clicked', async () => {
        render(<SmartNextActionBanner />);

        await waitFor(() => {
            expect(screen.getByTestId('smart-action-navigate-btn')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('smart-action-navigate-btn'));
        expect(mockSetModule).toHaveBeenCalledWith('distribution');
    });

    it('dismisses banner when close button is clicked', async () => {
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
