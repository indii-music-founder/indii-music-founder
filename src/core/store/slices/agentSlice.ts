import { StateCreator } from 'zustand';

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    attachments?: { mimeType: string; base64: string }[];
    isStreaming?: boolean;
    thoughts?: AgentThought[];
    agentId?: string;
}

export interface AgentThought {
    id: string;
    text: string;
    timestamp: number;
    type?: 'tool' | 'logic' | 'error';
    toolName?: string;
}

export interface ApprovalRequest {
    id: string;
    content: string;
    type: string;
    timestamp: number;
    resolve: (approved: boolean) => void;
}

export type AgentMode = 'assistant' | 'autonomous' | 'creative' | 'research';

export interface AgentSlice {
    agentHistory: AgentMessage[];
    isAgentOpen: boolean;
    agentMode: AgentMode;
    pendingApproval: ApprovalRequest | null;
    addAgentMessage: (msg: AgentMessage) => void;
    updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
    clearAgentHistory: () => void;
    toggleAgentWindow: () => void;
    setAgentMode: (mode: AgentMode) => void;
    requestApproval: (content: string, type: string) => Promise<boolean>;
    resolveApproval: (approved: boolean) => void;
}

export const createAgentSlice: StateCreator<AgentSlice> = (set, get) => ({
    agentHistory: [],
    isAgentOpen: false,
    agentMode: 'assistant',
    pendingApproval: null,

    addAgentMessage: (msg) => set((state) => ({ agentHistory: [...state.agentHistory, msg] })),

    updateAgentMessage: (id, updates) => set((state) => ({
        agentHistory: state.agentHistory.map(msg => msg.id === id ? { ...msg, ...updates } : msg)
    })),

    clearAgentHistory: () => set({ agentHistory: [] }),

    toggleAgentWindow: () => set((state) => ({ isAgentOpen: !state.isAgentOpen })),

    setAgentMode: (mode) => set({ agentMode: mode }),

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
});
