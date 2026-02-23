import { render, screen, fireEvent } from '@/test/utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';

import { createMockStore } from '@/test/utils';

// --- MOCKS ---

const { mockSetCommandBarDetached, defaultStoreState } = vi.hoisted(() => {
    const mockSetCommandBarDetached = vi.fn();
    return {
        mockSetCommandBarDetached,
        defaultStoreState: {
            // Include userProfile and other base properties so useStore doesn't return
            // undefined for them if a selector asks
            userProfile: null,
            currentModuleId: 'dashboard',
            showCommandBar: false,
            updateProfile: vi.fn(),
            setModule: vi.fn(),
            toggleCommandBar: vi.fn(),
            addToast: vi.fn(),

            agentHistory: [],
            isAgentProcessing: false,
            chatChannel: 'indii',
            isCommandBarDetached: false,
            setCommandBarDetached: mockSetCommandBarDetached,
            agentWindowSize: { width: 400, height: 600 },
            setAgentWindowSize: vi.fn(),
            sessions: {},
            activeSessionId: null,
        }
    };
});

vi.mock('@/core/store', async () => ({
    useStore: vi.fn((selector) => {
        if (typeof selector === 'function') {
            return selector(defaultStoreState);
        }
        return defaultStoreState;
    })
}));

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
    const mockOnToggleMinimize = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useVoice as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            isListening: false,
            transcript: '',
        });

        (useVoice as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            isListening: false,
            transcript: '',
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
            // Since useStore is mocked at module level, we need to temporarily
            // override its implementation or manipulate the defaultStoreState
            // The previous test re-mocked it inline. We can do that or mutate.
            // Mutating is simpler.
            defaultStoreState.isCommandBarDetached = true;

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
