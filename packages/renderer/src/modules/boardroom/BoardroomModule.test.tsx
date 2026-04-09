import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mocks ────────────────────────────────────────────────────────
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

// Mock the ChatMessage component
vi.mock('@/core/components/chat/ChatMessage', () => ({
    ChatMessage: ({ msg }: { msg: { id: string; text: string } }) => (
        <div data-testid={`chat-message-${msg.id}`}>{msg.text}</div>
    ),
}));

// Mock the Tooltip components
vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
    TooltipTrigger: React.forwardRef(({ children }: React.PropsWithChildren<{ asChild?: boolean }>, _ref: React.Ref<HTMLDivElement>) => {
        return <div>{children}</div>;
    }),
    TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
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
        expect(screen.getByText('Awaiting your brief...')).toBeInTheDocument();
        expect(screen.getByText('Boardroom Active')).toBeInTheDocument();
    });

    it('shows messages when boardroomMessages is populated', () => {
        mockStoreState.boardroomMessages = [
            { id: 'msg-1', role: 'model', text: 'Hello from marketing', timestamp: Date.now(), agentId: 'marketing' },
            { id: 'msg-2', role: 'model', text: 'Finance agrees', timestamp: Date.now(), agentId: 'finance' },
        ];

        render(<BoardroomModule />);
        expect(screen.getByTestId('chat-message-msg-1')).toBeInTheDocument();
        expect(screen.getByTestId('chat-message-msg-2')).toBeInTheDocument();
        expect(screen.queryByText('Awaiting your brief...')).not.toBeInTheDocument();
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
        expect(screen.getByTestId('chat-message-a')).toHaveTextContent('First message');
        expect(screen.getByTestId('chat-message-b')).toHaveTextContent('Second message');
    });

    it('renders nothing when messages array is empty', () => {
        const { container } = render(<MessageFeed messages={[]} />);
        expect(container.querySelector('[data-testid^="chat-message"]')).toBeNull();
    });
});

describe('BoardroomTable', () => {
    it('renders the empty state when no messages exist', () => {
        render(<BoardroomTable messages={[]} />);
        expect(screen.getByText('Awaiting your brief...')).toBeInTheDocument();
    });

    it('renders the message feed when messages exist', () => {
        const messages = [
            { id: 'x', role: 'model' as const, text: 'Table message', timestamp: Date.now() },
        ];
        render(<BoardroomTable messages={messages} />);
        expect(screen.getByTestId('chat-message-x')).toHaveTextContent('Table message');
    });
});
