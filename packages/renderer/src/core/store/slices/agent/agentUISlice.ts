import { StateCreator } from 'zustand';

export type AgentMode = 'assistant' | 'autonomous' | 'creative' | 'research';

export interface ApprovalRequest {
    id: string;
    content: string;
    type: string;
    timestamp: number;
    resolve: (approved: boolean) => void;
}

export interface AgentUISlice {
    // Agent Window
    isAgentOpen: boolean;
    toggleAgentWindow: () => void;

    // Command Bar
    isCommandBarDetached: boolean;
    isCommandBarCollapsed: boolean;
    commandBarPosition: 'left' | 'center' | 'right';
    commandBarInput: string;
    commandBarAttachments: File[];
    setCommandBarDetached: (detached: boolean) => void;
    setCommandBarCollapsed: (collapsed: boolean) => void;
    setCommandBarPosition: (position: 'left' | 'center' | 'right') => void;
    setCommandBarInput: (input: string) => void;
    setCommandBarAttachments: (attachments: File[]) => void;
    resetCommandBar: () => void;

    // Mode & Processing
    agentMode: AgentMode;
    setAgentMode: (mode: AgentMode) => void;
    isAgentProcessing: boolean;
    setAgentProcessing: (isProcessing: boolean) => void;

    // Approval
    pendingApproval: ApprovalRequest | null;
    requestApproval: (content: string, type: string) => Promise<boolean>;
    resolveApproval: (approved: boolean) => void;

    // Right Panel
    rightPanelView: 'messages' | 'archives';
    setRightPanelView: (view: 'messages' | 'archives') => void;

    // Chat Channel & Provider
    chatChannel: 'indii' | 'agent';
    setChatChannel: (channel: 'indii' | 'agent') => void;
    activeAgentProvider: 'direct' | 'native';
    setActiveAgentProvider: (provider: 'direct' | 'native') => void;

    // Knowledge Base
    isKnowledgeBaseEnabled: boolean;
    setKnowledgeBaseEnabled: (enabled: boolean) => void;

    // Window Size
    agentWindowSize: { width: number; height: number };
    setAgentWindowSize: (size: { width: number; height: number }) => void;
}

/**
 * Factory that returns the UI portion of the agent slice.
 * Accepts the full Zustand set/get to allow cross-slice reads if needed.
 */
export function buildAgentUIState(
    set: Parameters<StateCreator<AgentUISlice>>[0],
    get: Parameters<StateCreator<AgentUISlice>>[1]
): AgentUISlice {
    return {
        // Initial State
        isAgentOpen: false,
        isCommandBarDetached: false,
        isCommandBarCollapsed: false,
        commandBarPosition: (typeof window !== 'undefined' && (['left', 'center', 'right'].includes(localStorage.getItem('indiiOS_commandBarPosition') || '') ? localStorage.getItem('indiiOS_commandBarPosition') as 'left' | 'center' | 'right' : 'center')) || 'center',
        commandBarInput: '',
        commandBarAttachments: [],
        agentMode: 'assistant',
        isAgentProcessing: false,
        pendingApproval: null,
        rightPanelView: 'messages',
        chatChannel: 'indii',
        activeAgentProvider: 'direct',
        isKnowledgeBaseEnabled: true,
        agentWindowSize: { width: 500, height: 800 },

        // Actions
        toggleAgentWindow: () => set((state) => ({ isAgentOpen: !state.isAgentOpen })),
        setCommandBarDetached: (detached) => set({ isCommandBarDetached: detached }),
        setCommandBarCollapsed: (collapsed) => set({ isCommandBarCollapsed: collapsed }),
        setCommandBarPosition: (position) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('indiiOS_commandBarPosition', position);
            }
            set({ commandBarPosition: position });
        },
        setCommandBarInput: (input) => set({ commandBarInput: input }),
        setCommandBarAttachments: (attachments) => set({ commandBarAttachments: attachments }),
        resetCommandBar: () => set({ isCommandBarDetached: false, isCommandBarCollapsed: false, commandBarPosition: 'center' }),
        setAgentMode: (mode) => set({ agentMode: mode }),
        setAgentProcessing: (isProcessing) => set({ isAgentProcessing: isProcessing }),
        setRightPanelView: (view) => set({ rightPanelView: view }),
        setChatChannel: (channel) => set({ chatChannel: channel }),
        setActiveAgentProvider: (provider) => set({ activeAgentProvider: provider }),
        setKnowledgeBaseEnabled: (enabled) => set({ isKnowledgeBaseEnabled: enabled }),
        setAgentWindowSize: (size) => set({ agentWindowSize: size }),

        requestApproval: (content: string, type: string): Promise<boolean> => {
            return new Promise((resolve) => {
                const request: ApprovalRequest = {
                    id: `approval-${Date.now()}`,
                    content,
                    type,
                    timestamp: Date.now(),
                    resolve,
                };
                set({ pendingApproval: request });
            });
        },

        resolveApproval: (approved: boolean) => {
            const { pendingApproval } = get();
            if (pendingApproval) {
                pendingApproval.resolve(approved);
                set({ pendingApproval: null });
            }
        },
    };
}
