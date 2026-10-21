import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MarketingSidebar } from './MarketingSidebar';

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, layoutId, ...props }: React.PropsWithChildren<Record<string, unknown>> & { layoutId?: unknown }) => <div {...props}>{children}</div>,
    },
}));

// Structural-only component checks; deployed keyboard and navigation acceptance is separate.
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
    it('shows one destination group at a time and keeps every tool reachable', () => {
        const onTabChange = vi.fn();
        const { rerender } = render(<MarketingSidebar activeTab="campaigns" onTabChange={onTabChange} />);
        expect(screen.getByRole('button', { name: 'Overview', expanded: true })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Asset Generator' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Release Assets', expanded: false }));
        expect(screen.queryByRole('button', { name: 'Campaigns' })).not.toBeInTheDocument();
        const releaseGroup = screen.getByRole('group', { name: 'Release Assets destinations' });
        expect(within(releaseGroup).getAllByRole('button')).toHaveLength(4);
        fireEvent.click(within(releaseGroup).getByRole('button', { name: 'Press Kit (EPK)' }));
        expect(onTabChange).toHaveBeenCalledWith('epk');

        rerender(<MarketingSidebar activeTab="email" onTabChange={onTabChange} />);
        expect(screen.getByRole('button', { name: 'Channels', expanded: true })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Email Marketing' })).toHaveAttribute('aria-current', 'page');
        expect(screen.queryByRole('button', { name: 'Press Kit (EPK)' })).not.toBeInTheDocument();
    });

});
