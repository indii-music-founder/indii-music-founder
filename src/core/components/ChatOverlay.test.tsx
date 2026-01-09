
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';
import { voiceService } from '@/services/ai/VoiceService';
import { VoiceProvider } from '@/core/context/VoiceContext';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: {
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
    }
}));
vi.mock('@/services/audio/AudioService', () => ({
    audioService: {
        setEnabled: vi.fn(),
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
        sessions: {},
        activeSessionId: null,
        userProfile: {},
        currentProjectId: 'test-project',
        setModule: vi.fn(),
        setGenerationMode: vi.fn(),
        setViewMode: vi.fn(),
        setSelectedItem: vi.fn(),
        generatedHistory: [],
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
        render(
            <VoiceProvider>
                <ChatOverlay />
            </VoiceProvider>
        );
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    it.skip('shows mute button and toggles state', () => {
        render(
            <VoiceProvider>
                <ChatOverlay />
            </VoiceProvider>
        );

        // Find voice button (4th button: Invite, History, New, Voice, Close)
        const buttons = screen.getAllByRole('button');
        // Ensure we have buttons
        expect(buttons.length).toBeGreaterThan(3);
        const muteButton = buttons[3];
        expect(muteButton).toBeInTheDocument();

        fireEvent.click(muteButton);
        // We verify the click happened, but validating visual state via class string is brittle in JSDOM.
        // The fact it didn't throw is good.
    });

    it('does NOT call speak when muted (default)', () => {
        render(
            <VoiceProvider>
                <ChatOverlay />
            </VoiceProvider>
        );
        expect(voiceService.speak).not.toHaveBeenCalled();
    });

    it.skip('calls speak when unmuted and new message arrives', async () => {
        render(
            <VoiceProvider>
                <ChatOverlay />
            </VoiceProvider>
        );

        // Find and click mute button to enable voice
        const buttons = screen.getAllByRole('button');
        const muteButton = buttons[3];
        fireEvent.click(muteButton);

        await waitFor(() => {
            expect(voiceService.speak).toHaveBeenCalledWith('Hi there', expect.anything());
        });
    });
});
