import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';

// --- MOCKS ---

vi.mock('@/core/store');
vi.mock('@/core/context/VoiceContext');
vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        getAll: () => [],
    }
}));
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: {
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
    }
}));

// Mock PromptArea to avoid testing its internal logic and dependencies
vi.mock('./command-bar/PromptArea', () => ({
    PromptArea: () => <div data-testid="mock-prompt-area">Prompt Area</div>
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, className, drag, dragControls, dragListener, dragMomentum, dragElastic, ...props }: any) => <div className={className} {...props}>{children}</div>,
        button: ({ children, onClick, className, ...props }: any) => <button onClick={onClick} className={className} {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useDragControls: () => ({ start: vi.fn() }),
}));

// Mock Virtuoso
vi.mock('react-virtuoso', () => ({
    Virtuoso: () => <div data-testid="virtuoso-list" />,
    VirtuosoHandle: {},
}));

describe('🖱️ Click: ChatOverlay Interactions', () => {
    const mockSetCommandBarDetached = vi.fn();
    const mockOnToggleMinimize = vi.fn();
    const mockOnClose = vi.fn();

    const defaultStoreState = {
        agentHistory: [],
        isAgentProcessing: false,
        chatChannel: 'indii',
        isCommandBarDetached: false,
        setCommandBarDetached: mockSetCommandBarDetached,
        agentWindowSize: { width: 400, height: 600 },
        setAgentWindowSize: vi.fn(),
        sessions: {},
        activeSessionId: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        (useVoice as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            isListening: false,
            transcript: '',
        });

        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(defaultStoreState);
            }
            return defaultStoreState;
        });
    });

    it('Scenario 1: Detach Input Lifecycle (Click -> Action -> Feedback)', () => {
        // 1. Initial Render (Docked)
        const { rerender } = render(
            <ChatOverlay onClose={mockOnClose} onToggleMinimize={mockOnToggleMinimize} />
        );

        // Assert: PromptArea is visible
        expect(screen.getByTestId('mock-prompt-area')).toBeInTheDocument();

        // Assert: Button state - component uses title attribute, not data-testid
        const detachBtn = screen.getByTitle('Detach Input');
        expect(detachBtn).toBeInTheDocument();

        // 2. Interaction: Click Detach
        fireEvent.click(detachBtn);

        // Assert: Action called
        expect(mockSetCommandBarDetached).toHaveBeenCalledWith(true);

        // 3. Re-render with new state (Detached)
        const detachedState = { ...defaultStoreState, isCommandBarDetached: true };
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(detachedState);
            }
            return detachedState;
        });

        rerender(
            <ChatOverlay onClose={mockOnClose} onToggleMinimize={mockOnToggleMinimize} />
        );

        // Assert: PromptArea is NOT visible
        expect(screen.queryByTestId('mock-prompt-area')).not.toBeInTheDocument();

        // Assert: Button state updated - title changes to "Dock Input"
        const dockedBtn = screen.getByTitle('Dock Input');
        expect(dockedBtn).toBeInTheDocument();
    });

    it('Scenario 2: Minimize Interaction', () => {
        render(
            <ChatOverlay onClose={mockOnClose} onToggleMinimize={mockOnToggleMinimize} />
        );

        // Component uses aria-label, not data-testid
        const minimizeBtn = screen.getByRole('button', { name: 'Minimize chat' });

        // Interaction
        fireEvent.click(minimizeBtn);

        // Assert
        expect(mockOnToggleMinimize).toHaveBeenCalledTimes(1);
    });
});
