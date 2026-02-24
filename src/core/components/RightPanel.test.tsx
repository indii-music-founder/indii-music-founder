import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RightPanel from './RightPanel';
import { useStore } from '../store';

// Mock the store
vi.mock('../store', () => ({
    useStore: vi.fn(),
}));

// Mock sub-components
vi.mock('./right-panel/CreativePanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="creative-panel">
            Creative Panel Content
            <button onClick={toggleRightPanel} data-testid="close-creative">Close</button>
        </div>
    ),
}));

vi.mock('./right-panel/VideoPanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="video-panel">
            Video Panel Content
            <button onClick={toggleRightPanel} data-testid="close-video">Close</button>
        </div>
    ),
}));

// Mock remaining sub-components used by RightPanel
vi.mock('@/components/project/ResourceTree', () => ({
    ResourceTree: () => <div data-testid="resource-tree" />,
}));
vi.mock('@/modules/files/FilePreview', () => ({
    default: () => <div data-testid="file-preview" />,
}));
vi.mock('@/core/theme/moduleColors', () => ({
    getColorForModule: () => ({ bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-700', ring: 'ring-gray-700' }),
}));
vi.mock('./command-bar/PromptArea', () => ({
    PromptArea: () => <div data-testid="prompt-area" />,
}));
vi.mock('./ConversationHistoryList', () => ({
    ConversationHistoryList: () => <div data-testid="conversation-history" />,
}));
vi.mock('@/core/components/chat/ChatMessage', () => ({
    MessageItem: ({ msg }: any) => <div data-testid="message-item">{msg?.text}</div>,
}));
vi.mock('@/modules/dashboard/components/AssetSpotlight', () => ({
    default: () => <div data-testid="asset-spotlight" />,
}));
vi.mock('motion/react', () => ({
    motion: {
        aside: ({ children, className, ...props }: any) => <aside className={className} {...props}>{children}</aside>,
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('RightPanel', () => {
    const mockSetModule = vi.fn();
    const mockToggleRightPanel = vi.fn();

    const mockToggleAgentWindow = vi.fn();
    const mockSetView = vi.fn();

    const defaultState = {
        currentModule: 'dashboard',
        setModule: mockSetModule,
        isRightPanelOpen: false,
        toggleRightPanel: mockToggleRightPanel,
        isAgentOpen: false,
        toggleAgentWindow: mockToggleAgentWindow,
        agentHistory: [],
        userProfile: null,
        isAgentProcessing: false,
        rightPanelView: 'messages' as const,
        setRightPanelView: mockSetView,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default store state
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(defaultState);
    });

    it('renders collapsed state correctly', () => {
        render(<RightPanel />);

        // Should show expand button
        expect(screen.getByTitle('Expand Panel')).toBeInTheDocument();

        // Should show module shortcuts
        expect(screen.getByTitle('Image Studio')).toBeInTheDocument();
        expect(screen.getByTitle('Video Studio')).toBeInTheDocument();

        // Should NOT show panels
        expect(screen.queryByTestId('creative-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('video-panel')).not.toBeInTheDocument();
    });

    it('toggles panel when expand button is clicked', () => {
        render(<RightPanel />);

        fireEvent.click(screen.getByTitle('Expand Panel'));
        expect(mockToggleRightPanel).toHaveBeenCalled();
    });

    it('switches to Creative module when Image Studio icon is clicked', () => {
        render(<RightPanel />);

        fireEvent.click(screen.getByTitle('Image Studio'));
        expect(mockSetModule).toHaveBeenCalledWith('creative');
    });

    it('switches to Video module when Video Studio icon is clicked', () => {
        render(<RightPanel />);

        fireEvent.click(screen.getByTitle('Video Studio'));
        expect(mockSetModule).toHaveBeenCalledWith('video');
    });

    it('renders CreativePanel when open and module is creative', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            currentModule: 'creative',
            isRightPanelOpen: true,
        });

        render(<RightPanel />);

        expect(screen.getByTestId('creative-panel')).toBeInTheDocument();
        expect(screen.queryByTitle('Expand Panel')).not.toBeInTheDocument();
    });

    it('renders VideoPanel when open and module is video', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            currentModule: 'video',
            isRightPanelOpen: true,
        });

        render(<RightPanel />);

        expect(screen.getByTestId('video-panel')).toBeInTheDocument();
    });

    it('renders placeholder when open but no tool selected', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            currentModule: 'dashboard',
            isRightPanelOpen: true,
        });

        render(<RightPanel />);

        expect(screen.getByText('No Tool Selected')).toBeInTheDocument();
        expect(screen.getByText(/Select a tool from the sidebar/)).toBeInTheDocument();
    });
});
