import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock child view components
vi.mock('./BoardroomBrowserView', () => ({
    BoardroomBrowserView: ({ isVisible }: { isVisible?: boolean }) => (
        <div data-testid="mock-browser-view" data-visible={String(isVisible ?? true)}>Browser View</div>
    ),
}));

vi.mock('./BoardroomModulePreview', () => ({
    BoardroomModulePreview: () => <div data-testid="mock-module-view">Module View</div>,
}));

vi.mock('./BoardroomWorkbenchView', () => ({
    BoardroomWorkbenchView: () => <div data-testid="mock-workbench-view">Workbench View</div>,
}));

vi.mock('./BoardroomAgentFeedView', () => ({
    BoardroomAgentFeedView: () => <div data-testid="mock-agent-feed-view">Agent Feed View</div>,
}));

// Mock Jev judgments
const mockJudgeRecommendation = vi.fn();
vi.mock('@/config/typesafeJudgments', () => ({
    judgeBoardroomWorkspaceRecommendation: (...args: unknown[]) => mockJudgeRecommendation(...args),
}));

// Store mock
const mockStoreState: Record<string, any> = {};

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
        { getState: () => mockStoreState },
    ),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

import { BoardroomWorkspacePane } from './BoardroomWorkspacePane';

describe('BoardroomWorkspacePane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(mockStoreState).forEach(key => delete mockStoreState[key]);
        Object.assign(mockStoreState, {
            boardroomWorkspaceLayout: 'split',
            boardroomWorkspaceTab: 'browser',
            setBoardroomWorkspaceLayout: vi.fn((layout) => { mockStoreState.boardroomWorkspaceLayout = layout; }),
            setBoardroomWorkspaceTab: vi.fn((tab) => { mockStoreState.boardroomWorkspaceTab = tab; }),
            setBoardroomPreviewModuleId: vi.fn(),
            agentHistory: [],
            activeAgents: ['generalist'],
            toggleAgent: vi.fn(),
            soloAgent: vi.fn(),
        });
        mockJudgeRecommendation.mockResolvedValue(null);
    });

    it('renders all 4 tabs and active browser view by default', () => {
        render(<BoardroomWorkspacePane />);

        expect(screen.getByTestId('boardroom-tab-browser')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-tab-module')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-tab-workbench')).toBeInTheDocument();
        expect(screen.getByTestId('boardroom-tab-agent-feed')).toBeInTheDocument();

        expect(screen.getByTestId('mock-browser-view')).toBeInTheDocument();
    });

    it('switches tabs on click', () => {
        render(<BoardroomWorkspacePane />);

        const moduleTab = screen.getByTestId('boardroom-tab-module');
        fireEvent.click(moduleTab);

        expect(mockStoreState.setBoardroomWorkspaceTab).toHaveBeenCalledWith('module');
    });

    it('renders Jev suggestion pill when recommendation differs from active tab', async () => {
        mockStoreState.agentHistory = [
            { id: '1', role: 'user', text: 'Let us inspect the split sheet agreement' },
        ];
        mockJudgeRecommendation.mockResolvedValue({
            recommendedTab: 'workbench',
            recommendedModule: 'legal',
            confidence: 0.95,
            reasoningHint: 'Contract & split sheet discussion detected',
            source: 'jev',
        });

        render(<BoardroomWorkspacePane />);

        await waitFor(() => {
            expect(screen.getByTestId('boardroom-workspace-jev-suggestion')).toBeInTheDocument();
        });

        const pill = screen.getByTestId('boardroom-workspace-jev-suggestion');
        expect(pill).toHaveTextContent(/Suggested:/i);
        expect(pill).toHaveTextContent(/Asset Workbench/i);

        fireEvent.click(pill);
        expect(mockStoreState.setBoardroomWorkspaceTab).toHaveBeenCalledWith('workbench');
    });

    it('closes the workspace when close button is clicked', () => {
        render(<BoardroomWorkspacePane />);

        const closeBtn = screen.getByTestId('boardroom-workspace-close-btn');
        fireEvent.click(closeBtn);

        expect(mockStoreState.setBoardroomWorkspaceLayout).toHaveBeenCalledWith('closed');
    });

    it('hides the embedded browser viewport when overlays or command menu open', () => {
        const view = render(<BoardroomWorkspacePane hasOverlayOpen={false} />);
        expect(screen.getByTestId('mock-browser-view')).toHaveAttribute('data-visible', 'true');

        view.rerender(<BoardroomWorkspacePane hasOverlayOpen={true} />);
        expect(screen.getByTestId('mock-browser-view')).toHaveAttribute('data-visible', 'false');

        mockStoreState.isCommandMenuOpen = true;
        view.rerender(<BoardroomWorkspacePane hasOverlayOpen={false} />);
        expect(screen.getByTestId('mock-browser-view')).toHaveAttribute('data-visible', 'false');
    });
    it('does not call the paid workspace judge per streamed token, only once the reply settles', async () => {
        vi.useFakeTimers();
        try {
            mockStoreState.agentHistory = [
                { id: 'u1', role: 'user', text: 'Plan the release rollout' },
                { id: 'm1', role: 'model', text: 'Draft', isStreaming: true },
            ];
            const view = render(<BoardroomWorkspacePane />);

            for (let i = 0; i < 25; i++) {
                mockStoreState.agentHistory = [
                    mockStoreState.agentHistory[0],
                    { id: 'm1', role: 'model', text: `Draft token ${i}`, isStreaming: true },
                ];
                view.rerender(<BoardroomWorkspacePane />);
                await vi.advanceTimersByTimeAsync(50);
            }
            await vi.advanceTimersByTimeAsync(5_000);
            expect(mockJudgeRecommendation).not.toHaveBeenCalled();

            mockStoreState.agentHistory = [
                mockStoreState.agentHistory[0],
                { id: 'm1', role: 'model', text: 'Final answer', isStreaming: false },
            ];
            view.rerender(<BoardroomWorkspacePane />);
            view.rerender(<BoardroomWorkspacePane />);
            await vi.advanceTimersByTimeAsync(5_000);

            expect(mockJudgeRecommendation).toHaveBeenCalledTimes(1);
            expect(mockJudgeRecommendation).toHaveBeenCalledWith(mockStoreState.agentHistory);
        } finally {
            vi.useRealTimers();
        }
    });
});
