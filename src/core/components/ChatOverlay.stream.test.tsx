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
    useVoice: () => ({ isVoiceEnabled: false, setVoiceEnabled: vi.fn() })
}));

// Mock Voice Service
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: { speak: vi.fn(), stopSpeaking: vi.fn() }
}));

// Mock Virtuoso (Crucial for testing scroll)
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent, followOutput, initialTopMostItemIndex }: any) => (
        <div data-testid="stream-list" data-follow-output={followOutput} data-initial-index={initialTopMostItemIndex}>
            {data.map((item: any, i: number) => (
                <div key={item.id} data-testid={`message-${item.id}`}>
                    {itemContent(i, item)}
                </div>
            ))}
        </div>
    ),
    VirtuosoHandle: {},
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Markdown components to avoid complex rendering in tests
vi.mock('react-markdown', () => ({
    default: ({ children }: any) => <div data-testid="markdown-content">{children}</div>
}));

// Mock TextEffect
vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: any) => <span>{children}</span>
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
};

describe('👁️ Pixel: Chat Stream Verification', () => {

    // Helper to simulate store updates
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
        updateStore({}); // Reset to initial
    });

    it('Scenario 1: Handles "Thinking" state before stream starts', () => {
        // Pixel says: "If it flickers, it fails". Verify smooth entry.

        // 1. User sends message
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Write a poem', timestamp: 100 }
            ]
        });
        const { rerender } = render(<ChatOverlay />);

        expect(screen.getByText('Write a poem')).toBeInTheDocument();

        // 2. AI enters "Thinking" state (empty text, isStreaming: true)
        updateStore({
            agentHistory: [
                { id: 'u1', role: 'user', text: 'Write a poem', timestamp: 100 },
                { id: 'ai1', role: 'model', text: '', isStreaming: true, timestamp: 101 }
            ]
        });
        rerender(<ChatOverlay />);

        // Verify "Thinking" indicators
        expect(screen.getByTestId('thinking-dots')).toBeInTheDocument();
    });

    it('Scenario 2: Verifies progressive text streaming without layout thrashing', async () => {
        // Pixel says: "Verify the UI behavior, not the model"

        const { rerender } = render(<ChatOverlay />);

        // Simulating chunks arriving
        const chunks = ['The', ' neon', ' lights', ' flicker', '.'];
        let currentText = '';

        for (const chunk of chunks) {
            currentText += chunk;

            updateStore({
                agentHistory: [
                    { id: 'ai1', role: 'model', text: currentText, isStreaming: true, timestamp: 101 }
                ]
            });

            rerender(<ChatOverlay />);

            // Assert text update
            const content = screen.getByTestId('markdown-content');
            expect(content).toHaveTextContent(currentText);

            // Assert Auto-Scroll is still active (followOutput="smooth")
            const list = screen.getByTestId('stream-list');
            expect(list).toHaveAttribute('data-follow-output', 'smooth');
        }
    });

    it('Scenario 3: Verifies Stream Completion (Loading indicators vanish)', () => {
        // 1. Streaming State
        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: 'Done.', isStreaming: true, timestamp: 101 }
            ]
        });
        const { rerender } = render(<ChatOverlay />);

        expect(screen.getByTestId('thinking-dots')).toBeInTheDocument();

        // 2. Completed State
        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: 'Done.', isStreaming: false, timestamp: 101 }
            ]
        });
        rerender(<ChatOverlay />);

        // Dots should be gone
        expect(screen.queryByTestId('thinking-dots')).not.toBeInTheDocument();
    });

    it('Scenario 4: Handles Thought Chain updates correctly', () => {
        // Pixel Check: Thoughts should update inside the collapsed region
        const thoughts = [
            { id: 't1', text: 'Planning...', type: 'thought' },
            { id: 't2', text: 'Searching tools...', type: 'tool' }
        ];

        updateStore({
            agentHistory: [
                {
                    id: 'ai1',
                    role: 'model',
                    text: '',
                    isStreaming: true,
                    thoughts: thoughts,
                    timestamp: 101
                }
            ]
        });

        render(<ChatOverlay />);

        // Verify Thought Chain Indicator
        expect(screen.getByText(/Cognitive Logic/i)).toBeInTheDocument();
        expect(screen.getByText(/2 ITERATIONS/i)).toBeInTheDocument();

        // Verify content is in the document (it's collapsible, usually open by default in code?)
        // The code says `useState(true)` for isOpen.
        expect(screen.getByText('Planning...')).toBeInTheDocument();
        expect(screen.getByText('Searching tools...')).toBeInTheDocument();
    });

    it('Scenario 5: Auto-scroll anchor logic', () => {
        // When history loads initially, it should start at the bottom
        updateStore({
            agentHistory: Array.from({ length: 10 }, (_, i) => ({ id: `msg-${i}`, role: 'user', text: `msg-${i}` }))
        });

        render(<ChatOverlay />);

        const list = screen.getByTestId('stream-list');
        // Virtuoso prop: initialTopMostItemIndex
        // Should be length - 1 (9)
        expect(list).toHaveAttribute('data-initial-index', '9');
    });

});
