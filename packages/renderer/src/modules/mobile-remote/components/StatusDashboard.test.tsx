import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusDashboard from './StatusDashboard';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['whileTap', 'initial', 'animate', 'transition'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('framer-motion', () => ({
    motion: {
        button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...filterDomProps(props)}>{children}</button>,
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...filterDomProps(props)}>{children}</div>,
    },
}));

vi.mock('@/lib/utils', () => ({
    cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('../MobileRemote', () => ({
    triggerHaptic: vi.fn(),
}));

describe('StatusDashboard', () => {
    it('renders the legal review card as unavailable', () => {
        render(<StatusDashboard connectionStatus="connected" isPaired={true} />);

        expect(screen.getByText('Legal Review')).toBeInTheDocument();
        expect(screen.getByText('Remote legal approvals are not wired up in mobile yet.')).toBeInTheDocument();
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
        expect(screen.getByText('Unavailable').closest('button')).toBeDisabled();
    });
});
