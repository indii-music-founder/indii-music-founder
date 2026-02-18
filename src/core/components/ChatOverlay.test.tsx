import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';
import { voiceService } from '@/services/ai/VoiceService';
import { useVoice } from '@/core/context/VoiceContext';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({
        isVoiceEnabled: false,
        setVoiceEnabled: vi.fn(),
    })
}));
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: {
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
    }
}));

// Mock ToastContext
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    })
}));

// Mock VoiceContext
const mockSetVoiceEnabled = vi.fn();
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: vi.fn(() => ({
        isVoiceEnabled: false,
        setVoiceEnabled: mockSetVoiceEnabled
    }))
}));

// Mock react-virtuoso to verify props and render content
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent, followOutput }: any) => (
        <div data-testid="virtuoso-list" data-follow-output={followOutput}>
            {data?.map((item: any, index: number) => (
                <div key={item.id || index}>{itemContent(index, item)}</div>
            ))}
        </div>
    ),
    VirtuosoHandle: {},
}));

// Mock motion
vi.mock('motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useDragControls: () => ({ start: vi.fn() }),
}));

describe('ChatOverlay', () => {
    const mockAgentHistory = [
        { id: '1', role: 'user', text: 'Hello', timestamp: 1 },
        { id: '2', role: 'model', text: 'Hi there', timestamp: 2 }
    ];

    const mockStoreState = {
        agentHistory: mockAgentHistory,
        isAgentOpen: true,
        userProfile: { brandKit: { referenceImages: [] } },
        activeSessionId: 'session-1',
        sessions: {
            'session-1': { title: 'Test Session', participants: ['indii'], messages: [] }
        },
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        toggleAgentWindow: vi.fn(),
        isAgentProcessing: false,
        chatChannel: 'indii',
        setChatChannel: vi.fn(),
        currentModule: 'dashboard',
        agentWindowSize: { width: 400, height: 600 },
        setAgentWindowSize: vi.fn(),
        isCommandBarDetached: false,
        setCommandBarDetached: vi.fn(),
        commandBarAttachments: [],
        commandBarInput: '',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset voice context mock to default
        (useVoice as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            isVoiceEnabled: false,
            setVoiceEnabled: mockSetVoiceEnabled
        });

        // Setup store mock
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });
    });

    it('renders messages correctly', () => {
        render(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    // --- NEW PIXEL TESTS ---

    it('shows streaming indicators (dots) when message is streaming', () => {
        const streamingState = {
            ...mockStoreState,
            agentHistory: [
                { id: '1', role: 'model', text: 'Thinking...', timestamp: 1, isStreaming: true }
            ]
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(streamingState);
            return streamingState;
        });

        const { container } = render(<ChatOverlay onClose={vi.fn()} />);

        // The dots are rendered as motion.divs with specific classes inside the message.
        // We look for elements containing the specific Tailwind classes for the dots.
        // Note: Tailwind classes with dots (e.g. w-1.5) need to be escaped in querySelector or use attribute selector.
        const dots = container.querySelectorAll('[class*="w-1.5"][class*="h-1.5"]');
        expect(dots.length).toBeGreaterThan(0);
    });

    it('renders markdown code blocks correctly', () => {
        const markdownState = {
            ...mockStoreState,
            agentHistory: [
                { id: '1', role: 'model', text: 'Here is some code:\n```javascript\nconst a = 1;\n```', timestamp: 1 }
            ]
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(markdownState);
            return markdownState;
        });

        const { container } = render(<ChatOverlay onClose={vi.fn()} />);

        // Expect a code block with class 'language-javascript' (rendered by ReactMarkdown + remarkGfm)
        const codeBlock = container.querySelector('code.language-javascript');
        expect(codeBlock).toBeInTheDocument();
        expect(codeBlock).toHaveTextContent('const a = 1;');
    });
});
