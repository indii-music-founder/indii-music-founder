import { StateCreator } from 'zustand';
import { isValidHeadId, listHeadIds } from '@/services/agent/departments';
import type { ModuleId } from '@/core/constants';

export type BoardroomWorkspaceLayout = 'closed' | 'split' | 'stage';
export type BoardroomWorkspaceTab = 'browser' | 'module' | 'workbench' | 'agent-feed';
export type BoardroomWorkbenchTarget =
    | { kind: 'asset'; itemId: string }
    | { kind: 'artifact'; filename: string }
    | { kind: 'canvas'; panelId: string }
    | null;

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
    focusedHeadId: string | null;

    // Expandable Split / Tabbed Workspace State
    boardroomWorkspaceLayout: BoardroomWorkspaceLayout;
    boardroomWorkspaceTab: BoardroomWorkspaceTab;
    boardroomBrowserUrl: string;
    boardroomBrowserHistory: string[];
    boardroomPreviewModuleId: ModuleId;
    boardroomWorkbenchTarget: BoardroomWorkbenchTarget;

    toggleAgent: (agentId: string) => void;
    soloAgent: (agentId: string) => void;
    addActiveAgent: (agentId: string) => void;
    removeActiveAgent: (agentId: string) => void;
    seatAllDepartmentHeads: () => SeatAllDepartmentHeadsResult;
    setFocusedHeadId: (headId: string | null) => void;

    // Workspace Actions
    setBoardroomWorkspaceLayout: (layout: BoardroomWorkspaceLayout) => void;
    setBoardroomWorkspaceTab: (tab: BoardroomWorkspaceTab) => void;
    setBoardroomBrowserUrl: (url: string) => void;
    setBoardroomPreviewModuleId: (moduleId: ModuleId) => void;
    setBoardroomWorkbenchTarget: (target: BoardroomWorkbenchTarget) => void;
    openBoardroomBrowser: (url?: string, layout?: 'split' | 'stage') => void;
    openBoardroomModulePreview: (moduleId: ModuleId, layout?: 'split' | 'stage') => void;
    openBoardroomWorkbench: (target?: BoardroomWorkbenchTarget, layout?: 'split' | 'stage') => void;
    openBoardroomAgentFeed: (layout?: 'split' | 'stage') => void;

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
    focusedHeadId: null,

    // Workspace Initial State
    boardroomWorkspaceLayout: 'closed',
    boardroomWorkspaceTab: 'browser',
    boardroomBrowserUrl: 'https://artists.spotify.com',
    boardroomBrowserHistory: ['https://artists.spotify.com'],
    boardroomPreviewModuleId: 'creative',
    boardroomWorkbenchTarget: null,

    toggleAgent: (agentId) => set((state) => {
        const isActive = state.activeAgents.includes(agentId);
        if (isActive) {
            return { activeAgents: state.activeAgents.filter(id => id !== agentId) };
        } else {
            return { activeAgents: [...state.activeAgents, agentId] };
        }
    }),

    soloAgent: (agentId) => set((state) => {
        // If clicking solo on the currently soloed agent, restore the Conductor + that agent
        if (state.activeAgents.length === 1 && state.activeAgents[0] === agentId) {
            return { activeAgents: agentId === 'generalist' ? ['generalist'] : ['generalist', agentId] };
        }
        return { activeAgents: [agentId] };
    }),

    setFocusedHeadId: (headId) => set({ focusedHeadId: headId }),

    addActiveAgent: (agentId) => set((state) => {
        if (!state.activeAgents.includes(agentId)) {
            return { activeAgents: [...state.activeAgents, agentId] };
        }
        return state;
    }),

    removeActiveAgent: (agentId) => set((state) => ({
        activeAgents: state.activeAgents.filter(id => id !== agentId),
    })),

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
            const retainedAgents = state.activeAgents.filter(
                (agentId, index) =>
                    (agentId === 'generalist' || isValidHeadId(agentId)) &&
                    state.activeAgents.indexOf(agentId) === index
            );
            if (!retainedAgents.includes('generalist')) {
                retainedAgents.unshift('generalist');
            }
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

    setBoardroomWorkspaceLayout: (layout) => set({ boardroomWorkspaceLayout: layout }),

    setBoardroomWorkspaceTab: (tab) => set((state) => ({
        boardroomWorkspaceTab: tab,
        boardroomWorkspaceLayout: state.boardroomWorkspaceLayout === 'closed' ? 'split' : state.boardroomWorkspaceLayout,
    })),

    setBoardroomBrowserUrl: (url) => set((state) => {
        const trimmed = url.trim();
        if (!trimmed) return state;
        const exists = state.boardroomBrowserHistory[state.boardroomBrowserHistory.length - 1] === trimmed;
        return {
            boardroomBrowserUrl: trimmed,
            boardroomBrowserHistory: exists ? state.boardroomBrowserHistory : [...state.boardroomBrowserHistory.slice(-20), trimmed],
        };
    }),

    setBoardroomPreviewModuleId: (moduleId) => set({ boardroomPreviewModuleId: moduleId }),

    setBoardroomWorkbenchTarget: (target) => set({ boardroomWorkbenchTarget: target }),

    openBoardroomBrowser: (url, layout) => set((state) => {
        const targetUrl = url?.trim() || state.boardroomBrowserUrl;
        const nextLayout = layout || (state.boardroomWorkspaceLayout === 'closed' ? 'split' : state.boardroomWorkspaceLayout);
        const exists = state.boardroomBrowserHistory[state.boardroomBrowserHistory.length - 1] === targetUrl;
        return {
            boardroomWorkspaceLayout: nextLayout,
            boardroomWorkspaceTab: 'browser',
            boardroomBrowserUrl: targetUrl,
            boardroomBrowserHistory: exists ? state.boardroomBrowserHistory : [...state.boardroomBrowserHistory.slice(-20), targetUrl],
        };
    }),

    openBoardroomModulePreview: (moduleId, layout) => set((state) => ({
        boardroomWorkspaceLayout: layout || (state.boardroomWorkspaceLayout === 'closed' ? 'split' : state.boardroomWorkspaceLayout),
        boardroomWorkspaceTab: 'module',
        boardroomPreviewModuleId: moduleId,
    })),

    openBoardroomWorkbench: (target, layout) => set((state) => ({
        boardroomWorkspaceLayout: layout || (state.boardroomWorkspaceLayout === 'closed' ? 'split' : state.boardroomWorkspaceLayout),
        boardroomWorkspaceTab: 'workbench',
        ...(target !== undefined ? { boardroomWorkbenchTarget: target } : {}),
    })),

    openBoardroomAgentFeed: (layout) => set((state) => ({
        boardroomWorkspaceLayout: layout || (state.boardroomWorkspaceLayout === 'closed' ? 'split' : state.boardroomWorkspaceLayout),
        boardroomWorkspaceTab: 'agent-feed',
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
