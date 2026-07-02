import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DevopsDashboard from './DevopsDashboard';

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/layout/ThreePanelDashboard', () => ({
    ThreePanelDashboard: ({ children, leftPanel, rightPanel }: React.PropsWithChildren<{ leftPanel: React.ReactNode; rightPanel: React.ReactNode }>) => (
        <div>
            <div>{leftPanel}</div>
            <div>{rightPanel}</div>
            <div>{children}</div>
        </div>
    ),
}));

describe('DevopsDashboard', () => {
    it('renders a read-only DevOps surface without mock action buttons', () => {
        render(<DevopsDashboard />);

        expect(screen.getAllByText('Live DevOps integrations are not configured in this build. This dashboard is read-only until real CI, telemetry, and test runners are wired up.')).toHaveLength(2);
        expect(screen.queryByRole('button', { name: /deploy production/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /run tests/i })).not.toBeInTheDocument();
    });
});
