/**
 * useProjectCanvas.ts
 *
 * React hook orchestrating Project Canvas state, project synchronization,
 * dirty-state warnings, and defensive saving.
 */

import { useEffect, useCallback } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export function useProjectCanvas() {
    const {
        currentProjectId,
        currentCanvas,
        blocks,
        edges,
        selectedBlockIds,
        viewport,
        activeTool,
        isSaving,
        isDirty,
        saveError,
        lastSavedAt,
        loadProjectCanvas,
        setCanvasViewport,
        setActiveCanvasTool,
        selectCanvasBlock,
        clearCanvasSelection,
        addCanvasBlock,
        updateCanvasBlockPosition,
        updateCanvasBlockSize,
        updateCanvasBlock,
        removeCanvasBlockPlacement,
        addCanvasEdge,
        removeCanvasEdge,
        undoCanvas,
        redoCanvas,
        saveProjectCanvas,
        retryCanvasSave,
    } = useStore(
        useShallow((state) => ({
            currentProjectId: state.currentProjectId,
            currentCanvas: state.currentCanvas,
            blocks: state.canvasBlocks,
            edges: state.canvasEdges,
            selectedBlockIds: state.selectedBlockIds,
            viewport: state.canvasViewport,
            activeTool: state.activeCanvasTool,
            isSaving: state.isCanvasSaving,
            isDirty: state.isCanvasDirty,
            saveError: state.canvasSaveError,
            lastSavedAt: state.canvasLastSavedAt,
            loadProjectCanvas: state.loadProjectCanvas,
            setCanvasViewport: state.setCanvasViewport,
            setActiveCanvasTool: state.setActiveCanvasTool,
            selectCanvasBlock: state.selectCanvasBlock,
            clearCanvasSelection: state.clearCanvasSelection,
            addCanvasBlock: state.addCanvasBlock,
            updateCanvasBlockPosition: state.updateCanvasBlockPosition,
            updateCanvasBlockSize: state.updateCanvasBlockSize,
            updateCanvasBlock: state.updateCanvasBlock,
            removeCanvasBlockPlacement: state.removeCanvasBlockPlacement,
            addCanvasEdge: state.addCanvasEdge,
            removeCanvasEdge: state.removeCanvasEdge,
            undoCanvas: state.undoCanvas,
            redoCanvas: state.redoCanvas,
            saveProjectCanvas: state.saveProjectCanvas,
            retryCanvasSave: state.retryCanvasSave,
        }))
    );

    // Guard unsaved changes from accidental route navigation or window close
    useUnsavedChanges(isDirty);

    // Synchronize canvas with the active project
    useEffect(() => {
        if (currentProjectId) {
            loadProjectCanvas(currentProjectId);
        }
    }, [currentProjectId, loadProjectCanvas]);

    // Helpers
    const handleAddTextBlock = useCallback(
        (text: string, position?: { x: number; y: number }) => {
            return addCanvasBlock({
                type: 'text',
                position: position || { x: -viewport.x + 200, y: -viewport.y + 200 },
                size: { width: 300, height: 180 },
                snapshot: {
                    title: 'Note',
                    excerpt: text,
                    cachedAt: Date.now(),
                },
                settings: { content: text },
            });
        },
        [addCanvasBlock, viewport]
    );

    const handleAddFrame = useCallback(
        (title: string, position?: { x: number; y: number }, size?: { width: number; height: number }) => {
            return addCanvasBlock({
                type: 'frame',
                position: position || { x: -viewport.x + 100, y: -viewport.y + 100 },
                size: size || { width: 600, height: 400 },
                zIndex: 0, // Frames sit behind standard blocks
                snapshot: {
                    title: title || 'Group Frame',
                    cachedAt: Date.now(),
                },
                settings: { title: title || 'Group Frame' },
            });
        },
        [addCanvasBlock, viewport]
    );

    return {
        currentProjectId,
        currentCanvas,
        blocks,
        edges,
        selectedBlockIds,
        viewport,
        activeTool,
        isSaving,
        isDirty,
        saveError,
        lastSavedAt,
        setCanvasViewport,
        setActiveCanvasTool,
        selectCanvasBlock,
        clearCanvasSelection,
        addCanvasBlock,
        updateCanvasBlockPosition,
        updateCanvasBlockSize,
        updateCanvasBlock,
        removeCanvasBlockPlacement,
        addCanvasEdge,
        removeCanvasEdge,
        undoCanvas,
        redoCanvas,
        saveProjectCanvas,
        retryCanvasSave,
        handleAddTextBlock,
        handleAddFrame,
    };
}
