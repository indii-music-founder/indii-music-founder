import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const storeState = {
    activeAgents: ['finance.tax', 'generalist', 'social', 'finance', 'unknown-agent'],
};

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>>(
            ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }, ref) => (
                <div ref={ref} {...props}>{children}</div>
            ),
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/hooks/useFocusTrap', () => ({
    useFocusTrap: () => React.createRef<HTMLDivElement>(),
}));

vi.mock('@/hooks/useGlobalShortcut', () => ({
    useGlobalShortcut: vi.fn(),
}));

import { MobileParticipantDrawer } from './MobileParticipantDrawer';

describe('MobileParticipantDrawer manager visibility', () => {
    it('matches the desktop manager-only roster and does not provide direct activation controls', () => {
        render(<MobileParticipantDrawer isOpen onClose={vi.fn()} />);

        expect(screen.getByText('Seated Managers')).toBeInTheDocument();
        expect(screen.getByText('Social Media Director')).toBeInTheDocument();
        expect(screen.getByText('Finance Director')).toBeInTheDocument();
        expect(screen.queryByText('Marketing Director')).not.toBeInTheDocument();
        expect(document.querySelector('[data-testid="mobile-seated-manager-finance.tax"]')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Social Media Director/i })).not.toBeInTheDocument();
    });
});
