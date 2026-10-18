import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toggleAgent = vi.fn();
const soloAgent = vi.fn();
const clearReferencedAssets = vi.fn();

const storeState = {
    activeAgents: ['generalist', 'marketing', 'finance'],
    soloAgent,
    toggleAgent,
    referencedAssets: [],
    clearReferencedAssets,
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

import { BoardroomRightRail } from './BoardroomRightRail';
import { useStore } from '@/core/store';

describe('BoardroomRightRail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeState.activeAgents = ['generalist', 'marketing', 'finance'];
        storeState.soloAgent = soloAgent;
    });

    it('renders the collapsed rail navigation tabs', () => {
        render(<BoardroomRightRail />);
        expect(screen.getByTestId('boardroom-right-rail')).toBeInTheDocument();
        expect(screen.getByTitle('Standards & Resources')).toBeInTheDocument();
        expect(screen.getByTitle('Room Presets & Console')).toBeInTheDocument();
        expect(screen.getByTitle('Swarm Activity Feed')).toBeInTheDocument();
        expect(screen.getByTitle('Living Plans')).toBeInTheDocument();
    });

    it('opens the rail panel when a tab icon is clicked', () => {
        render(<BoardroomRightRail />);
        const standardsTab = screen.getByTitle('Standards & Resources');
        fireEvent.click(standardsTab);

        expect(screen.getByText('Standards & Resources')).toBeInTheDocument();
        expect(screen.getByText('Operational Limits')).toBeInTheDocument();
        expect(screen.getByText('Gemini 3 Pro')).toBeInTheDocument();
        expect(screen.getByText('2,000,000 tokens')).toBeInTheDocument();
        expect(screen.getByText('Boardroom Standards')).toBeInTheDocument();
    });

    it('switches between tabs and displays room presets actions', () => {
        render(<BoardroomRightRail />);
        const presetsTab = screen.getByTitle('Room Presets & Console');
        fireEvent.click(presetsTab);

        expect(screen.getByText('Room Presets & Console')).toBeInTheDocument();
        expect(screen.getByText('Convene Primary Swarm')).toBeInTheDocument();
        expect(screen.getByText('Solo indii Conductor')).toBeInTheDocument();

        // Click Convene Primary Swarm
        const seatAllButton = screen.getByText('Convene Primary Swarm');
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
        const feedTab = screen.getByTitle('Swarm Activity Feed');
        fireEvent.click(feedTab);

        const openFeedBtn = screen.getByText('Open Full Swarm Collaboration Feed');
        fireEvent.click(openFeedBtn);
        expect(onOpenSwarmFeed).toHaveBeenCalledTimes(1);
    });

    it('closes the panel when the chevron close button is clicked', () => {
        render(<BoardroomRightRail />);
        const standardsTab = screen.getByTitle('Standards & Resources');
        fireEvent.click(standardsTab);

        expect(screen.getByText('Operational Limits')).toBeInTheDocument();

        const closeBtn = screen.getByLabelText('Close Rail');
        fireEvent.click(closeBtn);

        expect(screen.queryByText('Operational Limits')).not.toBeInTheDocument();
    });
});
