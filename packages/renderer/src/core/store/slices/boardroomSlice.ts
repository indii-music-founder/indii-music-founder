import { StateCreator } from 'zustand';

export interface ReferencedAsset {
    id: string;
    name: string;
    type: 'url' | 'file' | 'database';
    value: string;
    prompt?: string;
    origin?: string;
    parentId?: string;
    storageUri?: string;
    sourceType?: 'image' | 'video' | 'music' | 'text';
}

export interface A2AMessage {
    id: string;
    fromAgent: string;
    toAgent: string;
    content: string;
    timestamp: number;
    requiresApproval?: boolean;
    approved?: boolean;
}

export interface BoardroomSlice {
    activeAgents: string[];
    referencedAssets: ReferencedAsset[];
    a2aMessages: A2AMessage[];

    toggleAgent: (agentId: string) => void;
    addActiveAgent: (agentId: string) => void;
    removeActiveAgent: (agentId: string) => void;

    addReferencedAsset: (asset: ReferencedAsset) => void;
    removeReferencedAsset: (assetId: string) => void;
    clearReferencedAssets: () => void;

    addA2AMessage: (msg: A2AMessage) => void;
    updateA2AMessage: (msgId: string, updates: Partial<A2AMessage>) => void;
    clearA2AMessages: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createBoardroomSlice: StateCreator<BoardroomSlice> = (set, get) => ({
    activeAgents: ['generalist'], // indii Conductor (hub agent) always present initially
    referencedAssets: [],
    a2aMessages: [],

    toggleAgent: (agentId) => set((state) => {
        const isActive = state.activeAgents.includes(agentId);
        if (isActive) {
            return { activeAgents: state.activeAgents.filter(id => id !== agentId) };
        } else {
            return { activeAgents: [...state.activeAgents, agentId] };
        }
    }),

    addActiveAgent: (agentId) => set((state) => {
        if (!state.activeAgents.includes(agentId)) {
            return { activeAgents: [...state.activeAgents, agentId] };
        }
        return state;
    }),

    removeActiveAgent: (agentId) => set((state) => ({
        activeAgents: state.activeAgents.filter(id => id !== agentId)
    })),

    addReferencedAsset: (asset) => set((state) => ({
        referencedAssets: [...state.referencedAssets, asset]
    })),

    removeReferencedAsset: (assetId) => set((state) => ({
        referencedAssets: state.referencedAssets.filter(a => a.id !== assetId)
    })),

    clearReferencedAssets: () => set({ referencedAssets: [] }),

    addA2AMessage: (msg) => set((state) => ({
        a2aMessages: [...state.a2aMessages, msg]
    })),

    updateA2AMessage: (msgId, updates) => set((state) => ({
        a2aMessages: state.a2aMessages.map(m => m.id === msgId ? { ...m, ...updates } : m)
    })),

    clearA2AMessages: () => set({ a2aMessages: [] }),
});
