import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...filterDomProps(p)}>{children}</div>),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

let mockStore: Record<string, unknown> = {};
vi.mock('@/core/store', () => ({ useStore: (s: (st: Record<string, unknown>) => unknown) => s(mockStore) }));
vi.mock('zustand/react/shallow', () => ({ useShallow: (fn: unknown) => fn }));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/utils', () => ({ cn: (...args: string[]) => args.filter(Boolean).join(' ') }));

import DesktopDashboard from './DesktopDashboard';
import { ResourceBar } from './components/ResourceBar';
import { SettingCard } from './components/SettingCard';

describe('DesktopDashboard', () => {
    beforeEach(() => { mockStore = { userProfile: { id: 'u1' }, currentProjectId: 'p1' }; });

    it('renders the title', () => {
        render(<DesktopDashboard />);
        expect(screen.getByText('DESKTOP INTEGRATION')).toBeInTheDocument();
    });

    it('renders all 5 setting cards', () => {
        render(<DesktopDashboard />);
        expect(screen.getByText('Run on System Startup')).toBeInTheDocument();
        expect(screen.getByText('Hardware Acceleration')).toBeInTheDocument();
        expect(screen.getByText('Offline Vault Synchronization')).toBeInTheDocument();
        expect(screen.getByText('Global Command Shortcuts')).toBeInTheDocument();
        expect(screen.getByText('Background Agent Daemon')).toBeInTheDocument();
    });

    it('shows daemon status', () => {
        render(<DesktopDashboard />);
        expect(screen.getByText('ELECTRON DAEMON ACTIVE')).toBeInTheDocument();
    });
});

describe('SettingCard', () => {
    it('renders enabled state', () => {
        const onClick = vi.fn();
        const { container } = render(<SettingCard icon={() => <span>IC</span>} title="Test" description="Desc" enabled={true} onClick={onClick} />);
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('Desc')).toBeInTheDocument();
    });
});
