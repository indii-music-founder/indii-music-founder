import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MobileTabBar } from './MobileTabBar';
import { useStore } from '../store';

// ISSUE-1437: the phone "More" drawer must apply the same feature-flag gating the
// desktop Sidebar applies, must not offer the phantom `audio-analyzer` destination,
// and must give the phone its only reachable entry points to files/notes/project-canvas.

vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

vi.mock('@/hooks/useMobile', () => ({
    useMobile: () => ({ isAnyPhone: true }),
}));

const mockCanAccessModule = vi.fn(() => true);
vi.mock('@/core/context/OrganizationAccessContext', () => ({
    useOrganizationAccess: () => ({ canAccessModule: mockCanAccessModule }),
}));

// Prod-like default: merch (MERCH_STORE) and the dev-only shells are gated off.
const mockGatedModules = vi.fn<() => Set<string>>(() => new Set(['merch', 'debug', 'capture', 'desktop', 'memory', 'select-org']));
vi.mock('@/config/featureFlags', () => ({
    useGatedModules: () => mockGatedModules(),
}));

vi.mock('@/lib/mobile', () => ({
    haptic: vi.fn(),
}));

vi.mock('@/modules/capture/QuickCapture', () => ({
    QuickCapture: () => null,
}));

vi.mock('@/hooks/useFocusTrap', () => ({
    useFocusTrap: () => ({ current: null }),
}));

vi.mock('@/hooks/useGlobalShortcut', () => ({
    useGlobalShortcut: vi.fn(),
}));

vi.mock('../theme/moduleColors', () => ({
    getColorForModule: () => ({
        cssVar: '--color-test',
        text: 'text-test',
        bg: 'bg-test',
        hoverText: 'hover:text-test',
        hoverBg: 'hover:bg-test',
        border: 'border-test',
    }),
}));

function mockStore(overrides: Record<string, unknown> = {}) {
    const state = {
        currentModule: 'dashboard',
        setModule: vi.fn(),
        isAgentOpen: false,
        ...overrides,
    };
    (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector?: (s: typeof state) => unknown) => {
        if (selector && typeof selector === 'function') return selector(state);
        return state;
    });
    (useStore as unknown as { getState: ReturnType<typeof vi.fn> }).getState = vi.fn(() => state);
    (useStore as unknown as { setState: ReturnType<typeof vi.fn> }).setState = vi.fn();
    return state;
}

function openMoreDrawer() {
    fireEvent.click(screen.getByRole('tab', { name: 'More' }));
}

describe('MobileTabBar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCanAccessModule.mockReturnValue(true);
        mockGatedModules.mockReturnValue(new Set(['merch', 'debug', 'capture', 'desktop', 'memory', 'select-org']));
        mockStore();
    });

    it('offers Files and Project Canvas in the More drawer; Notes folded into Knowledge Base (ISSUE-1442)', () => {
        render(<MobileTabBar />);
        openMoreDrawer();

        expect(screen.getByRole('button', { name: 'Files' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Project Canvas' })).toBeInTheDocument();
        // Stage 2 fold: Notes is a Knowledge Base tab now, not a destination.
        expect(screen.queryByRole('button', { name: 'Notes' })).not.toBeInTheDocument();
    });

    it('never offers the phantom Audio Analyzer destination (ISSUE-1437)', () => {
        render(<MobileTabBar />);
        openMoreDrawer();

        // The id silently rewrites to Distribution/QC in appSlice — offering it as a
        // destination landed users in a module the label never promised.
        expect(screen.queryByText('Audio Analyzer')).not.toBeInTheDocument();
        // The real destination stays reachable.
        expect(screen.getByRole('button', { name: 'Distribution' })).toBeInTheDocument();
    });

    it('filters feature-flag-gated modules out of the More drawer (ISSUE-1437)', () => {
        render(<MobileTabBar />);
        openMoreDrawer();

        // merch is gated by MERCH_STORE in production — tapping it used to land on
        // GatedModuleFallback because the drawer only checked org access.
        expect(screen.queryByText('Merchandise')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Workflow Builder' })).toBeInTheDocument();
    });

    it('navigates to files from the Workspace section', () => {
        const state = mockStore();
        render(<MobileTabBar />);
        openMoreDrawer();

        fireEvent.click(screen.getByRole('button', { name: 'Files' }));
        expect(state.setModule).toHaveBeenCalledWith('files');
    });

    it('hides modules the organization denies access to', () => {
        mockCanAccessModule.mockReturnValue(false);
        render(<MobileTabBar />);
        openMoreDrawer();

        expect(screen.queryByRole('button', { name: 'Files' })).not.toBeInTheDocument();
    });
});
