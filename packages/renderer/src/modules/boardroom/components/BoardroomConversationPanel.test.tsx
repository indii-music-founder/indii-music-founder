import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Mock Element.scrollTo (not implemented in jsdom)
Element.prototype.scrollTo = vi.fn();

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('motion/react', () => ({
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

import {
    BOARDROOM_MESSAGE_BATCH_SIZE,
    BoardroomConversationPanel,
} from './BoardroomConversationPanel';

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

    it('throbs the user avatar while an agent is streaming (ISSUE-1364)', () => {
        const messages = [
            { id: 'user-1', role: 'user' as const, text: 'Make me a cover', timestamp: Date.now() },
            { id: 'agent-1', role: 'model' as const, text: '*(Reviewing request...)*', timestamp: Date.now(), agentId: 'creative', isStreaming: true },
        ];
        const { container } = render(<BoardroomConversationPanel messages={messages} />);

        // The user's avatar circle carries the pulse class while any agent streams.
        const userAvatar = container.querySelector('[data-message-id="user-1"]')?.querySelector('.animate-pulse');
        expect(userAvatar).not.toBeNull();
        // The ping ring is present too.
        expect(container.querySelector('[data-message-id="user-1"]')?.querySelector('.animate-ping')).not.toBeNull();
    });

    it('does not throb the user avatar when no agent is streaming', () => {
        const messages = [
            { id: 'user-1', role: 'user' as const, text: 'Make me a cover', timestamp: Date.now() },
            { id: 'agent-1', role: 'model' as const, text: 'Done', timestamp: Date.now(), agentId: 'creative', isStreaming: false },
        ];
        const { container } = render(<BoardroomConversationPanel messages={messages} />);

        expect(container.querySelector('[data-message-id="user-1"]')?.querySelector('.animate-pulse')).toBeNull();
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

    it('bounds historical message rendering and reveals earlier messages in batches', () => {
        const messages = Array.from(
            { length: BOARDROOM_MESSAGE_BATCH_SIZE + 2 },
            (_, index) => ({
                id: `msg-${index}`,
                role: 'model' as const,
                text: `Message ${index}`,
                timestamp: index,
                agentId: 'marketing',
            }),
        );
        const { container } = render(<BoardroomConversationPanel messages={messages} />);

        expect(container.querySelectorAll('[data-message-id]')).toHaveLength(BOARDROOM_MESSAGE_BATCH_SIZE);
        expect(screen.queryByText('Message 0')).not.toBeInTheDocument();
        expect(screen.getByText(`${messages.length} messages`)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Show earlier messages (2 remaining)' }));

        expect(container.querySelectorAll('[data-message-id]')).toHaveLength(messages.length);
        expect(screen.getByText('Message 0')).toBeInTheDocument();
    });

    it('renders the implicit-feedback action for the exact tracked Boardroom response', () => {
        const messages = [{
            id: 'msg-persona',
            role: 'model' as const,
            text: 'Tracked Boardroom advice',
            timestamp: Date.now(),
            agentId: 'finance',
            isStreaming: false,
            metadata: {
                personaResponse: {
                    personaId: 'businessManager',
                    responseId: 'msg-persona',
                    isControlGroup: false,
                    effectiveFaderValues: {
                        riskTolerance: 50,
                        brevity: 50,
                        directness: 50,
                        formality: 50,
                        reasoningTransparency: 50,
                    },
                    measurementStatus: 'recorded',
                },
            },
        }];

        render(<BoardroomConversationPanel messages={messages} />);

        expect(screen.getByRole('button', { name: 'Copy response' })).toBeInTheDocument();
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
        expect(screen.getByText('Marketing Director')).toBeInTheDocument();
    });

    it('shows agent initials for known agents', () => {
        const messages = [
            { id: 'msg-1', role: 'model' as const, text: 'Revenue report', timestamp: Date.now(), agentId: 'finance' },
        ];
        render(<BoardroomConversationPanel messages={messages} />);
        expect(screen.getByText('FD')).toBeInTheDocument();
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
        expect(screen.getByText('Unknown Agent')).toBeInTheDocument();
        expect(screen.getByLabelText('Unknown Agent, neutral fallback identity')).toBeInTheDocument();
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
        expect(screen.getByText('Finance Director')).toBeInTheDocument();
    });

    it('uses the canonical Social cyan identity, initials, and icon in discussion messages', () => {
        const messages = [
            { id: 'msg-social', role: 'model' as const, text: 'Social update', timestamp: Date.now(), agentId: 'social' },
        ];
        const { container } = render(<BoardroomConversationPanel messages={messages} />);

        const message = container.querySelector('[data-agent-id="social"]');
        expect(message).toHaveAttribute('data-agent-accent', '#00BCD4');
        expect(message).toHaveAttribute('data-agent-icon', 'share-2');
        expect(screen.getByText('Social Media Director')).toBeInTheDocument();
        expect(screen.getByText('SM')).toBeInTheDocument();
        expect(screen.getByLabelText('Social Media Director, Social department head')).toBeInTheDocument();
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

    it('keeps following a streamed response when the message count does not change', () => {
        const messages = [
            {
                id: 'msg-stream',
                role: 'model' as const,
                text: 'Beginning',
                timestamp: Date.now(),
                agentId: 'creative',
                isStreaming: true,
            },
        ];
        const { rerender } = render(<BoardroomConversationPanel messages={messages} />);
        const callsAfterInitialAnchor = vi.mocked(Element.prototype.scrollTo).mock.calls.length;

        rerender(
            <BoardroomConversationPanel
                messages={[{
                    ...messages[0]!,
                    text: 'Beginning and continuing the streamed response',
                }]}
            />
        );

        expect(Element.prototype.scrollTo).toHaveBeenCalledWith({
            top: expect.any(Number),
            behavior: 'auto',
        });
        expect(vi.mocked(Element.prototype.scrollTo).mock.calls.length).toBeGreaterThan(callsAfterInitialAnchor);
    });
});
