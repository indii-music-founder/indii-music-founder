import { StateCreator } from 'zustand';

export interface ReferencedAsset {
    id: string;
    name: string;
    type: 'url' | 'file' | 'database';
    value: string;
}

export interface BoardroomSlice {
    activeAgents: string[];
    referencedAssets: ReferencedAsset[];

    toggleAgent: (agentId: string) => void;
    addActiveAgent: (agentId: string) => void;
    removeActiveAgent: (agentId: string) => void;

    addReferencedAsset: (asset: ReferencedAsset) => void;
    removeReferencedAsset: (assetId: string) => void;
    clearReferencedAssets: () => void;
}

export const createBoardroomSlice: StateCreator<BoardroomSlice> = (set, get) => ({
    activeAgents: ['generalist'], // indii Conductor (hub agent) always present initially
    referencedAssets: [],

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
});
