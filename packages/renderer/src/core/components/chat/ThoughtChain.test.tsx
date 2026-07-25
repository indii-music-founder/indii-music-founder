import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThoughtChain } from './ThoughtChain';

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('ThoughtChain', () => {
    const thoughts = [{
        id: 'thought-1',
        text: 'Analyzing the request',
        timestamp: Date.now(),
        type: 'logic' as const,
    }];

    it('is collapsed by default and can be expanded', () => {
        render(<ThoughtChain thoughts={thoughts} messageId="message-1" />);

        const toggle = screen.getByRole('button', { name: /cognitive logic/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Analyzing the request')).not.toBeInTheDocument();

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Analyzing the request')).toBeInTheDocument();
    });

    it('honors an expanded-by-default preference for a new message card', () => {
        render(<ThoughtChain thoughts={thoughts} messageId="message-2" defaultOpen />);

        expect(screen.getByRole('button', { name: /cognitive logic/i })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Analyzing the request')).toBeInTheDocument();
    });
});
