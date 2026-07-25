import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import RightPanel from './RightPanel';
import { useStore } from '../store';

Element.prototype.scrollTo = vi.fn();

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

vi.mock('./right-panel/StudioControlsPanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="studio-controls-panel">
            Studio Controls Content
            <button onClick={toggleRightPanel} data-testid="close-studio">Close</button>
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

vi.mock('./right-panel/ArtifactsPanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="artifacts-panel">
            Artifacts Panel Content
            <button onClick={toggleRightPanel} data-testid="close-artifacts">Close</button>
        </div>
    ),
}));

vi.mock('./right-panel/ToolApprovalsPanel', () => ({
    default: ({ toggleRightPanel }: { toggleRightPanel: () => void }) => (
        <div data-testid="tool-approvals-panel">
            Approvals Panel Content
            <button onClick={toggleRightPanel} data-testid="close-approvals">Close</button>
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
    motion: new Proxy({}, {
        get: (_target, property: string) => {
            if (property === 'aside') {
                return ({ children, ...props }: any) => <aside {...props}>{children}</aside>;
            }
            if (property === 'div') {
                return ({ children, ...props }: any) => <div {...props}>{children}</div>;
            }
            if (property === 'button') {
                return ({ children, ...props }: any) => <button {...props}>{children}</button>;
            }
            return ({ children, ...props }: any) => React.createElement(property, props, children);
        }
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('RightPanel', () => {
    const mockSetRightPanelTab = vi.fn();
    const mockToggleRightPanel = vi.fn();
    const mockSetRightPanelView = vi.fn();

    const defaultState = {
        rightPanelTab: 'context',
        setRightPanelTab: mockSetRightPanelTab,
        isRightPanelOpen: false,
        toggleRightPanel: mockToggleRightPanel,
        isAgentOpen: false,
        agentHistory: [],
        currentModule: 'dashboard',
        rightPanelView: 'messages' as const,
        setRightPanelView: mockSetRightPanelView,
        generatedHistory: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(defaultState);
    });

    it('renders collapsed state with tab buttons', () => {
        render(<RightPanel />);

        expect(screen.getByTestId('right-panel-rail')).toBeInTheDocument();
        expect(screen.getByTitle('Expand Panel')).toBeInTheDocument();
        expect(screen.getByTitle('Context Controls')).toBeInTheDocument();
        expect(screen.getByTitle('Project Assets')).toBeInTheDocument();
        expect(screen.getByTitle('Approvals')).toBeInTheDocument();
        expect(screen.getByTitle('Omni Agent')).toBeInTheDocument();

        expect(screen.queryByTestId('studio-controls-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('assets-panel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tool-approvals-panel')).not.toBeInTheDocument();
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

    it('renders StudioControlsPanel when open and tab is context and module is creative', async () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'context',
            currentModule: 'creative',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(await screen.findByTestId('studio-controls-panel')).toBeInTheDocument();
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

    it('renders AssetsPanel when open and tab is assets', async () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'assets',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(await screen.findByTestId('assets-panel')).toBeInTheDocument();
    });

    it('switches to Approvals tab when Approvals icon is clicked (ISSUE-1116)', () => {
        render(<RightPanel />);
        fireEvent.click(screen.getByTitle('Approvals'));
        expect(mockSetRightPanelTab).toHaveBeenCalledWith('approvals');
    });

    it('renders ToolApprovalsPanel when open and tab is approvals (ISSUE-1116)', async () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'approvals',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(await screen.findByTestId('tool-approvals-panel')).toBeInTheDocument();
    });

    it('calls toggleRightPanel from within the Approvals panel close button', async () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'approvals',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        const closeButton = await screen.findByTestId('close-approvals');
        fireEvent.click(closeButton);
        expect(mockToggleRightPanel).toHaveBeenCalled();
    });

    it('renders Agent content when open and tab is agent', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'agent',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(screen.getByTestId('right-panel-rail')).toBeInTheDocument();
        expect(screen.getByTitle('Collapse Panel')).toBeInTheDocument();
        expect(screen.getByText('Messages')).toBeInTheDocument();
        expect(screen.getByTestId('batching-status')).toBeInTheDocument();
    });

    it('switches tabs from the rail without closing an open panel', async () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'assets',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        expect(await screen.findByTestId('assets-panel')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Omni Agent'));

        expect(mockSetRightPanelTab).toHaveBeenCalledWith('agent');
        expect(mockToggleRightPanel).not.toHaveBeenCalled();
    });

    it('calls toggleRightPanel when close button is clicked in Agent tab', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...defaultState,
            rightPanelTab: 'agent',
            isRightPanelOpen: true,
        });
        render(<RightPanel />);
        
        // Find the close button (ChevronRight) in the Agent tab header
        const closeButton = screen.getByLabelText('Close Panel');
        fireEvent.click(closeButton);
        
        expect(mockToggleRightPanel).toHaveBeenCalled();
    });

    it('keeps the newest streaming response in view as its text grows', () => {
        const initialMessage = {
            id: 'response-1',
            role: 'model' as const,
            text: 'Starting',
            timestamp: Date.now(),
            isStreaming: true,
        };
        const openAgentState = {
            ...defaultState,
            rightPanelTab: 'agent',
            isRightPanelOpen: true,
            agentHistory: [initialMessage],
        };
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(openAgentState);

        const { rerender } = render(<RightPanel />);
        const callsAfterInitialAnchor = vi.mocked(Element.prototype.scrollTo).mock.calls.length;

        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            ...openAgentState,
            agentHistory: [{
                ...initialMessage,
                text: 'Starting and continuing the streamed response',
            }],
        });
        rerender(<RightPanel />);

        expect(Element.prototype.scrollTo).toHaveBeenCalledWith({
            top: expect.any(Number),
            behavior: 'auto',
        });
        expect(vi.mocked(Element.prototype.scrollTo).mock.calls.length).toBeGreaterThan(callsAfterInitialAnchor);
    });
});
