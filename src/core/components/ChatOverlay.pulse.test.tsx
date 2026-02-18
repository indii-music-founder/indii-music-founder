import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';

// --- MOCKS ---

// Mock Store - using vi.hoisted to ensure accessibility in vi.mock
const { mockStore } = vi.hoisted(() => {
    return { mockStore: vi.fn() };
});

vi.mock('@/core/store', () => ({
    useStore: (selector: any) => mockStore(selector),
}));

// Mock Voice Context
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({ isVoiceEnabled: false, setVoiceEnabled: vi.fn(), isListening: false, transcript: '' })
}));

// Mock Voice Service
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: { speak: vi.fn(), stopSpeaking: vi.fn() }
}));

// Mock Toast Context
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        toast: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    })
}));

// Mock Virtuoso (Simplified for Pulse testing)
vi.mock('react-virtuoso', async () => {
    const React = await import('react');
    return {
        Virtuoso: React.forwardRef(({ data, itemContent }: any, ref: any) => {
            return (
                <div data-testid="virtuoso-list" ref={ref}>
                    {data.map((item: any, i: number) => (
                        <div key={item.id} data-testid={`message-${item.id}`}>
                            {itemContent(i, item)}
                        </div>
                    ))}
                </div>
            )
        }),
        VirtuosoHandle: {},
    };
});

// Mock Framer Motion
vi.mock('motion/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('motion/react')>();
    return {
        ...actual,
        motion: {
            div: ({ children, className, ...props }: any) => (
                <div className={className} {...props}>{children}</div>
            ),
            button: ({ children, className, onClick, ...props }: any) => (
                <button className={className} onClick={onClick} {...props}>{children}</button>
            ),
        },
        AnimatePresence: ({ children }: any) => <>{children}</>,
        useDragControls: () => ({ start: vi.fn() }),
    };
});

// Mock Markdown components
vi.mock('react-markdown', () => ({
    default: ({ children }: any) => <div data-testid="markdown-content">{children}</div>
}));

// Mock TextEffect
vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: any) => <span>{children}</span>
}));

// Mock Agent Registry
vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        getAll: () => [{ id: 'generalist', name: 'Indii', description: 'Assistant', color: 'purple' }]
    }
}));

// --- TEST DATA ---
const INITIAL_STATE = {
    isAgentOpen: true,
    agentHistory: [],
    activeSessionId: 'session-1',
    sessions: { 'session-1': { title: 'Test Session', participants: ['indii'] } },
    userProfile: { brandKit: { referenceImages: [] } },
    loadSessions: vi.fn(),
    createSession: vi.fn(),
    toggleAgentWindow: vi.fn(),
    isAgentProcessing: false,
    chatChannel: 'indii',
    setChatChannel: vi.fn(),
    setModule: vi.fn(),
    setCommandBarDetached: vi.fn(),
    setCommandBarInput: vi.fn(),
    setCommandBarAttachments: vi.fn(),
    isCommandBarDetached: false,
    commandBarInput: '',
    commandBarAttachments: [],
    currentModule: 'dashboard',
    setAgentWindowSize: vi.fn(),
    agentWindowSize: { width: 400, height: 600 },
};

describe('💓 Pulse: Chat Overlay Status Feedback', () => {

    const updateStore = (overrides: any) => {
        const state = { ...INITIAL_STATE, ...overrides };
        mockStore.mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(state);
            return state;
        });
        return state;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        updateStore({});
    });

    afterEach(() => {
        cleanup();
    });

    it('Scenario: The "Zero State" - Helpful guidance instead of a blank void', () => {
        // 1. Setup: No history
        updateStore({
            agentHistory: []
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        // 2. Assert: Empty State is Visible
        // "Silence is a bug" - we must show something
        expect(screen.getByText(/How can I help you\?/i)).toBeInTheDocument();
        expect(screen.getByText(/I can help you create content/i)).toBeInTheDocument();

        // 3. Assert: No message list is rendered (efficiency)
        expect(screen.queryByTestId('virtuoso-list')).not.toBeInTheDocument();
    });

    it('Scenario: The "Thinking" Pulse - User needs to know the system is alive', () => {
        // 1. Setup: User sent a message, Agent is processing
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Hello', timestamp: 100 }
            ],
            isAgentProcessing: true
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        // 2. Assert: Processing Indicator is visible
        const processingIndicator = screen.getByText(/PROCESSING RESPONSE.../i);
        expect(processingIndicator).toBeInTheDocument();
        expect(processingIndicator).toHaveClass('text-purple-300'); // Visual feedback - text styling

        // 3. Assert: Empty State is GONE
        expect(screen.queryByText(/How can I help you\?/i)).not.toBeInTheDocument();
    });

    it('Scenario: The "Transition" - Seamless flow from Processing to Result', () => {
        const { rerender } = render(<ChatOverlay onClose={vi.fn()} />);

        // 1. Start Processing
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Generate an image', timestamp: 100 }
            ],
            isAgentProcessing: true
        });
        rerender(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.getByText(/PROCESSING RESPONSE.../i)).toBeInTheDocument();

        // 2. Stream Starts (Pulse is still alive, content appearing)
        // Note: The "PROCESSING RESPONSE..." footer remains visible during streaming to indicate
        // that the agent is still generating/typing, even though content has started arriving.
        // This is a "Status Bar" pattern, distinct from a blocking loader.
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Generate an image', timestamp: 100 },
                { id: 'a1', role: 'model', text: 'Sure, ', isStreaming: true, timestamp: 101 }
            ],
            isAgentProcessing: true
        });
        rerender(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.getByText('Sure,')).toBeInTheDocument();
        expect(screen.getByText(/PROCESSING RESPONSE.../i)).toBeInTheDocument();

        // 3. Finish (Pulse stops)
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Generate an image', timestamp: 100 },
                { id: 'a1', role: 'model', text: 'Sure, here it is.', isStreaming: false, timestamp: 101 }
            ],
            isAgentProcessing: false
        });
        rerender(<ChatOverlay onClose={vi.fn()} />);

        // Assert Pulse is gone
        expect(screen.queryByText(/PROCESSING RESPONSE.../i)).not.toBeInTheDocument();
        // Assert Content is there
        expect(screen.getByText('Sure, here it is.')).toBeInTheDocument();
    });

    it('Scenario: The "Error State" - Handling Model Failures Gracefully', () => {
        const { rerender } = render(<ChatOverlay onClose={vi.fn()} />);

        // 1. Setup: User sent message, agent processing
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Analyze this massive dataset', timestamp: 100 }
            ],
            isAgentProcessing: true
        });
        rerender(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.getByText(/PROCESSING RESPONSE.../i)).toBeInTheDocument();

        // 2. Simulate Error: Processing stops, Error Thought appears
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Analyze this massive dataset', timestamp: 100 },
                {
                    id: 'a1',
                    role: 'model',
                    text: 'I encountered an issue.',
                    timestamp: 101,
                    thoughts: [
                        { id: 't1', text: 'Model Context Exceeded', timestamp: 101, type: 'error' }
                    ]
                }
            ],
            isAgentProcessing: false
        });
        rerender(<ChatOverlay onClose={vi.fn()} />);

        // 3. Assert: Processing indicator is GONE
        expect(screen.queryByText(/PROCESSING RESPONSE.../i)).not.toBeInTheDocument();

        // 4. Assert: Error message is visible and RED
        // Note: ThoughtChain renders thoughts. We need to find the thought text.
        const errorThought = screen.getByText('Model Context Exceeded');
        expect(errorThought).toBeInTheDocument();
        // Verified class name from source
        expect(errorThought).toHaveClass('text-red-400');
    });
});
