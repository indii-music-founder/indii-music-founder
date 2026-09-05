/**
 * CanvasHUD.tsx
 *
 * Heads-up display for Project Canvas:
 * - Zoom in/out, fit all, 100% reset
 * - Undo and redo
 * - Non-intrusive save/dirty status indicator with failure retry
 */

import React from 'react';
import {
    ZoomIn,
    ZoomOut,
    Maximize,
    Undo2,
    Redo2,
    Check,
    Loader2,
    AlertCircle,
    RefreshCw,
} from 'lucide-react';
import type { CanvasViewport } from '../types';

interface CanvasHUDProps {
    viewport: CanvasViewport;
    isSaving: boolean;
    isDirty: boolean;
    saveError: string | null;
    lastSavedAt: number | null;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetZoom: () => void;
    onFitAll: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onRetrySave: () => void;
}

export const CanvasHUD: React.FC<CanvasHUDProps> = ({
    viewport,
    isSaving,
    isDirty,
    saveError,
    lastSavedAt: _lastSavedAt,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onFitAll,
    onUndo,
    onRedo,
    onRetrySave,
}) => {
    const zoomPercent = Math.round(viewport.zoom * 100);

    return (
        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none z-30 select-none">
            {/* Left: Undo / Redo & Save State */}
            <div className="flex items-center gap-3 pointer-events-auto">
                <div className="flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-zinc-800 shadow-xl">
                    <button
                        onClick={onUndo}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Undo (Ctrl+Z)"
                        aria-label="Undo canvas change"
                    >
                        <Undo2 size={15} />
                    </button>
                    <button
                        onClick={onRedo}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Redo (Ctrl+Y)"
                        aria-label="Redo canvas change"
                    >
                        <Redo2 size={15} />
                    </button>
                </div>

                {/* Save Status Banner */}
                <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 shadow-xl text-xs">
                    {saveError ? (
                        <div className="flex items-center gap-2 text-rose-400 font-medium">
                            <AlertCircle size={14} className="shrink-0" />
                            <span className="truncate max-w-[220px]">Save failed</span>
                            <button
                                onClick={onRetrySave}
                                className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded text-[11px] font-semibold transition-colors"
                            >
                                <RefreshCw size={11} /> Retry
                            </button>
                        </div>
                    ) : isSaving ? (
                        <div className="flex items-center gap-1.5 text-cyan-400">
                            <Loader2 size={13} className="animate-spin" />
                            <span>Saving...</span>
                        </div>
                    ) : isDirty ? (
                        <div className="flex items-center gap-1.5 text-amber-400">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span>Unsaved changes</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-zinc-400">
                            <Check size={13} className="text-emerald-400" />
                            <span>Saved</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Zoom & Navigation Controls */}
            <div className="flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-zinc-800 shadow-xl pointer-events-auto">
                <button
                    onClick={onZoomOut}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Zoom Out (-)"
                    aria-label="Zoom out"
                >
                    <ZoomOut size={15} />
                </button>

                <button
                    onClick={onResetZoom}
                    className="px-2 py-1 text-xs font-mono font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors min-w-[50px] text-center"
                    title="Reset Zoom to 100%"
                    aria-label="Reset zoom to 100%"
                >
                    {zoomPercent}%
                </button>

                <button
                    onClick={onZoomIn}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Zoom In (+)"
                    aria-label="Zoom in"
                >
                    <ZoomIn size={15} />
                </button>

                <div className="w-px h-4 bg-zinc-800 mx-1" />

                <button
                    onClick={onFitAll}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Fit to Screen (Shift+1)"
                    aria-label="Fit all blocks to screen"
                >
                    <Maximize size={15} />
                </button>
            </div>
        </div>
    );
};
