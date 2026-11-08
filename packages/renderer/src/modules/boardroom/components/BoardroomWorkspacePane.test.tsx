import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock child view components
vi.mock('./BoardroomBrowserView', () => ({
    BoardroomBrowserView: () => <div data-testid="mock-browser-view">Browser View</div>,
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
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
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
        expect(pill).toHaveTextContent(/Jev Suggests:/i);
        expect(pill).toHaveTextContent(/WORKBENCH/i);

        fireEvent.click(pill);
        expect(mockStoreState.setBoardroomWorkspaceTab).toHaveBeenCalledWith('workbench');
    });

    it('toggles layout between split and stage', () => {
        render(<BoardroomWorkspacePane />);

        const layoutBtn = screen.getByTestId('boardroom-workspace-layout-toggle');
        fireEvent.click(layoutBtn);

        expect(mockStoreState.setBoardroomWorkspaceLayout).toHaveBeenCalledWith('stage');
    });

    it('closes the workspace when close button is clicked', () => {
        render(<BoardroomWorkspacePane />);

        const closeBtn = screen.getByTestId('boardroom-workspace-close-btn');
        fireEvent.click(closeBtn);

        expect(mockStoreState.setBoardroomWorkspaceLayout).toHaveBeenCalledWith('closed');
    });
});
