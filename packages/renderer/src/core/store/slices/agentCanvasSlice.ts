import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import type { CanvasPushPayload } from '@/types/AgentCanvas';

/**
 * AgentCanvasSlice — Agent-to-UI Push (A2UI)
 *
 * Manages agent-pushed visual content panels. When an agent calls
 * `canvas_push`, the payload lands here and the UI renders it in
 * the AgentCanvasPanel.
 */
export interface AgentCanvasSlice {
    /** Ordered list of pushed canvas panels. */
    canvasPanels: CanvasPushPayload[];
    /** Whether the canvas panel overlay is visible. */
    isCanvasOpen: boolean;

    /** Push a new canvas panel from an agent. */
    pushCanvas: (payload: CanvasPushPayload) => void;
    /** Remove a single panel by ID. */
    removePanel: (id: string) => void;
    /** Clear all panels and close the canvas. */
    clearCanvas: () => void;
    /** Toggle canvas visibility. */
    toggleCanvas: () => void;
}

export const createAgentCanvasSlice: StateCreator<AgentCanvasSlice> = (set, _get) => ({
    canvasPanels: [],
    isCanvasOpen: false,

    pushCanvas: (payload) => {
        logger.info(`[AgentCanvasSlice] Canvas push: "${payload.title}" (${payload.type}) from ${payload.agentId}`);
        set((state) => ({
            canvasPanels: [...state.canvasPanels, payload],
            isCanvasOpen: true,
        }));
    },

    removePanel: (id) => {
        set((state) => {
            const filtered = state.canvasPanels.filter((p) => p.id !== id);
            return {
                canvasPanels: filtered,
                isCanvasOpen: filtered.length > 0 ? state.isCanvasOpen : false,
            };
        });
    },

    clearCanvas: () => {
        logger.info('[AgentCanvasSlice] Clearing all canvas panels');
        set({ canvasPanels: [], isCanvasOpen: false });
    },

    toggleCanvas: () => {
        set((state) => ({ isCanvasOpen: !state.isCanvasOpen }));
    },
});
