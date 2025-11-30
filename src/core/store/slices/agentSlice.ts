import { StateCreator } from 'zustand';

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    attachments?: { mimeType: string; base64: string }[];
    isStreaming?: boolean;
}

export interface AgentSlice {
    agentHistory: AgentMessage[];
    isAgentOpen: boolean;
    addAgentMessage: (msg: AgentMessage) => void;
    updateAgentMessage: (id: string, updates: Partial<AgentMessage>) => void;
    clearAgentHistory: () => void;
    toggleAgentWindow: () => void;
}

export const createAgentSlice: StateCreator<AgentSlice> = (set) => ({
    agentHistory: [],
    isAgentOpen: false,
    addAgentMessage: (msg) => set((state) => ({ agentHistory: [...state.agentHistory, msg] })),
    updateAgentMessage: (id, updates) => set((state) => ({
        agentHistory: state.agentHistory.map(msg => msg.id === id ? { ...msg, ...updates } : msg)
    })),
    clearAgentHistory: () => set({ agentHistory: [] }),
    toggleAgentWindow: () => set((state) => ({ isAgentOpen: !state.isAgentOpen })),
});
