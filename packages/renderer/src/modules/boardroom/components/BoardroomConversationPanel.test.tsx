import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock Element.scrollTo (not implemented in jsdom)
Element.prototype.scrollTo = vi.fn();

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => {
            const filtered = filterDomProps(props);
            return <div ref={ref} {...filtered}>{children}</div>;
        }),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalidProps = ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'drag'];
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!invalidProps.includes(key)) {
            filtered[key] = value;
        }
    }
    return filtered;
}

vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        getAll: vi.fn(() => [
            { id: 'marketing', name: 'Marketing Agent', color: '#FFE135' },
            { id: 'finance', name: 'Finance Agent', color: '#4B0082' },
            { id: 'creative', name: 'Creative Director', color: '#FF6B6B' },
        ]),
    },
}));

vi.mock('@/core/components/command-bar/PromptArea', () => ({
    PromptArea: ({ className }: { className?: string }) => (
        <div data-testid="prompt-area" className={className}>Prompt Area Mock</div>
    ),
}));

vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown-content">{children}</div>,
}));

vi.mock('remark-gfm', () => ({
    default: vi.fn(),
}));

vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <span className={className}>{children}</span>
    ),
}));

// ── Import Under Test ──────────────────────────────────────────────────────

import { BoardroomConversationPanel } from './BoardroomConversationPanel';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BoardroomConversationPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Empty State Tests ---

    it('shows empty state when no messages', () => {
        render(<BoardroomConversationPanel messages={[]} />);
        expect(screen.getByText('Awaiting discussion...')).toBeInTheDocument();
    });

    it('shows guidance text in empty state', () => {
        render(<BoardroomConversationPanel messages={[]} />);
        expect(screen.getByText(/Select agents and submit a brief/)).toBeInTheDocument();
    });

    it('shows prompt area in empty state', () => {
        render(<BoardroomConversationPanel messages={[]} />);
        expect(screen.getByTestId('prompt-area')).toBeInTheDocument();
    });

    // --- Messages Rendering ---

    it('renders messages when provided', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Marketing plan ready', timestamp: Date.now(), agentId: 'marketing' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('Marketing plan ready')).toBeInTheDocument();
    });

    it('renders message count in header', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Hello', timestamp: Date.now(), agentId: 'marketing' },
            { id: 'msg-2', role: 'user' as const, text: 'Hi there', timestamp: Date.now() },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('2 messages')).toBeInTheDocument();
    });

    it('renders singular "message" for single message', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Hello', timestamp: Date.now(), agentId: 'marketing' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('1 message')).toBeInTheDocument();
    });

    it('renders "Discussion" header label', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Test', timestamp: Date.now(), agentId: 'marketing' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('Discussion')).toBeInTheDocument();
    });

    // --- Agent Identity Resolution ---

    it('shows agent name for known agents', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Campaign update', timestamp: Date.now(), agentId: 'marketing' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('Marketing Agent')).toBeInTheDocument();
    });

    it('shows agent initials for known agents', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Revenue report', timestamp: Date.now(), agentId: 'finance' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('FA')).toBeInTheDocument(); // Finance Agent initials
    });

    it('shows "You" label and avatar for user messages', () => {
        const messages = [
            { id: 'msg-1', role: 'user' as const, text: 'Create artwork', timestamp: Date.now() },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        // "You" appears in both the avatar and the label
        const youElements = screen.getAllByText('You');
        expect(youElements.length).toBeGreaterThanOrEqual(1);
    });

    it('falls back gracefully for unknown agent IDs', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Unknown agent response', timestamp: Date.now(), agentId: 'unknown-agent' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('Unknown-agent')).toBeInTheDocument();
    });

    // --- Multi-Agent Conversation ---

    it('renders multiple agents in order', () => {
        const messages = [
            { id: 'msg-1', role: 'user' as const, text: 'Create album art and analyze costs', timestamp: Date.now() },
            { id: 'msg-2', role: 'model' as const, text: 'Creating album artwork now', timestamp: Date.now(), agentId: 'creative' },
            { id: 'msg-3', role: 'model' as const, text: 'Analyzing production costs', timestamp: Date.now(), agentId: 'finance' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('Create album art and analyze costs')).toBeInTheDocument();
        expect(screen.getByText('Creating album artwork now')).toBeInTheDocument();
        expect(screen.getByText('Analyzing production costs')).toBeInTheDocument();
        expect(screen.getByText('Creative Director')).toBeInTheDocument();
        expect(screen.getByText('Finance Agent')).toBeInTheDocument();
    });

    // --- Message Sanitization ---

    it('sanitizes tool blocks from messages', () => {
        const messages = [
            {
                id: 'msg-1',
                role: 'model' as const,
                text: 'Here is your image [Tool: generate_image]{"url":"test"}[End Tool generate_image] Generated successfully!',
                timestamp: Date.now(),
                agentId: 'creative',
            },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        // The tool block should be stripped
        expect(screen.queryByText(/\[Tool:/)).not.toBeInTheDocument();
        expect(screen.getByText(/Generated successfully/)).toBeInTheDocument();
    });

    it('sanitizes SYSTEM NOTE from messages', () => {
        const messages = [
            {
                id: 'msg-1',
                role: 'model' as const,
                text: '(SYSTEM NOTE): Internal context\nActual response to user',
                timestamp: Date.now(),
                agentId: 'marketing',
            },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.queryByText(/SYSTEM NOTE/)).not.toBeInTheDocument();
        expect(screen.getByText(/Actual response to user/)).toBeInTheDocument();
    });

    // --- Prompt Area ---

    it('renders prompt area at bottom when messages exist', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Test', timestamp: Date.now(), agentId: 'marketing' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByTestId('prompt-area')).toBeInTheDocument();
    });

    // --- Streaming Indicator ---

    it('shows streaming indicator for messages being streamed', () => {
        const messages = [
            {
                id: 'msg-1',
                role: 'model' as const,
                text: 'Processing your request',
                timestamp: Date.now(),
                agentId: 'creative',
                isStreaming: true,
            },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('typing...')).toBeInTheDocument();
    });

    // --- Auto-scroll ---

    it('calls scrollTo when messages change', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'First', timestamp: Date.now(), agentId: 'marketing' },
        ];
        const { rerender } = render(<BoardroomConversationPanel messages={messages} />);

        const updatedMessages = [
            ...messages,
            { id: 'msg-2', role: 'model' as const, text: 'Second', timestamp: Date.now(), agentId: 'finance' },
        ];
        rerender(<BoardroomConversationPanel messages={updatedMessages} />);

        expect(Element.prototype.scrollTo).toHaveBeenCalled();
    });
});
