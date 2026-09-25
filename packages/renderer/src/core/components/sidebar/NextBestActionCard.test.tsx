import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextBestActionCard } from './NextBestActionCard';

const mockJudgeNextBestAction = vi.fn();
const mockGetNextWorkflowPrediction = vi.fn();

vi.mock('@/config/typesafeJudgments', () => ({
    judgeNextBestAction: (...args: unknown[]) => mockJudgeNextBestAction(...args),
}));

vi.mock('@/services/agent/WorkflowStateService', () => ({
    workflowStateService: {
        getNextWorkflowPrediction: (...args: unknown[]) => mockGetNextWorkflowPrediction(...args),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        (selector: (state: { user?: { uid: string }; catalog: { id: string; title: string }[]; campaigns: unknown[]; splits: { id: string; status: string }[]; unreadStatements: boolean }) => unknown) => {
            const state = {
            catalog: [{ id: '1', title: 'Unreleased track' }],
            campaigns: [],
            splits: [{ id: 's1', status: 'pending' }],
            unreadStatements: false,
            user: { uid: 'artist-test' },
            };
            return selector(state);
        },
        {
            getState: () => ({
                catalog: [{ id: '1', title: 'Unreleased track' }],
                campaigns: [],
                splits: [{ id: 's1', status: 'pending' }],
                unreadStatements: false,
                user: { uid: 'artist-test' },
            }),
        },
    ),
}));

describe('NextBestActionCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetNextWorkflowPrediction.mockResolvedValue(null);
    });

    it('renders the suggested action when nextModule differs from currentModule', async () => {
        mockJudgeNextBestAction.mockResolvedValueOnce({
            nextModule: 'finance',
            callToAction: 'Finalize pending collaborator split sheets',
            confidence: 0.9,
            rationale: 'Pending splits',
        });

        const onNavigate = vi.fn();
        render(
            <NextBestActionCard
                onNavigate={onNavigate}
                currentModule={'creative' as any}
                isSidebarOpen={true}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('next-best-action-card')).toBeInTheDocument();
        });

        expect(screen.getByText('Finalize pending collaborator split sheets')).toBeInTheDocument();

        const openBtn = screen.getByRole('button', { name: /open finance/i });
        fireEvent.click(openBtn);
        expect(onNavigate).toHaveBeenCalledWith('finance');
    });

    it('does not render when sidebar is collapsed', async () => {
        mockJudgeNextBestAction.mockResolvedValueOnce({
            nextModule: 'finance',
            callToAction: 'Finalize splits',
            confidence: 0.9,
            rationale: 'Pending splits',
        });

        render(
            <NextBestActionCard
                onNavigate={vi.fn()}
                currentModule={'creative' as any}
                isSidebarOpen={false}
            />
        );

        expect(screen.queryByTestId('next-best-action-card')).not.toBeInTheDocument();
    });

    it('dismisses the card when close button is clicked', async () => {
        mockJudgeNextBestAction.mockResolvedValueOnce({
            nextModule: 'marketing',
            callToAction: 'Launch pre-save ad campaign',
            confidence: 0.85,
            rationale: 'Campaign launch',
        });

        render(
            <NextBestActionCard
                onNavigate={vi.fn()}
                currentModule={'dashboard' as any}
                isSidebarOpen={true}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('next-best-action-card')).toBeInTheDocument();
        });

        const dismissBtn = screen.getByRole('button', { name: /dismiss recommendation/i });
        fireEvent.click(dismissBtn);

        expect(screen.queryByTestId('next-best-action-card')).not.toBeInTheDocument();
    });

    it('shows a separate advisory workflow suggestion from the current user’s completed history', async () => {
        mockJudgeNextBestAction.mockResolvedValueOnce(null);
        mockGetNextWorkflowPrediction.mockResolvedValueOnce({
            predictions: [{
                workflowId: 'rights-review',
                followsWorkflowId: 'release-plan',
                supportCount: 2,
                observedTransitionCount: 2,
                observedRate: 1,
                supportingExecutionIds: ['a1', 'b1', 'a2', 'b2'],
            }],
        });
        const onNavigate = vi.fn();
        render(
            <NextBestActionCard
                onNavigate={onNavigate}
                currentModule={'creative' as any}
                isSidebarOpen={true}
            />
        );

        expect(await screen.findByTestId('historical-workflow-suggestion')).toHaveTextContent(/release-plan.*rights-review/i);
        fireEvent.click(screen.getByRole('button', { name: /review in workflows/i }));
        expect(onNavigate).toHaveBeenCalledWith('workflow');
        expect(mockGetNextWorkflowPrediction).toHaveBeenCalledWith('artist-test');
    });
});
