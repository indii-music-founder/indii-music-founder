import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Zap } from 'lucide-react';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalid.includes(key)) filtered[key] = value;
    }
    return filtered;
}

vi.mock('motion/react', () => ({
    motion: {
        div: React.forwardRef(({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...filterDomProps(p)}>{children}</div>),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/lib/utils', () => ({ cn: (...args: string[]) => args.filter(Boolean).join(' ') }));

import DesktopDashboard from './DesktopDashboard';
import { SettingCard } from './components/SettingCard';

describe('DesktopDashboard', () => {
    beforeEach(() => {
        delete (window as unknown as { electronAPI?: unknown }).electronAPI;
    });

    it('renders the title', () => {
        render(<DesktopDashboard />);
        expect(screen.getByText('DESKTOP INTEGRATION')).toBeInTheDocument();
    });

    it('renders capabilities without pretending unavailable settings are enabled', () => {
        render(<DesktopDashboard />);
        expect(screen.getByText('Run on System Startup')).toBeInTheDocument();
        expect(screen.getByText('Hardware Acceleration')).toBeInTheDocument();
        expect(screen.getByText('Offline Vault Synchronization')).toBeInTheDocument();
        expect(screen.getByText('Computer Control Kill Switch')).toBeInTheDocument();
        expect(screen.getByText('Background Agent Daemon')).toBeInTheDocument();
        expect(screen.getAllByText('Not available')).toHaveLength(5);
    });

    it('reports a web session instead of a fake active Electron daemon', () => {
        render(<DesktopDashboard />);
        expect(screen.getByText('WEB SESSION — DESKTOP CONTROLS UNAVAILABLE')).toBeInTheDocument();
        expect(screen.queryByText('ELECTRON DAEMON ACTIVE')).not.toBeInTheDocument();
        expect(screen.getByText('Not exposed')).toBeInTheDocument();
    });

    it('reports only capabilities that the Electron preload proves are present', () => {
        (window as unknown as { electronAPI?: unknown }).electronAPI = {};
        render(<DesktopDashboard />);
        expect(screen.getByText('ELECTRON DESKTOP CONNECTED')).toBeInTheDocument();
        expect(screen.getByText('Runtime managed')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
    });
});

describe('SettingCard', () => {
    it('renders an explicit capability status', () => {
        render(<SettingCard icon={Zap} title="Test" description="Desc" status="managed" />);
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('Desc')).toBeInTheDocument();
        expect(screen.getByText('Runtime managed')).toBeInTheDocument();
    });
});
