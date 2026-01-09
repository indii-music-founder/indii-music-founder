
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';
import { voiceService } from '@/services/ai/VoiceService';

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

// Mock react-virtuoso to render items directly
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent }: any) => (
        <div data-testid="virtuoso-list">
            {data?.map((item: any, index: number) => (
                <div key={item.id || index}>{itemContent(index, item)}</div>
            ))}
        </div>
    ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ChatOverlay', () => {
    const mockAgentHistory = [
        { id: '1', role: 'user', text: 'Hello', timestamp: 1 },
        { id: '2', role: 'model', text: 'Hi there', timestamp: 2 }
    ];

    const mockStoreState = {
        agentHistory: mockAgentHistory,
        isAgentOpen: true,
        loadSessions: vi.fn(),
        createSession: vi.fn(),
        toggleAgentWindow: vi.fn(),
        sessions: {},
        activeSessionId: null
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // useStore is called with selectors, so we need to call the selector on our mock state
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });
    });

    it('renders messages correctly', () => {
        render(<ChatOverlay />);
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    // Note: Since VoiceContext is mocked with defaults (isVoiceEnabled=false, setVoiceEnabled=vi.fn()),
    // the UI will show the "Unmute" state initially.
    // The previous test logic assumed internal state management, but now we use context.
    // The mocked useVoice hook returns static values, so clicking won't change the return value of useVoice unless we mock the implementation to be stateful.

    it('shows mute button', () => {
        render(<ChatOverlay />);
        // useVoice mock returns isVoiceEnabled: false
        expect(screen.getByTitle('Unmute Text-to-Speech')).toBeInTheDocument();
    });

    it('does NOT call speak when muted (default)', () => {
        render(<ChatOverlay />);
        expect(voiceService.speak).not.toHaveBeenCalled();
    });
});
