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
    isAgentOpen: boolean;
    toggleAgentWindow: () => void;

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

    agentMode: AgentMode;
    setAgentMode: (mode: AgentMode) => void;
    isAgentProcessing: boolean;
    setAgentProcessing: (isProcessing: boolean) => void;

    agentAbortController: AbortController | null;
    startAgentExecution: () => AbortSignal;
    stopAgent: () => void;

    pendingApproval: ApprovalRequest | null;
    requestApproval: (content: string, type: string) => Promise<boolean>;
    resolveApproval: (approved: boolean) => void;

    rightPanelView: 'messages' | 'archives';
    setRightPanelView: (view: 'messages' | 'archives') => void;

    chatChannel: 'indii' | 'agent';
    setChatChannel: (channel: 'indii' | 'agent') => void;
    activeAgentProvider: 'direct' | 'native';
    setActiveAgentProvider: (provider: 'direct' | 'native') => void;

    isKnowledgeBaseEnabled: boolean;
    setKnowledgeBaseEnabled: (enabled: boolean) => void;

    agentWindowSize: { width: number; height: number };
    setAgentWindowSize: (size: { width: number; height: number }) => void;
}

export function buildAgentUIState(
    set: Parameters<StateCreator<AgentUISlice>>[0],
    get: Parameters<StateCreator<AgentUISlice>>[1]
): AgentUISlice {
    return {
        isAgentOpen: false,
        isCommandBarDetached: false,
        isCommandBarCollapsed: false,
        commandBarPosition: (typeof window !== 'undefined' && (['left', 'center', 'right'].includes(localStorage.getItem('indiiOS_commandBarPosition') || '') ? localStorage.getItem('indiiOS_commandBarPosition') as 'left' | 'center' | 'right' : 'center')) || 'center',
        commandBarInput: '',
        commandBarAttachments: [],
        agentMode: 'assistant',
        isAgentProcessing: false,
        agentAbortController: null,
        pendingApproval: null,
        rightPanelView: 'messages',
        chatChannel: 'indii',
        activeAgentProvider: 'direct',
        isKnowledgeBaseEnabled: true,
        agentWindowSize: { width: 500, height: 800 },

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

        startAgentExecution: () => {
            const existing = get().agentAbortController;
            if (existing) existing.abort('New execution started');
            const controller = new AbortController();
            set({ agentAbortController: controller, isAgentProcessing: true });
            return controller.signal;
        },

        stopAgent: () => {
            const { agentAbortController } = get();
            if (agentAbortController) agentAbortController.abort('User requested stop');
            set({ agentAbortController: null, isAgentProcessing: false });
        },

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
