
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';

// Extend expect with jest-axe
expect.extend(toHaveNoViolations);

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

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        showToast: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        loading: vi.fn(),
        updateProgress: vi.fn(),
        dismiss: vi.fn(),
        promise: vi.fn(),
    })
}));

// Mock react-virtuoso
// role="feed" requires children with role="article".
// Since itemContent returns a MessageItem which is a motion.div (mocked to div),
// we should ensure the structure is correct for the mock.
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent, atBottomStateChange }: any) => (
        <div>
            <button
                data-testid="simulate-scroll-up"
                onClick={() => atBottomStateChange && atBottomStateChange(false)}
            >
                Simulate Scroll Up
            </button>
            <div role="feed" aria-label="Chat history">
                {data?.map((item: any, index: number) => (
                    <article role="article" aria-label={`Message ${index + 1}`} key={item.id || index}>
                        {itemContent(index, item)}
                    </article>
                ))}
            </div>
        </div>
    ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
        span: ({ children, className, ...props }: any) => <span className={className} {...props}>{children}</span>,
        button: ({ children, className, ...props }: any) => <button className={className} {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useDragControls: () => ({
        start: vi.fn(),
    }),
}));

// Mock TextEffect to avoid motion issues in test
vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}));

// Mock ReactMarkdown since it's used in ChatOverlay
vi.mock('react-markdown', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('ChatOverlay Accessibility', () => {
    const mockAgentHistory = [
        {
            id: '1',
            role: 'model',
            text: 'I am thinking...',
            thoughts: [{ id: 't1', text: 'Analyzing request...', type: 'thought' }],
            timestamp: 1
        }
    ];

    const mockStoreState = {
        agentHistory: mockAgentHistory,
        isAgentOpen: true,
        userProfile: { brandKit: { referenceImages: [] } },
        activeSessionId: 'sess1',
        sessions: { 'sess1': { title: 'Test Session', participants: ['indii'] } },
        loadSessions: vi.fn(),
        toggleAgentWindow: vi.fn(),
        agentWindowSize: { width: 400, height: 600 },
        setAgentWindowSize: vi.fn(),
        isCommandBarDetached: false,
        setCommandBarDetached: vi.fn(),
        chatChannel: 'agent',
        setChatChannel: vi.fn(),
        isAgentProcessing: false,
        currentModule: 'dashboard',
        setModule: vi.fn(),
        commandBarInput: '',
        commandBarAttachments: [],
        setCommandBarInput: vi.fn(),
        setCommandBarAttachments: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });
    });

    it('should have no initial accessibility violations', async () => {
        const { container } = render(<ChatOverlay onClose={vi.fn()} />);
        const results = await axe(container);
        // Using object syntax for extend might have issues with how toHaveNoViolations is called in some envs,
        // but here the error "Cannot read properties of undefined (reading 'call')" typically means the matcher isn't found on expect object.
        // However, we extended it. Let's try debug log if needed, or re-verify extension.
        expect(results).toHaveNoViolations();
    });

    it('should manage focus and state for ThoughtChain toggle', () => {
        render(<ChatOverlay onClose={vi.fn()} />);

        // Find the toggle button. It renders "Cognitive Logic".
        // The TextEffect mock renders it as a span.
        // We look for the button containing it.
        const toggleButton = screen.getByText('Cognitive Logic').closest('button');
        expect(toggleButton).toBeInTheDocument();

        // We need to fix the component to have aria-expanded.
        // Currently it does NOT have it, so this test is expected to FAIL until we fix the component.
        // But since we want to fix the test, let's assert what SHOULD be there.
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

        // Click to toggle
        fireEvent.click(toggleButton!);
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-label on icon-only buttons', () => {
        render(<ChatOverlay onClose={vi.fn()} />);

        // Minimize button (by icon, but usually best to find by role and label)
        const minimizeBtn = screen.getByLabelText('Minimize chat');
        expect(minimizeBtn).toBeInTheDocument();

        // Close button
        const closeBtn = screen.getByLabelText('Close Agent');
        expect(closeBtn).toBeInTheDocument();
    });

    it('should announce streaming messages politely', () => {
        const streamingState = {
            ...mockStoreState,
            agentHistory: [{
                id: 'streaming-1',
                role: 'model',
                text: 'Generating...',
                isStreaming: true,
                timestamp: Date.now()
            }]
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(streamingState);
            return streamingState;
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        const messageContainer = screen.getByTestId('agent-message');
        expect(messageContainer).toHaveAttribute('aria-live', 'polite');

        // Also check for the thinking status
        const statusIndicator = screen.getByRole('status');
        expect(statusIndicator).toHaveAttribute('aria-label', 'AI is thinking');
    });

    it('should show accessible "Resume Feed" button when scrolled up', () => {
        render(<ChatOverlay onClose={vi.fn()} />);

        // Initially not visible
        expect(screen.queryByText('Resume Feed')).not.toBeInTheDocument();

        // Simulate scroll up via the mock
        fireEvent.click(screen.getByTestId('simulate-scroll-up'));

        // Should be visible
        const resumeBtn = screen.getByRole('button', { name: 'Resume Feed' });
        expect(resumeBtn).toBeInTheDocument();
    });

    it('should have accessible name for ThoughtChain region', () => {
        render(<ChatOverlay onClose={vi.fn()} />);

        const toggleButton = screen.getByText('Cognitive Logic').closest('button');
        const region = screen.getByRole('region');

        expect(toggleButton).toHaveAttribute('id');
        const buttonId = toggleButton?.getAttribute('id');

        expect(region).toHaveAttribute('aria-labelledby', buttonId);
    });

    it('should have accessible placeholder when chat is empty', async () => {
        const emptyState = {
            ...mockStoreState,
            agentHistory: []
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(emptyState);
            return emptyState;
        });

        const { container } = render(<ChatOverlay onClose={vi.fn()} />);

        const results = await axe(container);
        expect(results).toHaveNoViolations();

        // Verify the heading is present
        expect(screen.getByRole('heading', { name: "How can I help you?" })).toBeInTheDocument();
    });

    it('should show accessible status footer when processing', () => {
        const processingState = {
            ...mockStoreState,
            isAgentProcessing: true
        };

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(processingState);
            return processingState;
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        // We expect the footer to be present with role="status"
        // Since MessageItem is NOT streaming in this state (agentHistory is default),
        // there should be only one role="status" - the footer.

        const footerStatus = screen.getByRole('status');
        expect(footerStatus).toHaveAttribute('aria-live', 'polite');
        expect(footerStatus).toHaveTextContent('PROCESSING RESPONSE...');
    });
});
