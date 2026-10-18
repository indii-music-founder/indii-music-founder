import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

const toggleAgent = vi.fn();
const soloAgent = vi.fn();
const setFocusedHeadId = vi.fn();

const storeState = {
    activeAgents: ['generalist', 'social', 'finance'],
    activeGraphExecution: null,
    focusedHeadId: null,
    toggleAgent,
    soloAgent,
    setFocusedHeadId,
};

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('motion/react', () => ({
    motion: {
        button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>>(
            ({ children, initial: _initial, animate: _animate, transition: _transition, whileHover: _whileHover, whileTap: _whileTap, drag: _drag, dragSnapToOrigin: _dragSnapToOrigin, onDragEnd: _onDragEnd, ...props }, ref) => (
                <button ref={ref} {...props}>{children}</button>
            ),
        ),
        div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
            <div {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

import ParticipantSelector, {
    BOARDROOM_PRIMARY_HEAD_IDS,
    calculateParticipantSeatLayout,
    type ParticipantSeatLayout,
} from './ParticipantSelector';

function minimumSeatDistance(layout: ParticipantSeatLayout): number {
    let minimum = Number.POSITIVE_INFINITY;
    for (let left = 0; left < layout.seats.length; left += 1) {
        for (let right = left + 1; right < layout.seats.length; right += 1) {
            minimum = Math.min(
                minimum,
                Math.hypot(
                    layout.seats[left]!.x - layout.seats[right]!.x,
                    layout.seats[left]!.y - layout.seats[right]!.y,
                ),
            );
        }
    }
    return minimum;
}

describe('ParticipantSelector primary department head pills', () => {
    beforeEach(() => {
        toggleAgent.mockClear();
        soloAgent.mockClear();
        setFocusedHeadId.mockClear();
    });

    it('renders the 9 core department head pills on the boardroom table', () => {
        render(<ParticipantSelector />);

        expect(BOARDROOM_PRIMARY_HEAD_IDS).toEqual([
            'marketing',
            'finance',
            'legal',
            'brand',
            'creative',
            'video',
            'social',
            'publishing',
            'music',
        ]);

        for (const headId of BOARDROOM_PRIMARY_HEAD_IDS) {
            expect(screen.getByTestId(`boardroom-seat-${headId}`)).toBeInTheDocument();
        }
    });

    it.each([
        { width: 480, height: 360, mode: 'compact', ringCounts: [6, 8, 9], diameter: 34 },
        { width: 720, height: 500, mode: 'compact', ringCounts: [6, 8, 9], diameter: 34 },
        { width: 900, height: 620, mode: 'wide', ringCounts: [9, 14], diameter: 44 },
        { width: 1280, height: 760, mode: 'wide', ringCounts: [9, 14], diameter: 44 },
    ] as const)(
        'keeps seat layout math bounded and non-overlapping at $width×$height',
        ({ width, height, mode, ringCounts, diameter }) => {
            const layout = calculateParticipantSeatLayout(23, width, height);

            expect(layout.mode).toBe(mode);
            expect(layout.ringCounts).toEqual(ringCounts);
            expect(layout.seatDiameter).toBe(diameter);
            expect(layout.seats).toHaveLength(23);
            expect(Object.isFrozen(layout)).toBe(true);
            expect(Object.isFrozen(layout.seats)).toBe(true);
            expect(new Set(layout.seats.map(seat => `${seat.x}:${seat.y}`)).size).toBe(23);
            expect(minimumSeatDistance(layout)).toBeGreaterThanOrEqual(diameter + 2);
            expect(layout.centerClearance).toBeGreaterThan(diameter);
        },
    );

    it('renders Social with a readable pill label, department accent, and toggles seat on click', () => {
        render(<ParticipantSelector />);

        const social = screen.getByTestId('boardroom-seat-social');
        const identity = resolveAgentVisualIdentity('social');
        expect(social).toHaveAttribute('data-agent-accent', identity.accent);
        expect(social).toHaveAttribute('data-agent-icon', 'share-2');
        expect(social).toHaveAttribute('data-seat-ring', '0');
        expect(social).toHaveAttribute('aria-pressed', 'true');
        expect(social).toHaveAttribute('role', 'button');
        expect(social).toHaveTextContent('Social');
        expect(social.querySelector('svg')).toBeInTheDocument();

        fireEvent.click(social);
        expect(toggleAgent).toHaveBeenCalledWith('social');
    });

    it('solos an agent when clicking their console Solo button', () => {
        render(<ParticipantSelector />);

        const soloFinanceBtn = screen.getByLabelText('Solo Finance');
        fireEvent.click(soloFinanceBtn);
        expect(soloAgent).toHaveBeenCalledWith('finance');
    });

    it('expands satellite hierarchy branch for departments with sub-agents', () => {
        render(<ParticipantSelector />);

        const expandFinanceBtn = screen.getByLabelText('Expand Finance sub-agents');
        fireEvent.click(expandFinanceBtn);
        expect(setFocusedHeadId).toHaveBeenCalledWith('finance');
    });
});
