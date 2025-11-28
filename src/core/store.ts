import { create } from 'zustand';

export interface AgentMessage {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
    attachments?: { mimeType: string; base64: string }[];
}

interface AppState {
    currentModule: 'creative' | 'legal' | 'music' | 'marketing';
    currentProjectId: string;
    agentHistory: AgentMessage[];
    isAgentOpen: boolean;

    setModule: (module: AppState['currentModule']) => void;
    setProject: (id: string) => void;
    addAgentMessage: (msg: AgentMessage) => void;
    clearAgentHistory: () => void;
    toggleAgentWindow: () => void;
}

export const useStore = create<AppState>((set) => ({
    currentModule: 'creative',
    currentProjectId: 'default',
    agentHistory: [],
    isAgentOpen: true,

    setModule: (module) => set({ currentModule: module }),
    setProject: (id) => set({ currentProjectId: id }),
    addAgentMessage: (msg) => set((state) => ({ agentHistory: [...state.agentHistory, msg] })),
    clearAgentHistory: () => set({ agentHistory: [] }),
    toggleAgentWindow: () => set((state) => ({ isAgentOpen: !state.isAgentOpen })),
}));
