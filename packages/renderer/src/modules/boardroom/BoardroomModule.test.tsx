import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mock Element.scrollTo (not implemented in jsdom) ─────────────
// BoardroomConversationPanel calls scrollRef.current.scrollTo() which
// doesn't exist in the jsdom environment.
Element.prototype.scrollTo = vi.fn();

// ── Mocks ────────────────────────────────────────────────────────
// Mock motion to avoid animation issues in tests
// Uses a Proxy so any HTML tag (motion.div, motion.p, motion.span, ...) resolves —
// enumerating a fixed set of tags broke when other components under test (e.g.
// TextEffect, which defaults to motion.p) also import from 'motion/react'.
vi.mock('motion/react', () => ({
    motion: new Proxy({} as Record<string, React.ForwardRefExoticComponent<React.PropsWithChildren<Record<string, unknown>>>>, {
        get: (target, tag: string) => {
            target[tag] ??= React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<Element>) =>
                React.createElement(tag, { ref, ...filterDomProps(props) }, children)
            );
            return target[tag];
        },
    }),
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useReducedMotion: () => false,
}));

// Filter out motion-specific props that aren't valid DOM attributes
function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalidProps = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'drag', 'dragSnapToOrigin', 'onDragEnd', 'key'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalidProps.includes(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}

// Mock the Tooltip components
vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipTrigger: ({ children }: React.PropsWithChildren<{ asChild?: boolean }>) => {
        return <div>{children}</div>;
    },
    TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

// Mock useMobile to return desktop mode by default
const mobileState = vi.hoisted(() => ({ isAnyPhone: false, isDesktop: true }));
vi.mock('@/hooks/useMobile', () => ({
    useMobile: () => ({ ...mobileState, isMobile: mobileState.isAnyPhone }),
}));

// Mock agent registry for BoardroomConversationPanel's resolveAgentIdentity
vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        getAll: vi.fn(() => [
            { id: 'marketing', name: 'Marketing Agent', color: '#FFE135' },
            { id: 'finance', name: 'Finance Agent', color: '#4B0082' },
        ]),
    },
}));

// Store mock state
const mockStoreState: Record<string, any> = {};

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));

vi.mock('zustand/react/shallow', () => ({
    useShallow: (fn: unknown) => fn,
}));

