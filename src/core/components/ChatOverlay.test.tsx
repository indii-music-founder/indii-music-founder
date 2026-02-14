
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/hooks/useMediaQuery', () => ({
    useMediaQuery: () => true // Desktop
}));

vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({ isListening: false, transcript: '' })
}));

vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        getAll: () => []
    }
}));

vi.mock('@/lib/mobile', () => ({
    requestNotificationPermission: vi.fn().mockResolvedValue(true)
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, style }: any) => (
            <div className={className} onClick={onClick} style={style}>{children}</div>
        ),
        button: ({ children, className, onClick, title }: any) => (
            <button className={className} onClick={onClick} title={title}>{children}</button>
        )
    },
    AnimatePresence: ({ children }: any) => <div>{children}</div>,
    useDragControls: () => ({ start: vi.fn() })
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    X: () => <span data-testid="icon-x">X</span>,
    Minimize2: () => <span data-testid="icon-minimize">Min</span>,
    RefreshCw: () => <span>Refresh</span>,
    Bot: () => <span>Bot</span>,
    GripHorizontal: () => <span>Grip</span>,
    ExternalLink: () => <span>Link</span>,
    Maximize2: () => <span data-testid="icon-maximize">Max</span>,
    Database: () => <span>DB</span>,
    Bell: () => <span>Bell</span>
}));

// Mock Child Components
vi.mock('./chat/ChatMessage', () => ({
    MessageItem: ({ msg }: any) => <div data-testid="message-item">{msg.text}</div>
}));

vi.mock('./command-bar/PromptArea', () => ({
    PromptArea: () => <div data-testid="prompt-area">Input</div>
}));

vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent }: any) => (
        <div>
            {data.map((item: any, index: number) => (
                <div key={item.id}>{itemContent(index, item)}</div>
            ))}
        </div>
    )
}));

// Mock Store
vi.mock('@/core/store', () => ({
    useStore: vi.fn()
}));

// Mock ErrorBoundary
vi.mock('@/core/components/ErrorBoundary', () => ({
    ErrorBoundary: ({ children }: any) => <div>{children}</div>
}));

describe('ChatOverlay Component', () => {
    const mockOnClose = vi.fn();
    const mockOnToggleMinimize = vi.fn();

    const defaultStoreState = {
        agentHistory: [],
        isAgentProcessing: false,
        chatChannel: 'indii',
        isCommandBarDetached: false,
        setCommandBarDetached: vi.fn(),
        agentWindowSize: { width: 400, height: 600 },
        setAgentWindowSize: vi.fn(),
        userProfile: { id: 'test', displayName: 'Test' },
        activeAgentProvider: 'native',
        setActiveAgentProvider: vi.fn(),
        activeSessionId: 'session-1',
        sessions: { 'session-1': { participants: [] } }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore).mockImplementation((selector: any) => selector(defaultStoreState));
    });

    it('should render empty state correctly', () => {
        render(<ChatOverlay onClose={mockOnClose} />);

        expect(screen.getByText('How can I help you?')).toBeInTheDocument();
        expect(screen.getByTestId('prompt-area')).toBeInTheDocument();
        expect(screen.queryByTestId('message-item')).not.toBeInTheDocument();
    });

    it('should render messages', () => {
        const messages = [
            { id: '1', role: 'user', text: 'Hello', timestamp: 1000 },
            { id: '2', role: 'model', text: 'Hi', timestamp: 1001 }
        ];

        vi.mocked(useStore).mockImplementation((selector: any) => selector({
            ...defaultStoreState,
            agentHistory: messages
        }));

        render(<ChatOverlay onClose={mockOnClose} />);

        const items = screen.getAllByTestId('message-item');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('Hello');
        expect(items[1]).toHaveTextContent('Hi');
    });

    it('should handle close button click', () => {
        render(<ChatOverlay onClose={mockOnClose} />);

        const closeBtn = screen.getByLabelText('Close Agent');
        fireEvent.click(closeBtn);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle minimize toggle', () => {
        render(<ChatOverlay onClose={mockOnClose} onToggleMinimize={mockOnToggleMinimize} />);

        const minimizeBtn = screen.getByTestId('minimize-chat-btn'); // Using testid because aria-label might be ambiguous or mocked icon makes it tricky?
        // Actually mocked Minimize2 is inside the button.
        // The button has aria-label="Minimize chat"

        fireEvent.click(minimizeBtn);

        // Local state updates (not externally exposed except via callback potentially, but onToggleMinimize is prop)
        expect(mockOnToggleMinimize).toHaveBeenCalled();
    });
});
