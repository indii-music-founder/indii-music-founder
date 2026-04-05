import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RightPanel from './RightPanel';
import { useStore } from '../store';

vi.mock('../store', () => {
    const mockUseStore = vi.fn();
    (mockUseStore as any).setState = vi.fn();
    return { useStore: mockUseStore };
});

// Mock sub-components
vi.mock('./right-panel/AssetsPanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="assets-panel">
            Assets Panel Content
            <button onClick={toggleRightPanel} data-testid="close-assets">Close</button>
        </div>
    ),
}));

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

vi.mock('./right-panel/WorkflowPanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="workflow-panel">
            Workflow Panel Content
            <button onClick={toggleRightPanel} data-testid="close-workflow">Close</button>
        </div>
    ),
}));

vi.mock('./right-panel/KnowledgePanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="knowledge-panel">
            Knowledge Panel Content
            <button onClick={toggleRightPanel} data-testid="close-knowledge">Close</button>
        </div>
    ),
}));

vi.mock('./agent/AgentChat', () => ({
    AgentChat: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="agent-chat">
            Agent Chat Content
            <button onClick={toggleRightPanel} data-testid="close-agent">Close</button>
        </div>
    ),
}));

vi.mock('./agent/BatchingStatus', () => ({
    BatchingStatus: () => <div data-testid="batching-status" />,
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
vi.mock('./command-bar/PromptArea', () => ({
    PromptArea: () => <div data-testid="prompt-area" />,
}));

vi.mock('motion/react', () => ({
    motion: {
        aside: ({ children, className, ...props }: any) => <aside className={className} {...props}>{children}</aside>,
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
        button: ({ children, className, ...props }: any) => <button className={className} {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('RightPanel', () => {
    const mockSetRightPanelTab = vi.fn();
    const mockToggleRightPanel = vi.fn();
    const mockSetRightPanelView = vi.fn();
    const mockToggleAgentWindow = vi.fn();

    const defaultState = {
        rightPanelTab: 'context',
        setRightPanelTab: mockSetRightPanelTab,
        isRightPanelOpen: false,
        toggleRightPanel: mockToggleRightPanel,
        isAgentOpen: false,
        toggleAgentWindow: mockToggleAgentWindow,
        agentHistory: [],
        currentModule: 'dashboard',
        rightPanelView: 'messages' as const,
        setRightPanelView: mockSetRightPanelView,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(defaultState);
    });

    it('renders collapsed state with tab buttons', () => {
        render(<RightPanel />);

        expect(screen.getByTitle('Expand Panel')).toBeInTheDocument();
        expect(screen.getByTitle('Context Controls')).toBeInTheDocument();
        expect(screen.getByTitle('Project Assets')).toBeInTheDocument();
        expect(screen.getByTitle('Omni Agent')).toBeInTheDocument();

        expect(screen.queryByTestId('creative-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('assets-panel')).not.toBeInTheDocument();
    });

    it('toggles panel when expand button is clicked', () => {
        render(<RightPanel />);
        fireEvent.click(screen.getByTitle('Expand Panel'));
        expect(mockToggleRightPanel).toHaveBeenCalled();
    });

    it('switches to Assets tab when Assets icon is clicked', () => {
        render(<RightPanel />);
        fireEvent.click(screen.getByTitle('Project Assets'));
        expect(mockSetRightPanelTab).toHaveBeenCalledWith('assets');
    });

    it('switches to Agent tab when Agent icon is clicked', () => {
        render(<RightPanel />);
        fireEvent.click(screen.getByTitle('Omni Agent'));
        expect(mockSetRightPanelTab).toHaveBeenCalledWith('agent');
    });

    it('renders CreativePanel when open and tab is context and module is creative', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'context',
            currentModule: 'creative',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(screen.getByTestId('creative-panel')).toBeInTheDocument();
    });

    it('renders fallback when open and tab is context and module has no panel', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'context',
            currentModule: 'dashboard',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(screen.getByText('No Tool Selected')).toBeInTheDocument();
    });

    it('renders AssetsPanel when open and tab is assets', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'assets',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(screen.getByTestId('assets-panel')).toBeInTheDocument();
    });

    it('renders Agent content when open and tab is agent', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'agent',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getByTestId('batching-status')).toBeInTheDocument();
    });
});
