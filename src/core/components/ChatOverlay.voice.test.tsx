import { render, screen, act } from '@testing-library/react';
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

// Mock Voice Context - Dynamic Mock
const mockUseVoice = vi.fn();
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => mockUseVoice()
}));

// Mock Voice Service
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: { speak: vi.fn(), stopSpeaking: vi.fn() }
}));

// Mock Toast Context
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ toast: vi.fn() })
}));

// Mock Complex Children to isolate the test
vi.mock('react-virtuoso', () => ({
    Virtuoso: () => <div data-testid="stream-list" />,
    VirtuosoHandle: {},
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
        button: ({ children, className, onClick, ...props }: any) => <button className={className} onClick={onClick} {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useDragControls: () => ({ start: vi.fn() }),
}));

vi.mock('react-markdown', () => ({
    default: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: any) => <span>{children}</span>
}));

// Mock PromptArea
vi.mock('./command-bar/PromptArea', () => ({
    PromptArea: () => <div data-testid="mock-prompt-area" />
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
    agentWindowSize: { width: 400, height: 600 },
    setAgentWindowSize: vi.fn(),
    isCommandBarDetached: false,
    setCommandBarDetached: vi.fn(),
    setChatChannel: vi.fn(),
    // Add dependencies that might be needed by PromptArea (even if mocked, good practice)
    commandBarInput: '',
    commandBarAttachments: [],
};

describe('👁️ Pixel: Voice Interaction States', () => {

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
        // Default Voice State: Not listening
        mockUseVoice.mockReturnValue({
            isVoiceEnabled: true,
            setVoiceEnabled: vi.fn(),
            isListening: false,
            transcript: ''
        });
        updateStore({});
    });

    it('Scenario 1: Idle state (No status footer)', () => {
        render(<ChatOverlay onClose={vi.fn()} />);

        // Assert: No status bar visible
        const statusBar = screen.queryByRole('status');
        expect(statusBar).not.toBeInTheDocument();
        expect(screen.queryByText(/LISTENING/i)).not.toBeInTheDocument();
    });

    it('Scenario 2: Listening state shows indicator and transcript', () => {
        // Setup: Listening with empty transcript
        mockUseVoice.mockReturnValue({
            isVoiceEnabled: true,
            setVoiceEnabled: vi.fn(),
            isListening: true,
            transcript: ''
        });

        const { rerender } = render(<ChatOverlay onClose={vi.fn()} />);

        // Assert: Status bar visible with "LISTENING..."
        const statusBar = screen.getByRole('status');
        expect(statusBar).toBeInTheDocument();
        expect(statusBar).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByText('LISTENING...')).toBeInTheDocument();

        // Update: User starts talking
        mockUseVoice.mockReturnValue({
            isVoiceEnabled: true,
            setVoiceEnabled: vi.fn(),
            isListening: true,
            transcript: 'Hello world'
        });
        rerender(<ChatOverlay onClose={vi.fn()} />);

        // Assert: Transcript appears
        expect(screen.getByText(/"Hello world"/)).toBeInTheDocument();
    });

    it('Scenario 3: Transition from Listening to Processing', () => {
        // Initial: Listening
        mockUseVoice.mockReturnValue({
            isVoiceEnabled: true,
            setVoiceEnabled: vi.fn(),
            isListening: true,
            transcript: 'Final command'
        });

        const { rerender } = render(<ChatOverlay onClose={vi.fn()} />);
        expect(screen.getByText('LISTENING...')).toBeInTheDocument();

        // Transition: Stop listening, Start processing
        mockUseVoice.mockReturnValue({
            isVoiceEnabled: true,
            setVoiceEnabled: vi.fn(),
            isListening: false, // Voice stops
            transcript: ''
        });
        updateStore({ isAgentProcessing: true }); // AI starts

        rerender(<ChatOverlay onClose={vi.fn()} />);

        // Assert: LISTENING is gone, PROCESSING is present
        expect(screen.queryByText('LISTENING...')).not.toBeInTheDocument();
        expect(screen.getByText('PROCESSING RESPONSE...')).toBeInTheDocument();

        // Assert: Status role remains for continuity (or verify new element)
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

});
