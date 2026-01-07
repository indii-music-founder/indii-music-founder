
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: {
        speak: vi.fn(),
        stopSpeaking: vi.fn(),
    }
}));

// Mock context
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({
        isVoiceEnabled: false,
        setVoiceEnabled: vi.fn(),
    })
}));

// Mock react-virtuoso
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
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('📱 Viewport: ChatOverlay Responsiveness', () => {
    const WIDE_TABLE_MARKDOWN = `
| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
|----------|----------|----------|----------|----------|
| Data 1   | Data 2   | Data 3   | Data 4   | Data 5   |
`;

    const mockStoreState = {
        agentHistory: [
            { id: '1', role: 'model', text: WIDE_TABLE_MARKDOWN, timestamp: 1 }
        ],
        isAgentOpen: true,
        userProfile: {},
        sessions: {},
        activeSessionId: null,
        loadSessions: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock useStore selector behavior
        (useStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: any) => {
            if (typeof selector === 'function') {
                return selector(mockStoreState);
            }
            return mockStoreState;
        });

        // Mock useStore.getState
        (useStore as any).getState = vi.fn(() => mockStoreState);

        // Set Viewport to Mobile (iPhone SE: 375px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
    });

    it('wraps markdown tables in a scrollable container to prevent layout breakage', () => {
        render(<ChatOverlay />);

        // Verify table exists
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();

        // The "Unbreakable Table" Test:
        // Markdown tables must be wrapped in a container with overflow-x-auto
        // to prevent them from breaking the mobile layout.
        const wrapper = table.parentElement;
        expect(wrapper).toHaveClass('overflow-x-auto');

        // Bonus: Check for custom scrollbar styling if applicable
        // expect(wrapper).toHaveClass('custom-scrollbar');
    });
});
