import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const toast = { success: vi.fn(), info: vi.fn(), error: vi.fn() };
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => toast }));

const mockStoreState: Record<string, unknown> = {};
vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
        { getState: () => mockStoreState, setState: (patch: Record<string, unknown>) => Object.assign(mockStoreState, patch) },
    ),
}));
vi.mock('zustand/react/shallow', () => ({ useShallow: (fn: unknown) => fn }));

import { BoardroomAgentFeedView } from './BoardroomAgentFeedView';

type ComputerApi = { abort: ReturnType<typeof vi.fn>; resetAbort: ReturnType<typeof vi.fn>; getAbortState: ReturnType<typeof vi.fn> };
const win = window as unknown as { electronAPI?: { computer?: ComputerApi } };

describe('BoardroomAgentFeedView emergency abort (ISSUE-1629)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(mockStoreState, {
            activeGraphExecution: null,
            a2aMessages: [],
            openBoardroomBrowser: vi.fn(),
            stopAgent: vi.fn(),
            agentAbortController: new AbortController(),
        });
    });
    afterEach(() => {
        delete win.electronAPI;
    });

    it('stops the running agent on the web instead of only showing a toast', () => {
        render(<BoardroomAgentFeedView />);
        fireEvent.click(screen.getByTestId('boardroom-emergency-abort-btn'));
        expect(mockStoreState.stopAgent).toHaveBeenCalledTimes(1);
    });

    it('shows the empty graph state without claiming monitoring is active', () => {
        render(<BoardroomAgentFeedView />);
        expect(screen.getByText('No active graph pipeline currently running.')).toBeVisible();
        expect(screen.queryByText('ACTIVE MONITOR')).not.toBeInTheDocument();
    });

    it('also stops the agent run on desktop, and can resume after the kill switch', async () => {
        win.electronAPI = {
            computer: {
                abort: vi.fn().mockResolvedValue({ success: true, data: { aborted: true } }),
                resetAbort: vi.fn().mockResolvedValue({ success: true, data: { aborted: false } }),
                getAbortState: vi.fn().mockResolvedValue({ success: true, data: { aborted: false } }),
            },
        };
        render(<BoardroomAgentFeedView />);
        fireEvent.click(screen.getByTestId('boardroom-emergency-abort-btn'));
        await waitFor(() => expect(win.electronAPI!.computer!.abort).toHaveBeenCalled());
        expect(mockStoreState.stopAgent).toHaveBeenCalledTimes(1);

        const resume = await screen.findByTestId('boardroom-resume-autonomy-btn');
        fireEvent.click(resume);
        await waitFor(() => expect(win.electronAPI!.computer!.resetAbort).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByTestId('boardroom-emergency-abort-btn')).not.toBeDisabled());
    });
});
