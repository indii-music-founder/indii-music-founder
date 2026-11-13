import { StateCreator } from 'zustand';
import {
    BOARDROOM_CONDUCTOR_ID,
    isValidHeadId,
    listHeadIds,
    normalizeBoardroomAgentIds,
} from '@/services/agent/departments';

export interface SeatAllDepartmentHeadsResult {
    seatedCount: number;
    newlySeatedCount: number;
    stateChanged: boolean;
    idempotent: boolean;
}

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
    seatAllDepartmentHeads: () => SeatAllDepartmentHeadsResult;

    addReferencedAsset: (asset: ReferencedAsset) => void;
    removeReferencedAsset: (assetId: string) => void;
    clearReferencedAssets: () => void;

    addA2AMessage: (msg: A2AMessage) => void;
    updateA2AMessage: (msgId: string, updates: Partial<A2AMessage>) => void;
    clearA2AMessages: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createBoardroomSlice: StateCreator<BoardroomSlice> = (set, get) => ({
    activeAgents: [BOARDROOM_CONDUCTOR_ID],
    referencedAssets: [],
    a2aMessages: [],

    toggleAgent: (agentId) => set((state) => {
        const currentAgents = normalizeBoardroomAgentIds(state.activeAgents);
        if (!isValidHeadId(agentId)) {
            return arraysEqual(currentAgents, state.activeAgents)
                ? state
                : { activeAgents: currentAgents };
        }

        const nextAgents = currentAgents.includes(agentId)
            ? currentAgents.filter(id => id !== agentId)
            : [...currentAgents, agentId];
        return { activeAgents: nextAgents };
    }),

    addActiveAgent: (agentId) => set((state) => {
        const currentAgents = normalizeBoardroomAgentIds(state.activeAgents);
        if (!isValidHeadId(agentId) || currentAgents.includes(agentId)) {
            return arraysEqual(currentAgents, state.activeAgents)
                ? state
                : { activeAgents: currentAgents };
        }
        return { activeAgents: [...currentAgents, agentId] };
    }),

    removeActiveAgent: (agentId) => set((state) => {
        const currentAgents = normalizeBoardroomAgentIds(state.activeAgents);
        if (!isValidHeadId(agentId) || !currentAgents.includes(agentId)) {
            return arraysEqual(currentAgents, state.activeAgents)
                ? state
                : { activeAgents: currentAgents };
        }
        return { activeAgents: currentAgents.filter(id => id !== agentId) };
    }),

    seatAllDepartmentHeads: () => {
        const headIds = listHeadIds();
        let result: SeatAllDepartmentHeadsResult = {
            seatedCount: headIds.length,
            newlySeatedCount: 0,
            stateChanged: false,
            idempotent: true,
        };

        set((state) => {
            const existingHeads = new Set(state.activeAgents.filter(isValidHeadId));
            const retainedAgents = normalizeBoardroomAgentIds(state.activeAgents);
            const nextActiveAgents = [
                ...retainedAgents,
                ...headIds.filter(agentId => !existingHeads.has(agentId)),
            ];
            const stateChanged =
                nextActiveAgents.length !== state.activeAgents.length ||
                nextActiveAgents.some((agentId, index) => state.activeAgents[index] !== agentId);

            result = {
                seatedCount: headIds.length,
                newlySeatedCount: headIds.filter(agentId => !existingHeads.has(agentId)).length,
                stateChanged,
                idempotent: !stateChanged,
            };

            return stateChanged ? { activeAgents: nextActiveAgents } : state;
        });

        return result;
    },

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

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
