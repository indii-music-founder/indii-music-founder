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
    it('marks future resource tabs as unavailable', () => {
        render(<MarketingSidebar activeTab="campaigns" onTabChange={vi.fn()} />);

        expect(screen.getByRole('button', { name: /calendar.*soon/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /analytics.*soon/i })).toBeDisabled();
        expect(screen.getAllByText('Soon')).toHaveLength(5);
    });
});