vi.mock('@/lib/utils', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Imports Under Test ───────────────────────────────────────────
import { BoardroomModule } from '@/modules/boardroom/BoardroomModule';
import { BoardroomTable } from '@/modules/boardroom/components/BoardroomTable';

// ── Tests ────────────────────────────────────────────────────────

describe('BoardroomModule', () => {
    beforeEach(() => {
        Object.keys(mockStoreState).forEach(key => delete mockStoreState[key]);
        Object.assign(mockStoreState, {
            activeAgents: ['generalist'],
            agentHistory: [],
            toggleAgent: vi.fn(),
            setBoardroomMode: vi.fn(),
            setChatChannel: vi.fn(),
            setCommandBarInput: vi.fn(),
            currentModule: 'dashboard',
            chatChannel: 'indii',
            conversationMode: 'boardroom',
            consumeHandoff: vi.fn(() => null),
            addReferencedAsset: vi.fn(),
            boardroomWorkspaceLayout: 'closed',
            boardroomWorkspaceTab: 'browser',
            setBoardroomWorkspaceLayout: vi.fn((layout) => { mockStoreState.boardroomWorkspaceLayout = layout; }),
            setBoardroomWorkspaceTab: vi.fn((tab) => { mockStoreState.boardroomWorkspaceTab = tab; }),
        });
    });

    it('renders nothing when boardroom mode is off', () => {
        mockStoreState.isBoardroomMode = false;
        const { container } = render(<BoardroomModule />);
        expect(container.firstChild).toBeNull();
    });

    it('does not put a literal "false" class on the seat button on phones (ISSUE-1651)', () => {
        mobileState.isAnyPhone = true;
        try {
            render(<BoardroomModule />);
            const seatButton = document.querySelector('button[aria-label="Seat agents"]') as HTMLElement;
            expect(seatButton).not.toBeNull();
            expect(seatButton.className.split(/\s+/)).not.toContain('false');
        } finally {
            mobileState.isAnyPhone = false;
        }
    });

    it('renders the boardroom canvas when mode is on', () => {
        render(<BoardroomModule />);
        expect(document.body.querySelector('[data-testid="boardroom-module"]')).not.toBeNull();
    });

    it('shows one active seat for a solo specialist without counting the conductor', () => {
        mockStoreState.activeAgents = ['finance'];
        render(<BoardroomModule />);
        expect(screen.getByText('1 active')).toBeInTheDocument();
    });

    it('shows the empty state when no messages exist', () => {
        render(<BoardroomModule />);
        // BoardroomConversationPanel renders "Awaiting discussion..." when empty
        expect(screen.getByText('Awaiting discussion...')).toBeInTheDocument();
        expect(screen.getByText('1 Agent Seated')).toBeInTheDocument();
        // Top bar renders "Boardroom HQ"
        expect(screen.getByText('Boardroom HQ')).toBeInTheDocument();
    });

    it('keeps Boardroom missions and approvals inside the single 48px header row without a stacked digest bar', () => {
        render(<BoardroomModule />);
        const headerRow = screen.getByTestId('boardroom-header');
        const journey = screen.getByTestId('boardroom-journey');
        expect(headerRow).toHaveClass('h-12');
        expect(headerRow).toContainElement(journey);
        expect(headerRow).toContainElement(screen.getByTestId('boardroom-missions-toggle'));
        expect(headerRow).toContainElement(screen.getByTestId('boardroom-governance-toggle'));
    });

    it('shows messages when boardroomMessages is populated', () => {
        mockStoreState.agentHistory = [
            { id: 'msg-1', role: 'model', text: 'Hello from marketing', timestamp: Date.now(), agentId: 'marketing' },
            { id: 'msg-2', role: 'model', text: 'Finance agrees', timestamp: Date.now(), agentId: 'finance' },
        ];

        render(<BoardroomModule />);
        // BoardroomConversationPanel renders message text directly (not via ChatMessage)
        expect(screen.getByText('Hello from marketing')).toBeInTheDocument();
        expect(screen.getByText('Finance agrees')).toBeInTheDocument();
        // The empty state text should NOT be present
        expect(screen.queryByText('Awaiting discussion...')).not.toBeInTheDocument();
    });

    it('renders workspace dock toggles and responds to tab selection', () => {
        render(<BoardroomModule />);
        const dock = screen.getByTestId('boardroom-workspace-dock');
        expect(dock).toBeInTheDocument();

        const browserBtn = screen.getByTestId('boardroom-workspace-toggle-browser');
        const studioBtn = screen.getByTestId('boardroom-workspace-toggle-module');
        const workbenchBtn = screen.getByTestId('boardroom-workspace-toggle-workbench');
        const feedBtn = screen.getByTestId('boardroom-workspace-toggle-feed');

        expect(browserBtn).toBeInTheDocument();
        expect(studioBtn).toBeInTheDocument();
        expect(workbenchBtn).toBeInTheDocument();
        expect(feedBtn).toBeInTheDocument();

        fireEvent.click(browserBtn);
        expect(mockStoreState.setBoardroomWorkspaceTab).toHaveBeenCalledWith('browser');
        expect(mockStoreState.setBoardroomWorkspaceLayout).toHaveBeenCalledWith('split');
    });

    it('opens the browser between the table and discussion when entering Boardroom on desktop', () => {
        const view = render(<BoardroomModule />);
        expect(mockStoreState.setBoardroomWorkspaceLayout).toHaveBeenCalledWith('split');
        view.rerender(<BoardroomModule />);
        const workspace = screen.getByTestId('boardroom-workspace-container');
        // The table folds away so the work gets the room; a left-edge tab brings it back.
        expect(screen.queryByTestId('boardroom-orbital-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('boardroom-show-table-edge')).toHaveAccessibleName('Show table');
        expect(workspace.nextElementSibling).toBe(screen.getByTestId('boardroom-conversation-container'));
        expect(screen.getByRole('tab', { name: 'Live Browser', selected: true })).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Close Workspace' }));
        view.rerender(<BoardroomModule />);
        expect(workspace).not.toBeVisible();
    });

    it.each(['browser', 'module', 'workbench', 'agent-feed'])('opens %s with discussion as a right drawer by default and supports docking (Spec L2/L3)', tab => {
        mockStoreState.boardroomWorkspaceLayout = 'split';
        mockStoreState.boardroomWorkspaceTab = tab;

        render(<BoardroomModule />);
        expect(screen.queryByTestId('boardroom-orbital-panel')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('boardroom-show-table-edge'));
        const table = screen.getByTestId('boardroom-orbital-panel');
        const workspace = screen.getByTestId('boardroom-workspace-container');
        const discussion = screen.getByTestId('boardroom-conversation-container');
        expect(table.nextElementSibling).toBe(workspace);
        expect(workspace.nextElementSibling).toBe(discussion);
        expect(table).not.toHaveClass('absolute');
        expect(discussion).toBeVisible();
        expect(discussion).toHaveAttribute('role', 'dialog');
        expect(discussion).toHaveClass('absolute', 'right-14');

        fireEvent.click(screen.getByRole('button', { name: 'Dock discussion' }));
        expect(discussion).not.toHaveClass('absolute');
        expect(discussion).not.toHaveAttribute('role', 'dialog');

        fireEvent.click(screen.getByRole('button', { name: 'Hide table' }));
        expect(screen.queryByTestId('boardroom-orbital-panel')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Discussion' }));
        expect(discussion).not.toBeVisible();
        expect(workspace).toBeVisible();
    });

    it('renders workspace as a full-screen sheet and exposes Living Plans button on phones (ISSUE-1636)', () => {
        mobileState.isAnyPhone = true;
        mobileState.isDesktop = false;
        mockStoreState.boardroomWorkspaceLayout = 'split';
        mockStoreState.boardroomWorkspaceTab = 'browser';
        try {
            render(<BoardroomModule />);
            const workspace = screen.getByTestId('boardroom-workspace-container');
            expect(workspace).toHaveAttribute('role', 'dialog');
            expect(workspace).toHaveClass('fixed', 'inset-0');

            fireEvent.click(screen.getByRole('button', { name: 'Close Workspace' }));
            expect(mockStoreState.setBoardroomWorkspaceLayout).toHaveBeenCalledWith('closed');

            const plansBtn = screen.getByRole('button', { name: 'Living Plans' });
            expect(plansBtn).toBeInTheDocument();
        } finally {
            mobileState.isAnyPhone = false;
            mobileState.isDesktop = true;
        }
    });

    it('keeps the discussion overlay keyboard accessible in stage layout', () => {
        mockStoreState.boardroomWorkspaceLayout = 'stage';
        mockStoreState.boardroomWorkspaceTab = 'browser';
        render(<BoardroomModule />);
        expect(screen.getByTestId('boardroom-conversation-container')).not.toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Discussion' }));
        expect(screen.getByTestId('boardroom-conversation-container')).toBeVisible();
        expect(screen.getByRole('button', { name: 'Close discussion' })).toHaveFocus();
        fireEvent.click(screen.getByRole('button', { name: 'Close discussion' }));
        expect(screen.getByRole('button', { name: 'Discussion' })).toHaveFocus();
        expect(screen.getByTestId('boardroom-workspace-container')).toHaveClass('min-w-0', 'overflow-hidden');
        expect(screen.getByTestId('boardroom-workspace-pane')).toBeInTheDocument();
    });

    it('expands the browser on request and restores the three columns without remounting it', () => {
        mockStoreState.boardroomWorkspaceLayout = 'split';
        const view = render(<BoardroomModule />);
        fireEvent.click(screen.getByTestId('boardroom-show-table-edge'));
        const browser = screen.getByTestId('boardroom-browser-view');
        fireEvent.click(screen.getByRole('button', { name: 'Expand browser' }));
        view.rerender(<BoardroomModule />);
        expect(screen.queryByTestId('boardroom-orbital-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('boardroom-browser-view')).toBe(browser);

        fireEvent.click(screen.getByRole('button', { name: 'Restore split layout' }));
        view.rerender(<BoardroomModule />);
        expect(screen.getByTestId('boardroom-orbital-panel')).toBeVisible();
        expect(screen.getByTestId('boardroom-conversation-container')).toBeVisible();
        expect(screen.getByTestId('boardroom-browser-view')).toBe(browser);
    });

    it('preserves the open browser when the center pane is closed and reopened', () => {
        mockStoreState.boardroomWorkspaceLayout = 'split';
        const view = render(<BoardroomModule />);
        const browser = screen.getByTestId('boardroom-browser-view');
        fireEvent.click(screen.getByRole('button', { name: 'Close Workspace' }));
        view.rerender(<BoardroomModule />);
        expect(browser).not.toBeVisible();
        fireEvent.click(screen.getByTestId('boardroom-workspace-toggle-browser'));
        view.rerender(<BoardroomModule />);
        expect(screen.getByTestId('boardroom-browser-view')).toBe(browser);
        expect(browser).toBeVisible();
    });

    it('hides orbital table when in stage layout to maximize workspace focus', () => {
        mockStoreState.boardroomWorkspaceLayout = 'stage';
        mockStoreState.boardroomWorkspaceTab = 'browser';

        render(<BoardroomModule />);
        expect(screen.getByTestId('boardroom-workspace-container')).toBeInTheDocument();
        expect(screen.queryByTestId('boardroom-orbital-panel')).not.toBeInTheDocument();
    });
});

describe('BoardroomTable', () => {
    it('shows the Indii command path when no participant count is supplied', () => {
        render(<BoardroomTable messages={[]} activeCount={0} />);
        expect(screen.getByText('Drag agents to the table to begin')).toBeInTheDocument();
    });

    it('shows agent count when agents are seated', () => {
        const messages = [
            { id: 'x', role: 'model' as const, text: 'Table message', timestamp: Date.now() },
        ];
        render(<BoardroomTable messages={messages} activeCount={2} />);
        // BoardroomTable is now a pure visual ornament — it shows the status indicator
        expect(screen.getByText('2 Agents Seated')).toBeInTheDocument();
        expect(screen.getByText(/1 exchange/)).toBeInTheDocument();
    });
});
