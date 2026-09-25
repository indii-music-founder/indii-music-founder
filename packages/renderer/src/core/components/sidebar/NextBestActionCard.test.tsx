import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextBestActionCard } from './NextBestActionCard';

const mockJudgeNextBestAction = vi.fn();

vi.mock('@/config/typesafeJudgments', () => ({
    judgeNextBestAction: (...args: unknown[]) => mockJudgeNextBestAction(...args),
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            catalog: [{ id: '1', title: 'Unreleased track' }],
            campaigns: [],
            splits: [{ id: 's1', status: 'pending' }],
            unreadStatements: false,
        }),
    },
}));

describe('NextBestActionCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});
