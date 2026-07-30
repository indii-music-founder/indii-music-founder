import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listHeadIds } from '@/services/agent/departments';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

const toggleAgent = vi.fn();
const storeState = {
    activeAgents: ['generalist', 'social', 'finance'],
    activeGraphExecution: null,
    toggleAgent,
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

describe('ParticipantSelector canonical visual identities', () => {
    beforeEach(() => {
        toggleAgent.mockClear();
    });

    it('renders every canonical ISSUE-1291 head without a hardcoded eight-seat map', () => {
        render(<ParticipantSelector />);

        const canonicalHeads = listHeadIds();
        expect(canonicalHeads).toHaveLength(23);
        for (const headId of canonicalHeads) {
            expect(screen.getByTestId(`boardroom-seat-${headId}`)).toBeInTheDocument();
        }
    });

    it.each([
        { width: 480, height: 360, mode: 'compact', ringCounts: [6, 8, 9], diameter: 34 },
        { width: 720, height: 500, mode: 'compact', ringCounts: [6, 8, 9], diameter: 34 },
        { width: 900, height: 620, mode: 'wide', ringCounts: [9, 14], diameter: 44 },
        { width: 1280, height: 760, mode: 'wide', ringCounts: [9, 14], diameter: 44 },
    ] as const)(
        'keeps 23 heads bounded and non-overlapping at $width×$height',
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

            for (const seat of layout.seats) {
                expect(seat.x - diameter / 2).toBeGreaterThanOrEqual(0);
                expect(seat.x + diameter / 2).toBeLessThanOrEqual(width);
                expect(seat.y - diameter / 2).toBeGreaterThanOrEqual(0);
                expect(seat.y + diameter / 2).toBeLessThanOrEqual(height);
            }
        },
    );

    it('keeps Social cyan with its visible name, initials, and share icon', () => {
        render(<ParticipantSelector />);

        const social = screen.getByTestId('boardroom-seat-social');
        const identity = resolveAgentVisualIdentity('social');
        expect(social).toHaveAttribute('data-agent-accent', '#00BCD4');
        expect(social).toHaveAttribute('data-agent-icon', 'share-2');
        expect(social).toHaveAttribute('data-seat-ring');
        expect(social).toHaveAttribute('aria-pressed', 'true');
        expect(social.tagName).toBe('BUTTON');
        expect(social).toHaveStyle({
            backgroundColor: identity.surface,
            borderColor: identity.border,
            color: identity.foreground,
            width: '44px',
            height: '44px',
        });
        expect(social).toHaveTextContent('SM');
        expect(social).toHaveTextContent('Social Media Director');
        expect(social.querySelector('svg')).toBeInTheDocument();
        expect(social.querySelector('.opacity-0')).toHaveTextContent('Social Media Director');
    });

    it('shows Finance workers with their stable lower-emphasis department variant', () => {
        render(<ParticipantSelector />);
        fireEvent.click(screen.getByTestId('boardroom-seat-finance'));

        const worker = document.querySelector('[data-agent-id="finance.tax"]');
        const workerIdentity = resolveAgentVisualIdentity('finance.tax');
        const headIdentity = resolveAgentVisualIdentity('finance');
        expect(worker).toBeInTheDocument();
        expect(worker).toHaveAttribute('data-agent-role', 'worker');
        expect(worker).toHaveAttribute('data-agent-icon', 'calculator');
        expect(worker).toHaveStyle({
            backgroundColor: workerIdentity.surface,
            borderColor: workerIdentity.border,
        });
        expect(workerIdentity.cssProperties['--agent-source-accent']).toBe(
            headIdentity.cssProperties['--agent-source-accent'],
        );
        expect(workerIdentity.accent).not.toBe(headIdentity.accent);
    });
});
