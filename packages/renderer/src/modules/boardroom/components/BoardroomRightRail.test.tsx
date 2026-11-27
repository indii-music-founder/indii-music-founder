import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toggleAgent = vi.fn();
const soloAgent = vi.fn();
const clearReferencedAssets = vi.fn();
const removeReferencedAsset = vi.fn();
const requestBoardroomBrowserGrant = vi.fn();

const storeState = {
    activeAgents: ['generalist', 'marketing', 'finance'],
    soloAgent,
    toggleAgent,
    referencedAssets: [] as { id: string; name: string; type: string }[],
    clearReferencedAssets,
    removeReferencedAsset,
    boardroomHostedBrowserActive: false,
    requestBoardroomBrowserGrant,
    a2aMessages: [] as Array<{ id: string; fromAgent: string; toAgent: string; requiresApproval?: boolean; approved?: boolean }>,
    isAgentProcessing: false,
    agentHistory: [] as Array<{ agentId?: string; isStreaming?: boolean; metadata?: Record<string, unknown> }>,
};

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        (selector: (state: typeof storeState) => unknown) => selector(storeState),
        {
            setState: vi.fn((update: Partial<typeof storeState> | ((prev: typeof storeState) => Partial<typeof storeState>)) => {
                if (typeof update === 'function') {
                    Object.assign(storeState, update(storeState));
                } else {
                    Object.assign(storeState, update);
                }
            }),
        },
    ),
}));

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
            <div {...props}>{children}</div>
        ),
        button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>>(
            ({ children, initial: _initial, animate: _animate, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, ...props }, ref) => (
                <button ref={ref} {...props}>{children}</button>
            ),
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import { BoardroomRightRail } from '@/modules/boardroom/components/BoardroomRightRail';
import { useStore } from '@/core/store';

describe('BoardroomRightRail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState.activeAgents = ['generalist', 'marketing', 'finance'];
        storeState.referencedAssets = [];
        storeState.soloAgent = soloAgent;
        storeState.boardroomHostedBrowserActive = false;
        storeState.a2aMessages = [];
        storeState.isAgentProcessing = false;
        storeState.agentHistory = [];
    });

    it('renders the collapsed rail navigation tabs', () => {
        render(<BoardroomRightRail />);
        expect(screen.getByTestId('boardroom-right-rail')).toBeInTheDocument();
        expect(screen.getByTitle('Standards & Resources')).toBeInTheDocument();
        expect(screen.getByTitle('Room Presets & Console')).toBeInTheDocument();
        expect(screen.getByTitle('Team Activity')).toBeInTheDocument();
        expect(screen.getByTitle('Living Plans')).toBeInTheDocument();
    });

    it('opens the rail panel when a tab icon is clicked', () => {
        render(<BoardroomRightRail />);
        const standardsTab = screen.getByTitle('Standards & Resources');
        fireEvent.click(standardsTab);

        expect(screen.getByText('Standards & Resources')).toBeInTheDocument();
        expect(screen.getByText('Boardroom Standards')).toBeInTheDocument();
        expect(screen.queryByText('Gemini 3 Pro')).not.toBeInTheDocument();
        expect(screen.queryByText('2,000,000 tokens')).not.toBeInTheDocument();
        expect(screen.queryByText('Optimal')).not.toBeInTheDocument();
    });

    it('offers a named remove action for each reference', () => {
        storeState.referencedAssets = [{ id: 'cover', name: 'Album cover', type: 'url' }];
        render(<BoardroomRightRail />);
        fireEvent.click(screen.getByTitle('Standards & Resources'));
        fireEvent.click(screen.getByRole('button', { name: 'Remove reference: Album cover' }));
        expect(removeReferencedAsset).toHaveBeenCalledWith('cover');
        expect(clearReferencedAssets).not.toHaveBeenCalled();
    });

    it('switches between tabs and displays room presets actions', () => {
        render(<BoardroomRightRail />);
        const presetsTab = screen.getByTitle('Room Presets & Console');
        fireEvent.click(presetsTab);

        expect(screen.getByText('Room Presets & Console')).toBeInTheDocument();
        expect(screen.getByText('Seat the Core Team')).toBeInTheDocument();
        expect(screen.getByText('Solo indii Conductor')).toBeInTheDocument();

        // Click Seat the Core Team
        const seatAllButton = screen.getByText('Seat the Core Team');
        fireEvent.click(seatAllButton);
        expect(useStore.setState).toHaveBeenCalledWith(
            expect.objectContaining({
                activeAgents: expect.arrayContaining(['generalist', 'marketing', 'finance']),
            }),
        );
    });

    it('handles Solo Conductor action', () => {
        render(<BoardroomRightRail />);
        const presetsTab = screen.getByTitle('Room Presets & Console');
        fireEvent.click(presetsTab);

        const soloConductorButton = screen.getByText('Solo indii Conductor');
        fireEvent.click(soloConductorButton);
        expect(soloAgent).toHaveBeenCalledWith('generalist');
    });

    it('triggers external handlers for Living Plans drawer and Swarm Feed', () => {
        const onOpenLivingPlans = vi.fn();
        const onOpenSwarmFeed = vi.fn();

        render(
            <BoardroomRightRail
                onOpenLivingPlans={onOpenLivingPlans}
                onOpenSwarmFeed={onOpenSwarmFeed}
            />,
        );

        // Switch to Living Plans tab
        const plansTab = screen.getByTitle('Living Plans');
        fireEvent.click(plansTab);

        const openPlansBtn = screen.getByText('Open Living Plans Drawer');
        fireEvent.click(openPlansBtn);
        expect(onOpenLivingPlans).toHaveBeenCalledTimes(1);

        // Switch to Swarm Feed tab
        const feedTab = screen.getByTitle('Team Activity');
        fireEvent.click(feedTab);

        const openFeedBtn = screen.getByText('Open Full Team Activity');
        fireEvent.click(openFeedBtn);
        expect(onOpenSwarmFeed).toHaveBeenCalledTimes(1);
    });

    it('closes the panel when the chevron close button is clicked', () => {
        render(<BoardroomRightRail />);
        const standardsTab = screen.getByTitle('Standards & Resources');
        fireEvent.click(standardsTab);

        expect(screen.getByText('Boardroom Standards')).toBeInTheDocument();

        const closeBtn = screen.getByLabelText('Close Rail');
        fireEvent.click(closeBtn);

        expect(screen.queryByText('Boardroom Standards')).not.toBeInTheDocument();
    });

    it('exposes Solo and conditional Grant browser control actions in the agent team panel (Spec L4)', () => {
        const view = render(<BoardroomRightRail />);
        fireEvent.click(screen.getByRole('button', { name: /Marketing · Idle/i }));

        fireEvent.click(screen.getByRole('button', { name: 'Solo' }));
        expect(soloAgent).toHaveBeenCalledWith('marketing');
        expect(screen.queryByRole('button', { name: /Grant browser control/i })).not.toBeInTheDocument();

        storeState.boardroomHostedBrowserActive = true;
        view.rerender(<BoardroomRightRail />);
        fireEvent.click(screen.getByRole('button', { name: /Grant browser control/i }));
        expect(requestBoardroomBrowserGrant).toHaveBeenCalledWith('marketing');
    });

    it('highlights receiving agent avatar for 2s on new a2aMessage arrival and clears it cleanly (Spec L5)', () => {
        vi.useFakeTimers();
        try {
            const view = render(<BoardroomRightRail />);
            const marketingBtn = screen.getByRole('button', { name: /Marketing · Idle/i });
            expect(marketingBtn).not.toHaveAttribute('data-handoff-highlight');

            storeState.a2aMessages = [{ id: 'handoff-1', fromAgent: 'generalist', toAgent: 'marketing' }];
            view.rerender(<BoardroomRightRail />);
            expect(screen.getByRole('button', { name: /Marketing · Idle/i })).toHaveAttribute('data-handoff-highlight', 'true');

            act(() => {
                vi.advanceTimersByTime(2100);
            });
            expect(screen.getByRole('button', { name: /Marketing · Idle/i })).not.toHaveAttribute('data-handoff-highlight');
        } finally {
            vi.useRealTimers();
        }
    });
});
