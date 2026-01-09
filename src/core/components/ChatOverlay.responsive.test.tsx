
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

    const LONG_CODE_MARKDOWN = `
\`\`\`javascript
const veryLongVariableName = "This is a very long string that would definitely break the layout on a mobile device if it was not wrapped in a scrollable container to ensure the user can read the full code without zooming out.";
\`\`\`
`;

    let mockStoreState: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockStoreState = {
            agentHistory: [
                { id: '1', role: 'model', text: WIDE_TABLE_MARKDOWN, timestamp: 1 }
            ],
            isAgentOpen: true,
            userProfile: {},
            sessions: {},
            activeSessionId: null,
            loadSessions: vi.fn(),
            toggleAgentWindow: vi.fn(),
        };

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
        const wrapper = table.parentElement;
        expect(wrapper).toHaveClass('overflow-x-auto');
    });

    it('wraps code blocks in a scrollable container to prevent layout breakage', () => {
        // Update store to use code markdown
        mockStoreState.agentHistory = [
            { id: '2', role: 'model', text: LONG_CODE_MARKDOWN, timestamp: 2 }
        ];

        render(<ChatOverlay />);

        // Verify code block text exists
        const codeElement = screen.getByText(/veryLongVariableName/);
        expect(codeElement).toBeInTheDocument();

        // The "Unbreakable Code" Test:
        // Code blocks should be in a pre tag that allows horizontal scrolling
        const preElement = codeElement.closest('pre');
        expect(preElement).toBeInTheDocument();

        // Check if the pre element OR its parent has overflow handling.
        // Tailwind prose usually puts it on 'pre', but sometimes we wrap it.
        // We accept either explicit class or specific style.
        // Since we are Viewport, we prefer explicit class 'overflow-x-auto' or 'overflow-auto'.

        // If the 'pre' itself doesn't have it, we check the parent.
        const isScrollable =
            preElement?.classList.contains('overflow-x-auto') ||
            preElement?.classList.contains('overflow-auto') ||
            preElement?.parentElement?.classList.contains('overflow-x-auto');

        expect(isScrollable).toBe(true);
    });
});
