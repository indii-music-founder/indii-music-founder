import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedCommandMenu } from './UnifiedCommandMenu';
import { useStore } from '@/core/store';
import { judgeCommandIntent } from '@/config/typesafeJudgments';

// jsdom doesn't implement scrollIntoView; cmdk calls it on mount to keep the
// selected item in view. Stub it so the dialog can render in tests at all.
Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

vi.mock('@/config/typesafeJudgments', () => ({
    judgeCommandIntent: vi.fn(),
}));

vi.mock('@/modules/debug', () => ({
    useBugReport: () => ({ reportBug: vi.fn(), requestFeature: vi.fn() }),
}));

const mockUseGodMode = vi.fn().mockReturnValue({ isGodMode: false, loading: false });
vi.mock('@/hooks/useGodMode', () => ({
    useGodMode: () => mockUseGodMode(),
}));

const mockCanAccessModule = vi.fn((_id: string) => true);
vi.mock('@/core/context/OrganizationAccessContext', () => ({
    useOrganizationAccess: () => ({ canAccessModule: mockCanAccessModule }),
}));

// Nothing gated by default (dev-mode parity); the gating test overrides this.
const mockGatedModules = vi.fn<() => Set<string>>(() => new Set());
vi.mock('@/config/featureFlags', () => ({
    useGatedModules: () => mockGatedModules(),
}));

function mockFlatStore(overrides: Record<string, unknown> = {}) {
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        isCommandMenuOpen: true,
        setCommandMenuOpen: vi.fn(),
        setModule: vi.fn(),
        currentModule: 'dashboard',
        ...overrides,
    });
}

