import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';

// --- MOCKS ---

// Mock Store
const mockStore = vi.fn();
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

// Mock Virtuoso
vi.mock('react-virtuoso', async () => {
    const React = await import('react');
    return {
        Virtuoso: React.forwardRef(({ data, itemContent, atBottomStateChange }: any, ref: any) => {
            // Mock scroll behavior
            if (atBottomStateChange) {
                setTimeout(() => atBottomStateChange(true), 0);
            }
            return (
                <div data-testid="stream-list" ref={ref}>
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
vi.mock('framer-motion', async (importOriginal) => {
    const actual = await importOriginal<typeof import('framer-motion')>();
    return {
        ...actual,
        motion: {
            div: ({ children, className, drag, dragControls, dragListener, dragMomentum, ...props }: any) => (
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
    chatChannel: 'indii'
};

describe('👁️ Pixel: Chat Stream Verification', () => {

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

    it('Scenario 1: Handles "Thinking" state', () => {
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Write a poem', timestamp: 100 }
            ],
            isAgentProcessing: true
        });
        render(<ChatOverlay onClose={vi.fn()} />);

        expect(screen.getByText(/PROCESSING RESPONSE.../i)).toBeInTheDocument();
    });

    it('Scenario 2: Verifies progressive text streaming', () => {
        const { rerender } = render(<ChatOverlay onClose={vi.fn()} />);

        const chunks = ['The', ' neon', ' lights'];
        let currentText = '';

        for (const chunk of chunks) {
            currentText += chunk;
            updateStore({
                agentHistory: [
                    { id: 'ai1', role: 'model', text: currentText, isStreaming: true, timestamp: 101 }
                ]
            });
            rerender(<ChatOverlay onClose={vi.fn()} />);

            // Check that text content updates
            expect(screen.getByTestId('markdown-content')).toHaveTextContent(currentText);
        }
    });

    it('Scenario 3: Verifies Stream Completion', () => {
        updateStore({
            agentHistory: [],
            isAgentProcessing: true
        });
        const { rerender } = render(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.getByText(/PROCESSING RESPONSE.../i)).toBeInTheDocument();

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: 'Done.', isStreaming: false, timestamp: 101 }
            ],
            isAgentProcessing: false
        });
        rerender(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.queryByText(/PROCESSING RESPONSE.../i)).not.toBeInTheDocument();
    });

    it('Scenario 4: Handles Thought Chain updates', () => {
        const thoughts = [
            { id: 't1', text: 'Analyzing request...', type: 'thought' },
            { id: 't2', text: 'Searching knowledge base...', type: 'tool' }
        ];

        updateStore({
            agentHistory: [
                {
                    id: 'ai1',
                    role: 'model',
                    text: '',
                    isStreaming: true,
                    thoughts: thoughts, // MessageItem consumes this
                    timestamp: 101
                }
            ],
            isAgentProcessing: true
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        expect(screen.getByText(/Analyzing request/i)).toBeInTheDocument();
        expect(screen.getByText(/Searching knowledge base/i)).toBeInTheDocument();
    });

    it('Scenario 5: Auto-scroll anchor logic', async () => {
        updateStore({
            agentHistory: [{ id: '1', role: 'user', text: 'hi' }]
        });

        render(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.getByTestId('stream-list')).toBeInTheDocument();
    });

});
