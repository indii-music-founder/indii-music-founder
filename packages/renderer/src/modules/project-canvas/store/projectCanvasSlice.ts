/**
 * projectCanvasSlice.ts
 *
 * Dedicated Zustand slice for indii.music Project Canvas.
 * Manages canvas documents, blocks, non-executing semantic edges,
 * selection, pan/zoom viewport, undo/redo history, and defensive save state.
 */

import { StateCreator } from 'zustand';
import type { StoreState } from '@/core/store/types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';
import type {
    ProjectCanvasDocument,
    ProjectCanvasBlock,
    ProjectCanvasEdge,
    CanvasViewport,
    CanvasRelationshipType,
} from '../types';
import { ProjectCanvasPersistence } from '../services/ProjectCanvasPersistence';

export type CanvasToolType =
    | 'select'
    | 'pan'
    | 'add_text'
    | 'add_frame'
    | 'add_asset'
    | 'add_note';

interface HistorySnapshot {
    blocks: ProjectCanvasBlock[];
    edges: ProjectCanvasEdge[];
}

export interface ProjectCanvasSlice {
    // State
    currentCanvas: ProjectCanvasDocument | null;
    canvasBlocks: ProjectCanvasBlock[];
    canvasEdges: ProjectCanvasEdge[];
    selectedBlockIds: string[];
    canvasViewport: CanvasViewport;
    activeCanvasTool: CanvasToolType;
    isCanvasSaving: boolean;
    isCanvasDirty: boolean;
    canvasSaveError: string | null;
    canvasLastSavedAt: number | null;
    canvasHistoryPast: HistorySnapshot[];
    canvasHistoryFuture: HistorySnapshot[];

    // Actions
    loadProjectCanvas: (projectId: string) => Promise<void>;
    setCanvasViewport: (viewport: Partial<CanvasViewport>) => void;
    setActiveCanvasTool: (tool: CanvasToolType) => void;
    selectCanvasBlock: (id: string, multiSelect?: boolean) => void;
    clearCanvasSelection: () => void;
    addCanvasBlock: (block: Partial<Omit<ProjectCanvasBlock, 'id' | 'canvasId' | 'projectId' | 'createdAt' | 'updatedAt'>>) => string;
    updateCanvasBlockPosition: (id: string, position: { x: number; y: number }) => void;
    updateCanvasBlockSize: (id: string, size: { width: number; height: number }) => void;
    updateCanvasBlock: (id: string, patch: Partial<ProjectCanvasBlock>) => void;
    removeCanvasBlockPlacement: (id: string) => void;
    addCanvasEdge: (sourceBlockId: string, targetBlockId: string, relationship: CanvasRelationshipType, label?: string) => string;
    removeCanvasEdge: (id: string) => void;
    undoCanvas: () => void;
    redoCanvas: () => void;
    saveProjectCanvas: () => Promise<void>;
    retryCanvasSave: () => Promise<void>;
    resetProjectCanvas: () => void;
}

const MAX_HISTORY_STEPS = 30;

