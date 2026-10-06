import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock motion/react
vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
            <div ref={ref} {...props}>{children}</div>
        )),
    },
}));

// Mock store
const mockAddActiveAgent = vi.fn();
const mockSetCommandBarInput = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) =>
        selector({
            addActiveAgent: mockAddActiveAgent,
            setCommandBarInput: mockSetCommandBarInput,
        }),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

import { BoardroomStarterCards, EXECUTIVE_STARTER_CARDS } from './BoardroomStarterCards';

describe('BoardroomStarterCards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all 4 executive starter cards with title and badge', () => {
        render(<BoardroomStarterCards />);

        expect(screen.getByText('Executive Business Starters')).toBeInTheDocument();

        EXECUTIVE_STARTER_CARDS.forEach(card => {
            expect(screen.getByTestId(`starter-card-${card.id}`)).toBeInTheDocument();
            expect(screen.getByText(card.title)).toBeInTheDocument();
            expect(screen.getByText(card.badgeText)).toBeInTheDocument();
        });
    });

    it('seats required agents and populates command prompt on click', () => {
        render(<BoardroomStarterCards />);

        const splitSheetCard = screen.getByTestId('starter-card-split-sheet');
        fireEvent.click(splitSheetCard);

        expect(mockAddActiveAgent).toHaveBeenCalledWith('legal');
        expect(mockAddActiveAgent).toHaveBeenCalledWith('finance');
        expect(mockSetCommandBarInput).toHaveBeenCalledWith(
            expect.stringContaining('Draft a standard 50/50 co-writer split sheet')
        );
    });

    it('triggers action on keyboard Enter or Space', () => {
        render(<BoardroomStarterCards />);

        const masterAuditCard = screen.getByTestId('starter-card-master-audit');
        fireEvent.keyDown(masterAuditCard, { key: 'Enter' });

        expect(mockAddActiveAgent).toHaveBeenCalledWith('music');
        expect(mockAddActiveAgent).toHaveBeenCalledWith('distribution');
        expect(mockSetCommandBarInput).toHaveBeenCalledWith(
            expect.stringContaining('Audit my latest master recording')
        );
    });
});
