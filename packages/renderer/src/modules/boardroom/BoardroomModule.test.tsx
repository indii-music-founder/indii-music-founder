import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mock Element.scrollTo (not implemented in jsdom) ─────────────
// BoardroomConversationPanel calls scrollRef.current.scrollTo() which
// doesn't exist in the jsdom environment.
Element.prototype.scrollTo = vi.fn();

// ── Mocks ────────────────────────────────────────────────────────
// Mock the ChatMessage component (used by MessageFeed)
vi.mock('@/core/components/chat/ChatMessage', () => ({
    ChatMessage: ({ msg }: { msg: { id: string; text: string } }) => (
        <div data-testid={`chat-message-${msg.id}`}>{msg.text}</div>
    ),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
            <div ref={ref} {...filterDomProps(props)}>{children}</div>
        )),
        button: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => (
            <button ref={ref} {...filterDomProps(props)}>{children}</button>
        )),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Filter out framer-motion-specific props that aren't valid DOM attributes
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
vi.mock('@/hooks/useMobile', () => ({
    useMobile: () => ({ isAnyPhone: false, isMobile: false }),
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
let mockStoreState: Record<string, unknown> = {};

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
import { BoardroomModule } from './BoardroomModule';
import { BoardroomEmptyState } from './components/BoardroomEmptyState';
import { MessageFeed } from './components/MessageFeed';
import { BoardroomTable } from './components/BoardroomTable';

// ── Tests ────────────────────────────────────────────────────────

describe('BoardroomModule', () => {
    beforeEach(() => {
        mockStoreState = {
            isBoardroomMode: true,
            activeAgents: [],
            boardroomMessages: [],
            toggleAgent: vi.fn(),
            setBoardroomMode: vi.fn(),
        };
    });

    it('renders nothing when boardroom mode is off', () => {
        mockStoreState.isBoardroomMode = false;
        const { container } = render(<BoardroomModule />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the boardroom canvas when mode is on', () => {
        const { container } = render(<BoardroomModule />);
        expect(container.firstChild).not.toBeNull();
    });

    it('shows the empty state when no messages exist', () => {
        render(<BoardroomModule />);
        // BoardroomConversationPanel renders "Awaiting discussion..." when empty
        expect(screen.getByText('Awaiting discussion...')).toBeInTheDocument();
        // BoardroomTable renders "Drag agents to the table to begin" when activeCount is 0
        expect(screen.getByText('Drag agents to the table to begin')).toBeInTheDocument();
        // Top bar renders "Boardroom HQ"
        expect(screen.getByText('Boardroom HQ')).toBeInTheDocument();
    });

    it('shows messages when boardroomMessages is populated', () => {
        mockStoreState.boardroomMessages = [
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
});

describe('BoardroomEmptyState', () => {
    it('renders the three text elements', () => {
        render(<BoardroomEmptyState />);
        expect(screen.getByText('Boardroom Active')).toBeInTheDocument();
        expect(screen.getByText('Awaiting your brief...')).toBeInTheDocument();
        expect(screen.getByText('Select participants to join the discussion.')).toBeInTheDocument();
    });
});

describe('MessageFeed', () => {
    it('renders a ChatMessage for each message', () => {
        const messages = [
            { id: 'a', role: 'model' as const, text: 'First message', timestamp: Date.now() },
            { id: 'b', role: 'user' as const, text: 'Second message', timestamp: Date.now() },
        ];

        render(<MessageFeed messages={messages} />);
        expect(screen.getByText('First message')).toBeInTheDocument();
        expect(screen.getByText('Second message')).toBeInTheDocument();
    });

    it('renders nothing when messages array is empty', () => {
        const { container } = render(<MessageFeed messages={[]} />);
        // No message text should be present
        expect(container.textContent).toBe('');
    });
});

describe('BoardroomTable', () => {
    it('shows "Drag agents" prompt when no agents are active', () => {
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
