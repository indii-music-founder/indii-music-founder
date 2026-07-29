import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedCommandMenu } from './UnifiedCommandMenu';
import { useStore } from '@/core/store';

// jsdom doesn't implement scrollIntoView; cmdk calls it on mount to keep the
// selected item in view. Stub it so the dialog can render in tests at all.
Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

vi.mock('@/modules/debug', () => ({
    useBugReport: () => ({ reportBug: vi.fn(), requestFeature: vi.fn() }),
}));

const mockUseGodMode = vi.fn().mockReturnValue({ isGodMode: false, loading: false });
vi.mock('@/hooks/useGodMode', () => ({
    useGodMode: () => mockUseGodMode(),
}));

describe('UnifiedCommandMenu', () => {
    beforeEach(() => {
        mockUseGodMode.mockReturnValue({ isGodMode: false, loading: false });
        (useStore as any).mockReturnValue({
            isCommandMenuOpen: true,
            setCommandMenuOpen: vi.fn(),
            setModule: vi.fn(),
        });
    });

    // ISSUE-1269: the sidebar pill routing to `observability` under the name
    // "Command Center" was removed. This locks in its replacement: a god-mode-only
    // command palette entry under a distinct name, so it cannot silently regain
    // the naming collision with the artist-facing Command Center tab.
    it('hides the ops dashboard entry for non-god-mode users', () => {
        render(<UnifiedCommandMenu />);
        expect(screen.queryByText('Ops Dashboard (Internal)')).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Command Center/i })).not.toBeInTheDocument();
    });

    it('shows the ops dashboard entry under a distinct name in god mode', () => {
        mockUseGodMode.mockReturnValue({ isGodMode: true, loading: false });
        render(<UnifiedCommandMenu />);
        expect(screen.getByText('Ops Dashboard (Internal)')).toBeInTheDocument();
        expect(screen.queryByText('Command Center')).not.toBeInTheDocument();
    });

    it('routes the ops dashboard entry to the observability module', () => {
        mockUseGodMode.mockReturnValue({ isGodMode: true, loading: false });
        const setModule = vi.fn();
        const setCommandMenuOpen = vi.fn();
        (useStore as any).mockReturnValue({
            isCommandMenuOpen: true,
            setCommandMenuOpen,
            setModule,
        });

        render(<UnifiedCommandMenu />);
        screen.getByText('Ops Dashboard (Internal)').closest('[cmdk-item]')?.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        );

        expect(setModule).toHaveBeenCalledWith('observability');
    });
});