export const createProjectCanvasSlice: StateCreator<StoreState, [], [], ProjectCanvasSlice> = (set, get) => {
    const pushHistory = (state: StoreState) => {
        const snapshot: HistorySnapshot = {
            blocks: structuredClone(state.canvasBlocks),
            edges: structuredClone(state.canvasEdges),
        };
        const past = [...state.canvasHistoryPast, snapshot].slice(-MAX_HISTORY_STEPS);
        return { canvasHistoryPast: past, canvasHistoryFuture: [] };
    };

    const triggerDebouncedAutoSave = () => {
        const state = get();
        if (!state.currentCanvas) return;

        ProjectCanvasPersistence.bumpMutationVersion();
        set({ isCanvasDirty: true });

        const payload = {
            document: state.currentCanvas,
            blocks: state.canvasBlocks,
            edges: state.canvasEdges,
        };

        ProjectCanvasPersistence.scheduleDebouncedSave(
            payload,
            1500,
            (result) => {
                if (result.clearedDirty) {
                    set({
                        isCanvasDirty: false,
                        isCanvasSaving: false,
                        canvasSaveError: null,
                        canvasLastSavedAt: result.savedAt,
                    });
                } else {
                    // Newer mutations happened while saving; keep dirty
                    set({
                        isCanvasSaving: false,
                        canvasSaveError: null,
                        canvasLastSavedAt: result.savedAt,
                    });
                }
            },
            (error) => {
                logger.error('[ProjectCanvasSlice] Auto-save error:', error);
                set({
                    isCanvasSaving: false,
                    canvasSaveError: error.message || 'Auto-save failed. Your work remains safe locally.',
                });
            }
        );
    };

    return {
        currentCanvas: null,
        canvasBlocks: [],
        canvasEdges: [],
        selectedBlockIds: [],
        canvasViewport: { x: 0, y: 0, zoom: 1 },
        activeCanvasTool: 'select',
        isCanvasSaving: false,
        isCanvasDirty: false,
        canvasSaveError: null,
        canvasLastSavedAt: null,
        canvasHistoryPast: [],
        canvasHistoryFuture: [],

        loadProjectCanvas: async (projectId: string) => {
            if (!projectId) return;

            // Clean previous state before loading to prevent leakage
            ProjectCanvasPersistence.cancelPendingSave();
            set({
                currentCanvas: null,
                canvasBlocks: [],
                canvasEdges: [],
                selectedBlockIds: [],
                isCanvasDirty: false,
                isCanvasSaving: false,
                canvasSaveError: null,
                canvasHistoryPast: [],
                canvasHistoryFuture: [],
            });

            try {
                const fullState = await ProjectCanvasPersistence.loadCanvas(projectId);
                set({
                    currentCanvas: fullState.document,
                    canvasBlocks: fullState.blocks,
                    canvasEdges: fullState.edges,
                    canvasViewport: fullState.document.viewport,
                    isCanvasDirty: false,
                    canvasLastSavedAt: fullState.document.updatedAt,
                });
            } catch (err) {
                logger.error('[ProjectCanvasSlice] Failed to load canvas:', err);
                set({
                    canvasSaveError: 'Failed to load project canvas from cloud. Retrying local backup...',
                });
            }
        },

        setCanvasViewport: (viewportPatch) => {
            set((state) => {
                const updated = { ...state.canvasViewport, ...viewportPatch };
                const updatedDoc = state.currentCanvas
                    ? { ...state.currentCanvas, viewport: updated }
                    : null;
                return { canvasViewport: updated, currentCanvas: updatedDoc };
            });
            triggerDebouncedAutoSave();
        },

        setActiveCanvasTool: (tool) => {
            set({ activeCanvasTool: tool });
        },

        selectCanvasBlock: (id, multiSelect = false) => {
            set((state) => {
                if (multiSelect) {
                    const exists = state.selectedBlockIds.includes(id);
                    return {
                        selectedBlockIds: exists
                            ? state.selectedBlockIds.filter((bId) => bId !== id)
                            : [...state.selectedBlockIds, id],
                    };
                }
                return { selectedBlockIds: [id] };
            });
        },

        clearCanvasSelection: () => {
            set({ selectedBlockIds: [] });
        },

        addCanvasBlock: (blockData) => {
            const state = get();
            const canvas = state.currentCanvas;
            const projectId = canvas?.projectId || state.currentProjectId || 'default';
            const canvasId = canvas?.id || `canvas_${projectId}`;

            const id = uuidv4();
            const now = Date.now();
            const newBlock: ProjectCanvasBlock = {
                id,
                type: blockData.type || 'text',
                canvasId,
                projectId,
                position: blockData.position || { x: 100, y: 100 },
                size: blockData.size || { width: 300, height: 200 },
                zIndex: blockData.zIndex ?? Math.min(state.canvasBlocks.length + 1, 1000),
                parentId: blockData.parentId ?? null,
                entityRef: blockData.entityRef,
                snapshot: blockData.snapshot,
                settings: blockData.settings,
                provenance: blockData.provenance || {
                    creatorType: 'user',
                    creatorId: 'current_user',
                    timestamp: now,
                },
                createdAt: now,
                updatedAt: now,
            };

            set((current) => ({
                ...pushHistory(current),
                canvasBlocks: [...current.canvasBlocks, newBlock],
                selectedBlockIds: [id],
            }));

            triggerDebouncedAutoSave();
            return id;
        },

        updateCanvasBlockPosition: (id, position) => {
            set((state) => {
                const blocks = state.canvasBlocks.map((b) =>
                    b.id === id ? { ...b, position, updatedAt: Date.now() } : b
                );
                return { canvasBlocks: blocks };
            });
            triggerDebouncedAutoSave();
        },

        updateCanvasBlockSize: (id, size) => {
            set((state) => {
                const blocks = state.canvasBlocks.map((b) =>
                    b.id === id ? { ...b, size, updatedAt: Date.now() } : b
                );
                return { canvasBlocks: blocks };
            });
            triggerDebouncedAutoSave();
        },

        updateCanvasBlock: (id, patch) => {
            set((state) => {
                const blocks = state.canvasBlocks.map((b) =>
                    b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b
                );
                return { ...pushHistory(state), canvasBlocks: blocks };
            });
            triggerDebouncedAutoSave();
        },

        removeCanvasBlockPlacement: (id) => {
            set((state) => {
                const blocks = state.canvasBlocks.filter((b) => b.id !== id);
                // Also remove any connecting edges
                const edges = state.canvasEdges.filter(
                    (e) => e.sourceBlockId !== id && e.targetBlockId !== id
                );
                const selected = state.selectedBlockIds.filter((bId) => bId !== id);

                return {
                    ...pushHistory(state),
                    canvasBlocks: blocks,
                    canvasEdges: edges,
                    selectedBlockIds: selected,
                };
            });

            const canvas = get().currentCanvas;
            if (canvas) {
                ProjectCanvasPersistence.deleteBlockPlacement(canvas.projectId, canvas.id, id);
            }
            triggerDebouncedAutoSave();
        },

        addCanvasEdge: (sourceBlockId, targetBlockId, relationship, label) => {
            const state = get();
            const canvas = state.currentCanvas;
            const projectId = canvas?.projectId || state.currentProjectId || 'default';
            const canvasId = canvas?.id || `canvas_${projectId}`;

            // Prevent self-loop edges
            if (sourceBlockId === targetBlockId) {
                logger.warn('[ProjectCanvasSlice] Cannot create edge to self');
                return '';
            }

            const id = `edge_${uuidv4().slice(0, 8)}`;
            const newEdge: ProjectCanvasEdge = {
                id,
                canvasId,
                projectId,
                sourceBlockId,
                targetBlockId,
                relationship,
                label,
                createdAt: Date.now(),
            };

            set((current) => ({
                ...pushHistory(current),
                canvasEdges: [...current.canvasEdges, newEdge],
            }));

            triggerDebouncedAutoSave();
            return id;
        },

        removeCanvasEdge: (id) => {
            set((state) => ({
                ...pushHistory(state),
                canvasEdges: state.canvasEdges.filter((e) => e.id !== id),
            }));

            const canvas = get().currentCanvas;
            if (canvas) {
                ProjectCanvasPersistence.deleteEdge(canvas.projectId, canvas.id, id);
            }
            triggerDebouncedAutoSave();
        },

        undoCanvas: () => {
            const state = get();
            if (state.canvasHistoryPast.length === 0) return;

            const previous = state.canvasHistoryPast[state.canvasHistoryPast.length - 1];
            const newPast = state.canvasHistoryPast.slice(0, -1);
            const currentSnapshot: HistorySnapshot = {
                blocks: structuredClone(state.canvasBlocks),
                edges: structuredClone(state.canvasEdges),
            };

            set({
                canvasBlocks: previous.blocks,
                canvasEdges: previous.edges,
                canvasHistoryPast: newPast,
                canvasHistoryFuture: [currentSnapshot, ...state.canvasHistoryFuture],
            });
            triggerDebouncedAutoSave();
        },

        redoCanvas: () => {
            const state = get();
            if (state.canvasHistoryFuture.length === 0) return;

            const next = state.canvasHistoryFuture[0];
            const newFuture = state.canvasHistoryFuture.slice(1);
            const currentSnapshot: HistorySnapshot = {
                blocks: structuredClone(state.canvasBlocks),
                edges: structuredClone(state.canvasEdges),
            };

            set({
                canvasBlocks: next.blocks,
                canvasEdges: next.edges,
                canvasHistoryPast: [...state.canvasHistoryPast, currentSnapshot],
                canvasHistoryFuture: newFuture,
            });
            triggerDebouncedAutoSave();
        },

        saveProjectCanvas: async () => {
            const state = get();
            if (!state.currentCanvas) return;

            ProjectCanvasPersistence.cancelPendingSave();
            set({ isCanvasSaving: true, canvasSaveError: null });

            try {
                const payload = {
                    document: state.currentCanvas,
                    blocks: state.canvasBlocks,
                    edges: state.canvasEdges,
                };
                const result = await ProjectCanvasPersistence.saveCanvas(payload);
                set({
                    isCanvasSaving: false,
                    isCanvasDirty: !result.clearedDirty,
                    canvasSaveError: null,
                    canvasLastSavedAt: result.savedAt,
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Save failed';
                set({ isCanvasSaving: false, canvasSaveError: msg });
                throw err;
            }
        },

        retryCanvasSave: async () => {
            return get().saveProjectCanvas();
        },

        resetProjectCanvas: () => {
            ProjectCanvasPersistence.cancelPendingSave();
            set({
                currentCanvas: null,
                canvasBlocks: [],
                canvasEdges: [],
                selectedBlockIds: [],
                isCanvasDirty: false,
                isCanvasSaving: false,
                canvasSaveError: null,
                canvasHistoryPast: [],
                canvasHistoryFuture: [],
            });
        },
    };
};
