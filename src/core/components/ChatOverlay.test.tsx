
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';
import { voiceService } from '@/services/ai/VoiceService';

// Mock dependencies
vi.mock('@/core/store');
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

    it('shows mute button and toggles state', () => {
        render(<ChatOverlay />);
        const muteButton = screen.getByTitle('Unmute Text-to-Speech'); // Initial state is muted (isMuted=true)
        expect(muteButton).toBeInTheDocument();

        fireEvent.click(muteButton);
        expect(screen.getByTitle('Mute Text-to-Speech')).toBeInTheDocument();
    });

    it('does NOT call speak when muted (default)', () => {
        render(<ChatOverlay />);
        expect(voiceService.speak).not.toHaveBeenCalled();
    });

    it('calls speak when unmuted and new message arrives', async () => {
        const { rerender } = render(<ChatOverlay />);

        // Unmute
        const muteButton = screen.getByTitle('Unmute Text-to-Speech');
        fireEvent.click(muteButton);

        // rerender with same history shouldn't trigger (handled by ref check in component, but effect runs on mount if condition met)
        // actually, effect runs on history change.
        // Let's verify it triggered for the existing last message if we just unmuted?
        // The effect dependency includes [isMuted]. So yes, it should try to speak the last message.

        await waitFor(() => {
            expect(voiceService.speak).toHaveBeenCalledWith('Hi there');
        });
    });
});
