import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketingSidebar } from './MarketingSidebar';

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, layoutId, ...props }: React.PropsWithChildren<Record<string, unknown>> & { layoutId?: unknown }) => <div {...props}>{children}</div>,
    },
}));

describe('MarketingSidebar', () => {
    it('hides not-yet-connected resource stubs entirely (ISSUE-1436)', () => {
        render(<MarketingSidebar activeTab="campaigns" onTabChange={vi.fn()} />);

        // Truthful capability: while every secondary destination is a
        // "Not connected yet" stub, the whole Resources section stays unmounted —
        // unbuilt features are not advertised as disabled buttons.
        expect(screen.queryByRole('button', { name: /calendar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /analytics/i })).not.toBeInTheDocument();
        expect(screen.queryByText('Soon')).not.toBeInTheDocument();
        expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    });
});