describe('UnifiedCommandMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseGodMode.mockReturnValue({ isGodMode: false, loading: false });
        mockCanAccessModule.mockReturnValue(true);
        mockGatedModules.mockReturnValue(new Set());
        mockFlatStore();
    });

    it('opens with the global shortcut while closed', () => {
        const setCommandMenuOpen = vi.fn();
        mockFlatStore({ isCommandMenuOpen: false, setCommandMenuOpen });
        render(<UnifiedCommandMenu />);

        fireEvent.keyDown(window, { key: 'k', metaKey: true, bubbles: true, cancelable: true });

        expect(setCommandMenuOpen).toHaveBeenCalledWith(true);
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
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
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

    // ISSUE-1438: the palette must index the whole app, not a hardcoded ~22-item list.
    it('lists modules that previously had no command-menu entry', () => {
        render(<UnifiedCommandMenu />);

        expect(screen.getByText('Publishing Department')).toBeInTheDocument();
        expect(screen.getByText('Road/tour')).toBeInTheDocument();
        expect(screen.getByText('Files')).toBeInTheDocument();
        expect(screen.getByText('Security Agent')).toBeInTheDocument();
        expect(screen.getByText('Screenwriter')).toBeInTheDocument();
    });

    it('never lists phantom or merged module ids as destinations (ISSUE-1436/1437/1438)', () => {
        render(<UnifiedCommandMenu />);

        // campaign renders the same screen as marketing (ISSUE-1436).
        expect(screen.queryByText('Campaign Manager')).not.toBeInTheDocument();
        // audio-analyzer / format-foundry silently rewrite to other modules (ISSUE-1437).
        expect(screen.queryByText('Audio Analyzer')).not.toBeInTheDocument();
        expect(screen.queryByText('Capability Foundry')).not.toBeInTheDocument();
    });

    it('hides gated modules from the generated lists', () => {
        mockGatedModules.mockReturnValue(new Set(['merch']));
        render(<UnifiedCommandMenu />);

        expect(screen.queryByText('Art & Merch Dept')).not.toBeInTheDocument();
        expect(screen.getByText('Publishing Department')).toBeInTheDocument();
    });

    it('does not show a suggestion for a gated or inaccessible module', async () => {
        const judge = vi.mocked(judgeCommandIntent);
        judge.mockResolvedValue({ targetModule: 'finance', action: null, suggestedLabel: 'Finance & Royalties', confidence: 0.9 });
        mockGatedModules.mockReturnValue(new Set(['finance']));
        render(<UnifiedCommandMenu />);
        fireEvent.change(screen.getByPlaceholderText(/Search commands/i), { target: { value: 'show my royalties' } });

        await waitFor(() => expect(judge).toHaveBeenCalledWith('show my royalties'));
        await act(async () => { await judge.mock.results[0]?.value; });
        expect(screen.queryByText('Suggested by indii')).not.toBeInTheDocument();
    });

    it('shows an eligible suggestion', async () => {
        vi.mocked(judgeCommandIntent).mockResolvedValue({ targetModule: 'finance', action: null, suggestedLabel: 'Finance & Royalties', confidence: 0.9 });
        const setModule = vi.fn();
        mockFlatStore({ setModule });
        render(<UnifiedCommandMenu />);
        fireEvent.change(screen.getByPlaceholderText(/Search commands/i), { target: { value: 'show my royalties' } });

        expect(await screen.findByText('Suggested by indii')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Finance & Royalties').closest('[cmdk-item]')!);
        expect(setModule).toHaveBeenCalledWith('finance');
    });

    it('does not let a suggestion bypass organization access', async () => {
        const judge = vi.mocked(judgeCommandIntent);
        judge.mockResolvedValue({ targetModule: 'finance', action: null, suggestedLabel: 'Finance & Royalties', confidence: 0.9 });
        mockCanAccessModule.mockImplementation((id) => id !== 'finance');
        render(<UnifiedCommandMenu />);
        fireEvent.change(screen.getByPlaceholderText(/Search commands/i), { target: { value: 'show my royalties' } });

        await waitFor(() => expect(judge).toHaveBeenCalledWith('show my royalties'));
        await act(async () => { await judge.mock.results[0]?.value; });
        expect(screen.queryByText('Suggested by indii')).not.toBeInTheDocument();
    });

    it('ignores an older suggestion answer after the search changes', async () => {
        let resolveFirst!: (value: Awaited<ReturnType<typeof judgeCommandIntent>>) => void;
        const judge = vi.mocked(judgeCommandIntent);
        judge.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
        render(<UnifiedCommandMenu />);
        const input = screen.getByPlaceholderText(/Search commands/i);
        fireEvent.change(input, { target: { value: 'show my royalties' } });
        await waitFor(() => expect(judge).toHaveBeenCalledWith('show my royalties'));

        fireEvent.change(input, { target: { value: 'make artwork' } });
        await act(async () => {
            resolveFirst({ targetModule: 'finance', action: null, suggestedLabel: 'Finance & Royalties', confidence: 0.9 });
        });

        expect(screen.queryByText('Suggested by indii')).not.toBeInTheDocument();
    });

    it('shows a Recent section from navigation history', () => {
        const state = {
            isCommandMenuOpen: true,
            setCommandMenuOpen: vi.fn(),
            setModule: vi.fn(),
            currentModule: 'dashboard',
            // ISSUE-1442 Stage 2: 'social' folded into Marketing — 'publishing'
            // stands in as the older-history destination.
            _navigationHistory: ['dashboard', 'finance', 'publishing', 'finance'],
        };
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector?: (s: typeof state) => unknown) => {
            if (selector && typeof selector === 'function') return selector(state);
            return state;
        });
        (useStore as unknown as { getState: ReturnType<typeof vi.fn> }).getState = vi.fn(() => state);

        render(<UnifiedCommandMenu />);

        const recentGroup = screen.getByText('Recent').closest('[cmdk-group]');
        expect(recentGroup).not.toBeNull();
        // Most-recent unique first; duplicates and the current module collapse.
        // (These labels also appear in their generated groups, so scope to Recent.)
        const recentText = recentGroup!.textContent ?? '';
        expect(recentText.indexOf('Publishing Department')).toBeGreaterThan(-1);
        expect(recentText.indexOf('Finance Department')).toBeGreaterThan(-1);
        // Most-recent unique first: history ends [..., 'publishing', 'finance'].
        expect(recentText.indexOf('Finance Department')).toBeLessThan(recentText.indexOf('Publishing Department'));
    });
});
